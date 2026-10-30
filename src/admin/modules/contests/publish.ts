// Publish for the admin (spec §7): one call to the publish-content edge
// function, the "unpublished changes" summary, and the last run.
//
// invokePublish never throws: every outcome, including a 409 busy, a 500
// error with the function's own message, or a request that never reached
// the function, comes back as a PublishOutcome, and it never rejects.
//
// One publish at a time per page. A call made while a run is in flight
// must not join that run: its snapshot may predate the caller's change
// (Publish clicked, then Archive commits and auto-publishes). Such calls
// share ONE trailing run that starts when the current run settles, so
// every caller gets an outcome that covers its own change, and any number
// of callers during a run cost exactly one more invoke. A run that does
// not settle within PUBLISH_TIMEOUT_MS frees the slot with a timeout error.
//
// usePublisher holds that state for the Contests module, so its PublishBar
// and the auto-publish after Finalize / Archive / Un-archive share one
// "publishing" flag and one last outcome.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatError } from '../../lib/formatError';

export const COMMIT_URL = 'https://github.com/tsokid/EurovisionParty/commit/';
export const BUSY_TEXT = 'Another publish is running — try again in a minute';
export const PUBLISH_TIMEOUT_MS = 90_000;
export const TIMEOUT_TEXT = 'Publish timed out — check the last run below and try again';

export type PublishOutcome = {
  status: 'ok' | 'noop' | 'error' | 'busy';
  sha?: string | null;
  files_changed?: number;
  warning?: string;
  error?: string;
};

export type UnpublishedSummary = { changed_years: number[]; since: string | null };

export type PublishRun = {
  id: number;
  status: 'running' | 'ok' | 'noop' | 'error';
  commit_sha: string | null;
  finished_at: string | null;
  files_changed?: number | null;
  error: string | null;
};

const STATUSES = ['ok', 'noop', 'error', 'busy'];

function asOutcome(body: unknown): PublishOutcome | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.status === 'string' && STATUSES.includes(b.status)) return b as PublishOutcome;
  // 403 / 405 bodies are { error } only.
  if (typeof b.error === 'string') return { status: 'error', error: b.error };
  return null;
}

// Module-level, so every caller in this page shares the guard.
let current: Promise<PublishOutcome> | null = null;
let trailing: { promise: Promise<PublishOutcome>; resolve: (p: Promise<PublishOutcome>) => void } | null = null;

/** True while a publish of this page is running (a new call would queue the trailing run). */
export function isPublishInFlight(): boolean {
  return current !== null;
}

/** callPublish, settled as a timeout error after PUBLISH_TIMEOUT_MS. Never rejects. */
function timed(): Promise<PublishOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<PublishOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ status: 'error', error: TIMEOUT_TEXT }), PUBLISH_TIMEOUT_MS);
  });
  return Promise.race([callPublish(), timeout]).finally(() => clearTimeout(timer));
}

function start(): Promise<PublishOutcome> {
  const run = timed();
  current = run;
  void run.then(() => {
    if (current !== run) return; // reset by __resetPublishGuardForTests
    if (trailing) {
      // Hand the slot straight to the trailing run: no gap for a third run.
      const t = trailing;
      trailing = null;
      t.resolve(start());
    } else {
      current = null;
    }
  });
  return run;
}

/**
 * Publishes. With nothing in flight, starts a run. Otherwise returns the
 * single trailing run that starts after the current one. Never rejects.
 */
export function invokePublish(): Promise<PublishOutcome> {
  if (!current) return start();
  if (!trailing) {
    let resolve!: (p: Promise<PublishOutcome>) => void;
    const promise = new Promise<PublishOutcome>((r) => { resolve = r; });
    trailing = { promise, resolve };
  }
  return trailing.promise;
}

/** Test-only: forget any in-flight or trailing run. */
export function __resetPublishGuardForTests(): void {
  current = null;
  trailing = null;
}

/** formatError that cannot throw. */
function safeError(e: unknown): string {
  try {
    return formatError(e);
  } catch {
    return 'publish failed (unreadable error)';
  }
}

async function callPublish(): Promise<PublishOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke('publish-content', { body: {} });
    if (error) {
      // Non-2xx (409 busy, 500 error): the function's JSON body is on error.context.
      const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const outcome = asOutcome(await ctx.json());
          if (outcome) return outcome;
        } catch {
          /* not json: fall through to the invoke error */
        }
      }
      return { status: 'error', error: safeError(error) };
    }
    return asOutcome(data) ?? { status: 'error', error: 'publish-content returned no result' };
  } catch (e) {
    return { status: 'error', error: safeError(e) };
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD HH:MM" in the browser's time zone, independent of its locale. */
export function formatRunTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Years as "1956-1958, 1999". */
export function yearRanges(years: number[]): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

/** One line for the result of a publish. */
export function outcomeText(o: PublishOutcome): string {
  switch (o.status) {
    case 'ok': {
      const n = o.files_changed ?? 0;
      return `Published: ${n} file${n === 1 ? '' : 's'} changed.`;
    }
    case 'noop':
      return 'Nothing to publish: the site is already up to date.';
    case 'busy':
      return BUSY_TEXT;
    case 'error':
      return `Publish failed: ${o.error ?? 'unknown error'}`;
  }
}

export type Publisher = {
  summary: UnpublishedSummary | null;
  lastRun: PublishRun | null;
  /** Error loading the summary or the last run. */
  loadError: string | null;
  publishing: boolean;
  outcome: PublishOutcome | null;
  refresh: () => Promise<void>;
  publish: () => Promise<PublishOutcome>;
};

export function usePublisher(): Publisher {
  const [summary, setSummary] = useState<UnpublishedSummary | null>(null);
  const [lastRun, setLastRun] = useState<PublishRun | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null);
  // Calls of this hook still waiting for their outcome.
  const pending = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([supabase.rpc('unpublished_summary'), supabase.rpc('last_publish_run')]);
      if (s.error) throw s.error;
      if (r.error) throw r.error;
      setSummary((s.data ?? null) as UnpublishedSummary | null);
      setLastRun((r.data ?? null) as PublishRun | null);
      setLoadError(null);
    } catch (e) {
      setLoadError(formatError(e));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // A call during a run waits for the trailing run (invokePublish). Only a
  // call that starts a run clears the outcome line; a queued one leaves the
  // current caller's line alone until its own outcome arrives.
  const publish = useCallback(async () => {
    if (!isPublishInFlight()) setOutcome(null);
    pending.current += 1;
    setPublishing(true);
    try {
      const o = await invokePublish();
      setOutcome(o);
      return o;
    } finally {
      pending.current -= 1;
      if (pending.current === 0) setPublishing(false);
      await refresh();
    }
  }, [refresh]);

  return { summary, lastRun, loadError, publishing, outcome, refresh, publish };
}

// Publish for the admin (spec §7): one call to the publish-content edge
// function, the "unpublished changes" summary, and the last run.
//
// invokePublish never throws: every outcome, including a 409 busy, a 500
// error with the function's own message, or a request that never reached
// the function, comes back as a PublishOutcome. While one call is in
// flight, further calls (a double click, the PublishBar and an
// auto-publish, FinalizeCard in the parser module) share it: the edge
// function is invoked once per page at a time.
//
// usePublisher holds that state for the Contests module, so its PublishBar
// and the auto-publish after Finalize / Archive / Un-archive share one
// "publishing" flag and one last outcome.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatError } from '../../lib/formatError';

export const COMMIT_URL = 'https://github.com/tsokid/EurovisionParty/commit/';
export const BUSY_TEXT = 'Another publish is running — try again in a minute';

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

// Module-level, so every caller in this page shares one in-flight publish.
let inFlight: Promise<PublishOutcome> | null = null;

/** Calls publish-content, or joins the call already in flight. Never throws. */
export function invokePublish(): Promise<PublishOutcome> {
  if (!inFlight) {
    inFlight = callPublish().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
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
      return { status: 'error', error: formatError(error) };
    }
    return asOutcome(data) ?? { status: 'error', error: 'publish-content returned no result' };
  } catch (e) {
    return { status: 'error', error: formatError(e) };
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

  // A second call while one is in flight joins it (invokePublish).
  const publish = useCallback(async () => {
    setPublishing(true);
    setOutcome(null);
    try {
      const o = await invokePublish();
      setOutcome(o);
      return o;
    } finally {
      setPublishing(false);
      await refresh();
    }
  }, [refresh]);

  return { summary, lastRun, loadError, publishing, outcome, refresh, publish };
}

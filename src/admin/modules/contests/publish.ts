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
// queue: at most one contests-only run and one content run wait, each
// shared by every caller of its kind, so every caller gets an outcome that
// covers its own change. A queued contests-only run (the results) starts
// first and is never merged into a content run (final review I3): a
// results publish never ships the page drafts. A run that does not settle
// within its timeout frees the slot with a timeout error.
//
// CMS page drafts (I3) ship only from an explicit Publish click: the
// lifecycle auto-publish (Finalize / Archive / Un-archive) and the
// "contests only" retry pass { cms: false }, contests only.
//
// usePublisher holds that state for the Contests module, so its PublishBar
// and the auto-publish after Finalize / Archive / Un-archive share one
// "publishing" flag and one last outcome. It also follows the last run's
// deploy (publish-status) while it builds.
//
// Per-doc publish (CMS P5): invokeScopedPublish ships named docs (doc_ids),
// a site-wide preview (target 'preview') or a promote. It never queues: with
// a run in flight it answers busy at once, since a later run of different
// docs must not be merged into this one. When it settles it hands the slot
// to a queued run like any other (final review I2).

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatError } from '../../lib/formatError';
import { t } from '../../i18n';
import { visibleInterval } from '../../../lib/visibleInterval';

export const COMMIT_URL = 'https://github.com/tsokid/EurovisionParty/commit/';
export const BUSY_TEXT: string = t.publish.busy;
export const PUBLISH_TIMEOUT_MS = 90_000;
/**
 * A contests-only run may wait up to 100 s server-side for a stuck run to be
 * taken over (migration 090), so the browser waits longer for it.
 */
export const CONTESTS_PUBLISH_TIMEOUT_MS = 150_000;
export const TIMEOUT_TEXT: string = t.publish.timeout;

/** Advice from validating the CMS drafts at publish; never blocks it. */
export type ContentWarning = {
  doc_id: string;
  locale: 'en' | 'el' | null;
  path: string;
  message: string;
};

export type PublishOutcome = {
  status: 'ok' | 'noop' | 'error' | 'busy';
  /** The publish_runs row (null when busy). */
  run_id?: number | null;
  sha?: string | null;
  files_changed?: number;
  warning?: string;
  error?: string;
  /** CMS content warnings (on ok, noop and a refused publish alike). */
  warnings?: ContentWarning[];
};

export type UnpublishedSummary = {
  changed_years: number[];
  /** cms_documents doc_ids edited since the last publish (076). */
  changed_docs?: string[];
  since: string | null;
};

export type DeployState = 'building' | 'ready' | 'error' | 'reverted' | 'revert_blocked';

export type PublishRun = {
  id: number;
  status: 'running' | 'ok' | 'noop' | 'error';
  commit_sha: string | null;
  finished_at: string | null;
  files_changed?: number | null;
  error: string | null;
  started_at?: string | null;
  /** Whether the run shipped CMS drafts (074). */
  cms?: boolean;
  /** 086: the docs the run ships (null: every draft and the contests). */
  doc_ids?: string[] | null;
  target?: 'main' | 'preview';
  promoted_from?: number | null;
  /** The versions shipped: [{doc_id, updated_at}] (086). */
  shipped?: Array<{ doc_id: string; updated_at: string | null }> | null;
  deploy_state?: DeployState | null;
  deploy_url?: string | null;
  deploy_note?: string | null;
  reverted_sha?: string | null;
};

/** Whether publish-status should still look at this run's deploy. */
export function deployPending(run: Pick<PublishRun, 'status' | 'commit_sha' | 'deploy_state' | 'target'> | null | undefined): boolean {
  if (!run || run.status !== 'ok' || !run.commit_sha) return false;
  return run.deploy_state == null || run.deploy_state === 'building' || (run.deploy_state === 'error' && run.target !== 'preview');
}

/** publish-status for these runs: their deploy state as recorded now. Throws on a failed call. */
export async function checkDeploys(runIds: number[]): Promise<PublishRun[]> {
  const { data, error } = await supabase.functions.invoke('publish-status', { body: { run_ids: runIds } });
  if (error) throw error;
  return ((data as { runs?: PublishRun[] } | null)?.runs ?? []).map((r) => ({ ...r, id: Number(r.id) }));
}

/** How often a building deploy is read again. */
export const DEPLOY_POLL_MS = 8000;
/** A deploy is followed for at most this long after the commit. */
export const DEPLOY_WATCH_MS = 20 * 60_000;

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
type Queued = { promise: Promise<PublishOutcome>; resolve: (p: Promise<PublishOutcome>) => void };
/** The runs waiting for the slot: contests-only first, then content. */
const queued: { contests: Queued | null; content: Queued | null } = { contests: null, content: null };

export type PublishRequest = {
  /** Ship the CMS page drafts too (default true). false: contests only (lifecycle auto-publish). */
  cms?: boolean;
};

/** A per-doc publish (CMS P5): these docs only; a site-wide preview; or the promote of a ready preview. */
export type ScopedPublishRequest =
  | { docIds: string[]; target?: 'main' | 'preview' }
  | { promote: number };

/** True while a publish of this page is running (a new call would queue the trailing run). */
export function isPublishInFlight(): boolean {
  return current !== null;
}

/** A publish-content call, settled as a timeout error after `ms`. Never rejects. */
function timed(body: Record<string, unknown>, ms: number): Promise<PublishOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<PublishOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ status: 'error', error: TIMEOUT_TEXT }), ms);
  });
  return Promise.race([callPublishBody(body), timeout]).finally(() => clearTimeout(timer));
}

/** Holds the slot for `run`; when it settles, the slot goes straight to a queued run (no gap for a third run). */
function occupy(run: Promise<PublishOutcome>): Promise<PublishOutcome> {
  current = run;
  void run.then(() => {
    if (current !== run) return; // reset by __resetPublishGuardForTests
    if (queued.contests) {
      const q = queued.contests;
      queued.contests = null;
      q.resolve(start(false));
    } else if (queued.content) {
      const q = queued.content;
      queued.content = null;
      q.resolve(start(true));
    } else {
      current = null;
    }
  });
  return run;
}

function start(cms: boolean): Promise<PublishOutcome> {
  return occupy(timed({ cms }, cms ? PUBLISH_TIMEOUT_MS : CONTESTS_PUBLISH_TIMEOUT_MS));
}

/**
 * Publishes. With nothing in flight, starts a run. Otherwise returns the
 * queued run of the caller's kind (contests-only or content), which starts
 * after the current one; a queued contests-only run goes first. Never
 * rejects.
 */
export function invokePublish({ cms = true }: PublishRequest = {}): Promise<PublishOutcome> {
  if (!current) return start(cms);
  const kind = cms ? 'content' : 'contests';
  let q = queued[kind];
  if (!q) {
    let resolve!: (p: Promise<PublishOutcome>) => void;
    const promise = new Promise<PublishOutcome>((r) => { resolve = r; });
    q = { promise, resolve };
    queued[kind] = q;
  }
  return q.promise;
}

/**
 * Publishes the named docs, a site-wide preview or a promote. Never queues
 * (busy while any run of this page is in flight) and never rejects.
 */
export function invokeScopedPublish(request: ScopedPublishRequest): Promise<PublishOutcome> {
  if (current) return Promise.resolve({ status: 'busy', error: BUSY_TEXT });
  const body = 'promote' in request
    ? { cms: true, promote: request.promote }
    : { cms: true, doc_ids: request.docIds, target: request.target ?? 'main' };
  return occupy(timed(body, PUBLISH_TIMEOUT_MS));
}

/** Test-only: forget any in-flight or trailing run. */
export function __resetPublishGuardForTests(): void {
  current = null;
  queued.contests = null;
  queued.content = null;
}

/** formatError that cannot throw. */
function safeError(e: unknown): string {
  try {
    return formatError(e);
  } catch {
    return 'publish failed (unreadable error)';
  }
}

async function callPublishBody(body: Record<string, unknown>): Promise<PublishOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke('publish-content', { body });
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

/** One content warning as "about [en] meta.title: message" ("doc: message" for a document-level one). */
export function warningText(w: ContentWarning): string {
  const where = w.locale ? `${w.doc_id} [${w.locale}]${w.path ? ` ${w.path}` : ''}` : `${w.doc_id}${w.path ? ` ${w.path}` : ''}`;
  return `${where}: ${w.message}`;
}

/** One line for the result of a publish. */
export function outcomeText(o: PublishOutcome): string {
  switch (o.status) {
    case 'ok': {
      const n = o.files_changed ?? 0;
      return t.publish.ok(n);
    }
    case 'noop':
      return t.publish.noop;
    case 'busy':
      return BUSY_TEXT;
    case 'error':
      return t.publish.failed(o.error ?? t.publish.unknownError);
  }
}

export type Publisher = {
  summary: UnpublishedSummary | null;
  lastRun: PublishRun | null;
  /** Error loading the summary or the last run. */
  loadError: string | null;
  publishing: boolean;
  outcome: PublishOutcome | null;
  /** Whether the latest outcome came from a contests-only request (the results). */
  outcomeContestsOnly: boolean;
  refresh: () => Promise<void>;
  publish: (request?: PublishRequest) => Promise<PublishOutcome>;
};

export function usePublisher(): Publisher {
  const [summary, setSummary] = useState<UnpublishedSummary | null>(null);
  const [lastRun, setLastRun] = useState<PublishRun | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null);
  const [outcomeContestsOnly, setOutcomeContestsOnly] = useState(false);
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

  // The last run's deploy, while it builds (publish-status; the auto-revert runs there).
  // A run still recorded as building after the watch window (nobody had the
  // admin open while it built) is checked once on load, so it never stays
  // «Χτίζεται…» for good (27 Nov 2026).
  const pendingId = deployPending(lastRun) ? lastRun!.id : null;
  const staleBuilding = lastRun?.deploy_state === 'building';
  const watchId = pendingId !== null && lastRun?.finished_at && Date.now() - Date.parse(lastRun.finished_at) < DEPLOY_WATCH_MS ? pendingId : null;
  useEffect(() => {
    if (pendingId === null || watchId !== null || !staleBuilding) return;
    let off = false;
    void checkDeploys([pendingId])
      .then(([next]) => { if (!off && next) setLastRun((r) => (r && r.id === next.id ? { ...r, ...next } : r)); })
      .catch(() => { /* offline: the run line keeps its last state */ });
    return () => { off = true; };
  }, [pendingId, watchId, staleBuilding]);
  useEffect(() => {
    if (watchId === null) return;
    let off = false;
    const tick = async () => {
      try {
        const [next] = await checkDeploys([watchId]);
        if (!off && next) setLastRun((r) => (r && r.id === next.id ? { ...r, ...next } : r));
      } catch {
        /* publish-status not deployed or offline: the run line keeps its last state */
      }
    };
    void tick();
    // Only while the admin tab is visible; once at once on return (28 Nov 2026).
    const stop = visibleInterval(() => { void tick(); }, DEPLOY_POLL_MS);
    return () => { off = true; stop(); };
  }, [watchId]);

  // A call during a run waits for the trailing run (invokePublish). Only a
  // call that starts a run clears the outcome line; a queued one leaves the
  // current caller's line alone until its own outcome arrives.
  const publish = useCallback(async (request?: PublishRequest) => {
    if (!isPublishInFlight()) setOutcome(null);
    pending.current += 1;
    setPublishing(true);
    try {
      const o = await invokePublish(request);
      setOutcome(o);
      setOutcomeContestsOnly(request?.cms === false);
      return o;
    } finally {
      pending.current -= 1;
      if (pending.current === 0) setPublishing(false);
      await refresh();
    }
  }, [refresh]);

  return { summary, lastRun, loadError, publishing, outcome, outcomeContestsOnly, refresh, publish };
}

// src/admin/modules/parser/useParserState.ts
// Loads both parse_jobs rows for the active contest year (participants +
// results) and the most recent parse_runs. Polls every `pollMs` so the
// admin UI stays in sync with cron-driven state changes during the show.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Module-level cache ────────────────────────────────────────────────
// Persists the last good fetch across component remounts (e.g. when the
// admin switches between the Parser / Phase Monitor / Super admins tabs
// and back). Without this, every remount starts with an empty `jobs`
// map → the gate in EurovisionParser shows "Loading parser state…"
// while the first fetch is in flight, which can hang for seconds if the
// Supabase JWT silently needs refreshing after idle.
let cachedJobs: JobsByKind = {};
let cachedRuns: ParseRun[] = [];
let cachedYear: number | null = null;
let cachedYears: number[] = [];

// Fail fetches that hang past this so the UI surfaces an error + retry
// path instead of staying stuck on "Loading…" forever. The underlying
// Supabase request keeps running in the background; we just don't await
// it past the timeout.
const FETCH_TIMEOUT_MS = 10_000;

function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export type JobKind = "participants" | "results";
export type JobStatus =
  | "idle"
  | "running"
  | "stopped"
  | "finalized"
  | "done"
  | "error";

export interface ParseJob {
  kind: JobKind;
  year: number;
  status: JobStatus;
  poll_count: number;
  last_poll_at: string | null;
  started_at: string | null;
  stopped_at: string | null;
  triggered_by_user: boolean | null;
  manual_override: boolean;
  source_url: string | null;
  scheduled_start_at: string | null;     // ISO timestamptz
  scheduled_end_at: string | null;       // ISO timestamptz, null for participants
  poll_interval_minutes: number;         // results-only meaning, but stored on both rows
  /** Opt-in: only when TRUE will the parser-tick cron auto-fire on schedule.
   *  Killswitch added in migration 045 to stop stale past schedules from
   *  re-firing every minute. */
  respect_schedule: boolean;
}

export interface ParseRun {
  id: string;
  kind: JobKind;
  year: number;
  finished_at: string;
  http_status: number | null;
  status: "ok" | "error" | "blocked";
  rows_upserted: number | null;
  error: string | null;
}

interface JobsByKind {
  participants?: ParseJob;
  results?: ParseJob;
}

interface UseParserState {
  jobs: JobsByKind;
  runs: ParseRun[];
  /** The contest year currently displayed: the requested year when it has
   *  parse_jobs rows, else the latest year in parse_jobs. null only when the
   *  table is completely empty (first-time setup). */
  year: number | null;
  /** Every year with parse_jobs rows, newest first (the year picker). */
  years: number[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Parser state of one contest year. `requestedYear` is the year the admin
 * picked (the page defaults it to the game year, live_contest_year()); null
 * or a year without parse_jobs rows falls back to the latest year in
 * parse_jobs. Every card, Finalize included, acts on the returned year.
 */
export function useParserState(requestedYear: number | null = null, pollMs = 5000): UseParserState {
  // Hydrate from the module-level cache so a tab switch back into the
  // Parser dashboard renders the last-known state instantly instead of
  // flashing the "Loading parser state…" placeholder.
  const [jobs, setJobs] = useState<JobsByKind>(cachedJobs);
  const [runs, setRuns] = useState<ParseRun[]>(cachedRuns);
  const [year, setYear] = useState<number | null>(cachedYear);
  const [years, setYears] = useState<number[]>(cachedYears);
  // Loading is false the moment we have ANY cached data — show stale
  // first, refresh in the background. Only the very first ever fetch
  // (cold cache) shows the loading placeholder.
  const [loading, setLoading] = useState<boolean>(Object.keys(cachedJobs).length === 0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      // 1. Pull every parse_jobs row; show the requested year, else the latest.
      const jobsRes = await withTimeout(
        supabase.from("parse_jobs").select("*").order("year", { ascending: false }),
        FETCH_TIMEOUT_MS,
        "parse_jobs fetch",
      );

      if (jobsRes.error) {
        setError(jobsRes.error.message);
        setLoading(false);
        return;
      }

      const allJobs    = (jobsRes.data ?? []) as ParseJob[];
      const allYears   = [...new Set(allJobs.map((j) => j.year))];
      const activeYear =
        requestedYear != null && allYears.includes(requestedYear)
          ? requestedYear
          : (allYears[0] ?? null);
      setYears(allYears);
      cachedYears = allYears;

      const next: JobsByKind = {};
      for (const j of allJobs) {
        if (j.year === activeYear) next[j.kind] = j;
      }
      setJobs(next);
      setYear(activeYear);
      cachedJobs = next;
      cachedYear = activeYear;

      // 2. Recent runs scoped to the active year.
      if (activeYear == null) {
        setRuns([]);
        cachedRuns = [];
        setError(null);
        setLoading(false);
        return;
      }
      const runsRes = await withTimeout(
        supabase
          .from("parse_runs")
          .select("*")
          .eq("year", activeYear)
          .order("finished_at", { ascending: false })
          .limit(20),
        FETCH_TIMEOUT_MS,
        "parse_runs fetch",
      );

      if (runsRes.error) {
        setError(runsRes.error.message);
        setLoading(false);
        return;
      }
      const runsData = (runsRes.data ?? []) as ParseRun[];
      setRuns(runsData);
      cachedRuns = runsData;
      setError(null);
      setLoading(false);
    } catch (e) {
      // Reached only when withTimeout fires. Surface the error + clear
      // loading so the UI can show a retry hint instead of hanging on
      // "Loading parser state…" forever.
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, [requestedYear]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);

    // Browsers throttle background-tab timers. Re-fetch immediately when
    // the admin switches back so status changes (e.g. cron → running) are
    // visible without a manual page refresh.
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, pollMs]);

  return { jobs, runs, year, years, loading, error, refresh };
}

// src/admin/modules/parser/useParserState.ts
// Loads both parse_jobs rows for a year (participants + results) and the most
// recent parse_runs. Polls every `pollMs` so the admin UI stays in sync with
// cron-driven state changes during the show.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

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
  /** The contest year currently displayed — discovered from parse_jobs.
   *  null only when the table is completely empty (first-time setup). */
  year: number | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * No year argument by design — the active contest year is whichever max(year)
 * exists in parse_jobs. parse_jobs holds 1–2 rows per contest cycle so a full
 * scan is trivial; this keeps the admin UI year-agnostic forever (Vienna 2026
 * today, Berlin 2027 tomorrow, etc., with no code changes).
 */
export function useParserState(pollMs = 5000): UseParserState {
  const [jobs, setJobs] = useState<JobsByKind>({});
  const [runs, setRuns] = useState<ParseRun[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // 1. Pull every parse_jobs row, pick the latest year as "active".
    const jobsRes = await supabase
      .from("parse_jobs")
      .select("*")
      .order("year", { ascending: false });

    if (jobsRes.error) {
      setError(jobsRes.error.message);
      setLoading(false);
      return;
    }

    const allJobs    = (jobsRes.data ?? []) as ParseJob[];
    const activeYear = allJobs[0]?.year ?? null;
    setYear(activeYear);

    const next: JobsByKind = {};
    for (const j of allJobs) {
      if (j.year === activeYear) next[j.kind] = j;
    }
    setJobs(next);

    // 2. Recent runs scoped to the active year.
    if (activeYear == null) {
      setRuns([]);
      setError(null);
      setLoading(false);
      return;
    }
    const runsRes = await supabase
      .from("parse_runs")
      .select("*")
      .eq("year", activeYear)
      .order("finished_at", { ascending: false })
      .limit(20);

    if (runsRes.error) {
      setError(runsRes.error.message);
      setLoading(false);
      return;
    }
    setRuns((runsRes.data ?? []) as ParseRun[]);
    setError(null);
    setLoading(false);
  }, []);

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

  return { jobs, runs, year, loading, error, refresh };
}

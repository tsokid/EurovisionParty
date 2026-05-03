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
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useParserState(year: number, pollMs = 5000): UseParserState {
  const [jobs, setJobs] = useState<JobsByKind>({});
  const [runs, setRuns] = useState<ParseRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [jobsRes, runsRes] = await Promise.all([
      supabase.from("parse_jobs").select("*").eq("year", year),
      supabase
        .from("parse_runs")
        .select("*")
        .eq("year", year)
        .order("finished_at", { ascending: false })
        .limit(20),
    ]);

    if (jobsRes.error || runsRes.error) {
      setError((jobsRes.error ?? runsRes.error)!.message);
      setLoading(false);
      return;
    }

    const next: JobsByKind = {};
    for (const j of (jobsRes.data ?? []) as ParseJob[]) {
      next[j.kind] = j;
    }
    setJobs(next);
    setRuns((runsRes.data ?? []) as ParseRun[]);
    setError(null);
    setLoading(false);
  }, [year]);

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

  return { jobs, runs, loading, error, refresh };
}

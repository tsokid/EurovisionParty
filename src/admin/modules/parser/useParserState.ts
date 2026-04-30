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
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { jobs, runs, loading, error, refresh };
}

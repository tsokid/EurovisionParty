// src/admin/modules/parser/ResultsCard.tsx
// Continuous Results parser card. Start/Stop/Resume drive the job state
// machine; Parse Now invokes the edge function once for an out-of-cycle poll.
// Recent runs are shown in a collapsed details element.

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { StatusPill } from "./StatusPill";
import { SourceUrlEditor } from "./SourceUrlEditor";
import { ScheduleEditor } from "./ScheduleEditor";
import type { ParseJob, ParseRun } from "./useParserState";

interface Props {
  job?: ParseJob;
  recentRuns: ParseRun[];
  onRefresh: () => void;
}

export function ResultsCard({ job, recentRuns, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!job) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/60">
        Loading results job…
      </section>
    );
  }

  const can = (allowed: ParseJob["status"][]) => allowed.includes(job.status);

  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    wrap(async () => {
      const { error } = await supabase.rpc("start_parse_job", {
        p_year: job.year,
        p_kind: "results",
      });
      if (error) throw error;
    });

  const stop = () =>
    wrap(async () => {
      const { error } = await supabase.rpc("stop_parse_job", { p_year: job.year });
      if (error) throw error;
    });

  const resume = () =>
    wrap(async () => {
      const { error } = await supabase.rpc("resume_parse_job", {
        p_year: job.year,
      });
      if (error) throw error;
    });

  const parseNow = () =>
    wrap(async () => {
      const { error } = await supabase.functions.invoke("eurovision-parse", {
        body: { action: "results" },
      });
      if (error) throw error;
    });

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">Results Parser</h3>
        <StatusPill status={job.status} />
      </header>
      <p className="text-sm text-white/60 mb-1">Polls: {job.poll_count}</p>
      <p className="text-sm text-white/60 mb-3">
        Last poll:{" "}
        {job.last_poll_at ? new Date(job.last_poll_at).toLocaleString() : "—"}
      </p>
      <SourceUrlEditor
        year={job.year}
        kind="results"
        currentUrl={job.source_url}
        onSaved={onRefresh}
      />
      <ScheduleEditor
        year={job.year}
        kind="results"
        job={job}
        onSaved={onRefresh}
      />
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={start}
          disabled={!can(["idle"]) || busy}
          className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40"
        >
          Start
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!can(["running"]) || busy}
          className="px-3 py-1.5 rounded bg-red-500 text-white text-sm disabled:opacity-40"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={resume}
          disabled={!can(["stopped"]) || busy}
          className="px-3 py-1.5 rounded bg-yellow-400 text-black font-bold text-sm disabled:opacity-40"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={parseNow}
          disabled={!can(["running", "stopped"]) || busy}
          className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40"
        >
          Parse Now
        </button>
      </div>
      <details className="mt-2">
        <summary className="text-sm text-white/70 cursor-pointer">
          Recent runs ({recentRuns.length})
        </summary>
        <table className="w-full text-xs mt-2">
          <thead className="text-white/50">
            <tr>
              <th className="text-left">Finished</th>
              <th>HTTP</th>
              <th>Status</th>
              <th>Rows</th>
              <th className="text-left">Error</th>
            </tr>
          </thead>
          <tbody>
            {recentRuns.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td>{new Date(r.finished_at).toLocaleTimeString()}</td>
                <td className="text-center">{r.http_status ?? "—"}</td>
                <td className="text-center">{r.status}</td>
                <td className="text-center">{r.rows_upserted ?? "—"}</td>
                <td className="text-white/60 truncate max-w-[200px]">
                  {r.error ?? ""}
                </td>
              </tr>
            ))}
            {recentRuns.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-white/40 py-2">
                  No runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </details>
      {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
    </section>
  );
}

// src/admin/modules/parser/ResultsCard.tsx
// Continuous Results parser card. Five canonical actions:
//   Start on Schedule | Start Now | Pause | Resume | Hard Stop

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { formatError } from "../../lib/formatError";
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

  const status = job.status;

  const canArm     = status === "done" || status === "error" || status === "stopped";
  const canStartNow = status === "idle" || status === "done" || status === "error" || status === "stopped";
  const canPause   = status === "running";
  const canResume  = status === "stopped";
  const canHardStop = status === "running" || status === "stopped";

  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onRefresh();
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const startOnSchedule = () =>
    wrap(async () => {
      const { error } = await supabase.rpc("hard_stop_parse_job", {
        p_year: job.year,
        p_kind: "results",
      });
      if (error) throw error;
    });

  const startNow = () =>
    wrap(async () => {
      if (status !== "idle") {
        const { error: rstErr } = await supabase.rpc("hard_stop_parse_job", {
          p_year: job.year,
          p_kind: "results",
        });
        if (rstErr) throw rstErr;
      }
      const { error: startErr } = await supabase.rpc("start_parse_job", {
        p_year: job.year,
        p_kind: "results",
      });
      if (startErr) throw startErr;
      const { error: fnErr } = await supabase.functions.invoke(
        "eurovision-parse",
        { body: { action: "results" } },
      );
      if (fnErr) throw fnErr;
    });

  const pause = () =>
    wrap(async () => {
      const { error } = await supabase.rpc("pause_parse_job", {
        p_year: job.year,
        p_kind: "results",
      });
      if (error) throw error;
    });

  const resume = () =>
    wrap(async () => {
      const { error } = await supabase.rpc("resume_parse_job", {
        p_year: job.year,
        p_kind: "results",
      });
      if (error) throw error;
    });

  const hardStop = () => {
    if (!window.confirm(
      "Hard Stop forces the job back to 'idle' and stops cron polling. Use when stuck or to fully halt. Doesn't delete any results data.",
    )) return;
    return wrap(async () => {
      const { error } = await supabase.rpc("hard_stop_parse_job", {
        p_year: job.year,
        p_kind: "results",
      });
      if (error) throw error;
    });
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">Results Parser</h3>
        <StatusPill status={status} />
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

      {status === "running" && (
        <p className="text-[11px] text-amber-300/80 mb-2 leading-snug">
          🔄 Polling every {job.poll_interval_minutes ?? "—"}m. <span className="text-white">Pause</span> stops the cron loop. <span className="text-white">Hard Stop</span> kills it entirely.
        </p>
      )}
      {status === "stopped" && (
        <p className="text-[11px] text-white/55 mb-2 leading-snug">
          ⏸ Paused. <span className="text-white">Resume</span> restarts the polling loop. <span className="text-white">Start Now</span> does an immediate one-off poll.
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={startOnSchedule}
          disabled={!canArm || busy}
          className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40 cursor-pointer"
          title="Flip job state back to idle so the next scheduled time can fire it."
        >
          Start on Schedule
        </button>
        <button
          type="button"
          onClick={startNow}
          disabled={!canStartNow || busy}
          className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title="Start polling right now (ignores schedule)."
        >
          Start Now
        </button>
        <button
          type="button"
          onClick={pause}
          disabled={!canPause || busy}
          className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title="Pause the polling loop."
        >
          ⏸ Pause
        </button>
        <button
          type="button"
          onClick={resume}
          disabled={!canResume || busy}
          className="px-3 py-1.5 rounded bg-yellow-400 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title="Resume a paused polling loop."
        >
          ▶ Resume
        </button>
        <button
          type="button"
          onClick={hardStop}
          disabled={!canHardStop || busy}
          className="px-3 py-1.5 rounded bg-red-500/90 hover:bg-red-500 text-white font-bold text-sm disabled:opacity-40 cursor-pointer"
          title="Force the job back to idle from any state. Use when stuck."
        >
          🛑 Hard Stop
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

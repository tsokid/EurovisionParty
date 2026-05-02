// src/admin/modules/parser/ParticipantsCard.tsx
// One-shot Participants parser card. Five canonical actions:
//   Start on Schedule | Start Now | Pause | Resume | Hard Stop
// All driven by RPCs on parse_jobs; no extra mid-flight invocation
// state lives in the component.

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { formatError } from "../../lib/formatError";
import { StatusPill } from "./StatusPill";
import { SourceUrlEditor } from "./SourceUrlEditor";
import { ScheduleEditor } from "./ScheduleEditor";
import type { ParseJob, ParseRun } from "./useParserState";

interface Props {
  job?: ParseJob;
  recentRun?: ParseRun;
  onRefresh: () => void;
}

export function ParticipantsCard({ job, recentRun, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!job) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/60">
        Loading participants job…
      </section>
    );
  }

  const status = job.status;

  // Per-button enablement. Aimed at being conservative — only enable
  // when the transition is meaningful for the current state.
  const canArm     = status === "idle" || status === "done" || status === "error" || status === "stopped";
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

  // Start on Schedule: arm the job for the next cron tick — sets
  // status=idle with stopped_at=NULL so the 033 cron guard passes.
  // Must NOT call hard_stop_parse_job (which sets stopped_at=now()),
  // as that would permanently block the cron guard from re-triggering.
  const startOnSchedule = () =>
    wrap(async () => {
      const { error } = await supabase.rpc("arm_parse_job", {
        p_year: job.year,
        p_kind: "participants",
      });
      if (error) throw error;
    });

  // Start Now: any state → running → invoke. We chain hard_stop (any
  // → idle) + start_parse_job (idle → running) so this works
  // regardless of where the job currently is.
  const startNow = () =>
    wrap(async () => {
      if (status !== "idle") {
        const { error: rstErr } = await supabase.rpc("hard_stop_parse_job", {
          p_year: job.year,
          p_kind: "participants",
        });
        if (rstErr) throw rstErr;
      }
      const { error: startErr } = await supabase.rpc("start_parse_job", {
        p_year: job.year,
        p_kind: "participants",
      });
      if (startErr) throw startErr;
      const { error: fnErr } = await supabase.functions.invoke(
        "eurovision-parse",
        { body: { action: "participants" } },
      );
      if (fnErr) throw fnErr;
    });

  const pause = () =>
    wrap(async () => {
      const { error } = await supabase.rpc("pause_parse_job", {
        p_year: job.year,
        p_kind: "participants",
      });
      if (error) throw error;
    });

  const resume = () =>
    wrap(async () => {
      const { error } = await supabase.rpc("resume_parse_job", {
        p_year: job.year,
        p_kind: "participants",
      });
      if (error) throw error;
    });

  const hardStop = () => {
    if (!window.confirm(
      "Hard Stop forces the job back to 'idle' and clears in-flight state. Use when stuck. Doesn't delete any participants data.",
    )) return;
    return wrap(async () => {
      const { error } = await supabase.rpc("hard_stop_parse_job", {
        p_year: job.year,
        p_kind: "participants",
      });
      if (error) throw error;
    });
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">Participants Parser</h3>
        <StatusPill status={status} />
      </header>
      <p className="text-sm text-white/60 mb-3">
        Last fetch:{" "}
        {job.last_poll_at ? new Date(job.last_poll_at).toLocaleString() : "—"}
      </p>
      <SourceUrlEditor
        year={job.year}
        kind="participants"
        currentUrl={job.source_url}
        onSaved={onRefresh}
      />
      <ScheduleEditor
        year={job.year}
        kind="participants"
        job={job}
        onSaved={onRefresh}
      />

      {status === "done" && (
        <p className="text-[11px] text-white/55 mb-2 leading-snug">
          ✅ Already ran. Click <span className="text-white">Start on Schedule</span> to allow the next scheduled time to fire it again, or <span className="text-white">Start Now</span> for an immediate re-run.
        </p>
      )}
      {status === "running" && (
        <p className="text-[11px] text-amber-300/80 mb-2 leading-snug">
          ⚠️ Stuck in <span className="text-white">running</span>? Use <span className="text-white">Hard Stop</span> to force the job back to idle.
        </p>
      )}
      {status === "stopped" && (
        <p className="text-[11px] text-white/55 mb-2 leading-snug">
          ⏸ Paused. <span className="text-white">Resume</span> puts it back in line for the schedule. <span className="text-white">Start Now</span> fires it immediately.
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={startOnSchedule}
          disabled={!canArm || busy}
          className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40 cursor-pointer"
          title="Flip job state back to idle so the next scheduled time can fire it. Doesn't delete any data."
        >
          Start on Schedule
        </button>
        <button
          type="button"
          onClick={startNow}
          disabled={!canStartNow || busy}
          className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title="Run the parser right now (ignores schedule)."
        >
          Start Now
        </button>
        <button
          type="button"
          onClick={pause}
          disabled={!canPause || busy}
          className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title="Pause an actively-running job."
        >
          ⏸ Pause
        </button>
        <button
          type="button"
          onClick={resume}
          disabled={!canResume || busy}
          className="px-3 py-1.5 rounded bg-yellow-400 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title="Resume a paused job — goes back to idle so the next scheduled time fires it."
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

      {recentRun && (
        <div className="text-xs text-white/60">
          Last run: {new Date(recentRun.finished_at).toLocaleString()} · http{" "}
          {recentRun.http_status ?? "—"} ·{" "}
          {recentRun.status === "ok"
            ? `${recentRun.rows_upserted ?? 0} rows`
            : recentRun.error ?? recentRun.status}
        </div>
      )}
      {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
    </section>
  );
}

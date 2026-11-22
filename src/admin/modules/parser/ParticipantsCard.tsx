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
import { ParseReport } from "./ParseReport";
import type { ParseJob, ParseRun } from "./useParserState";
import { t } from "../../i18n";

const J = t.parserUi.job;
const P = t.parserUi.participants;

interface Props {
  job?: ParseJob;
  recentRun?: ParseRun;
  /** Participants runs of the job's year, newest first (the parse report). */
  runs?: ParseRun[];
  onRefresh: () => void;
}

export function ParticipantsCard({ job, recentRun, runs = [], onRefresh }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  if (!job) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/60">
        {P.loading}
      </section>
    );
  }

  const status = job.status;

  // Schedule-arm gating (migration 045): the cron will only auto-fire
  // when respect_schedule is on, and arm_parse_job rejects past times.
  // Mirror those rules in the UI so the button reads honestly.
  const startMs    = job.scheduled_start_at ? Date.parse(job.scheduled_start_at) : NaN;
  const startInPast = Number.isFinite(startMs) && startMs <= Date.now();
  const respectOff  = !job.respect_schedule;
  const armBlockReason =
    respectOff      ? J.blockRespect :
    !job.scheduled_start_at ? J.blockNoStart :
    startInPast     ? J.blockStartPast :
    null;

  // Per-button enablement. Aimed at being conservative — only enable
  // when the transition is meaningful for the current state.
  const canArm     = (status === "idle" || status === "done" || status === "error" || status === "stopped")
                     && armBlockReason === null;
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
      setArmed(true);
      setTimeout(() => setArmed(false), 3000);
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
      P.hardStopConfirm,
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
        <h3 className="font-semibold text-white">{P.title}</h3>
        <StatusPill status={status} />
      </header>
      <p className="text-sm text-white/60 mb-3">
        {P.lastFetch}{" "}
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

      {status === "idle" && job.scheduled_start_at && (
        <p className="text-[11px] text-emerald-400/80 mb-2 leading-snug">
          ✅ {P.armedAt}{" "}
          <span className="text-white font-medium">
            {new Date(job.scheduled_start_at).toLocaleString()}
          </span>{P.armedEnd}
        </p>
      )}
      {status === "done" && (
        <p className="text-[11px] text-white/55 mb-2 leading-snug">
          {P.done1}<span className="text-white">{J.startOnSchedule}</span>{P.done2}<span className="text-white">{J.startNow}</span>{P.done3}
        </p>
      )}
      {status === "running" && (
        <p className="text-[11px] text-amber-300/80 mb-2 leading-snug">
          {P.stuck1}<span className="text-white">{t.parserUi.status.running}</span>{P.stuck2}<span className="text-white">{J.hardStop}</span>{P.stuck3}
        </p>
      )}
      {status === "stopped" && (
        <p className="text-[11px] text-white/55 mb-2 leading-snug">
          {P.paused1}<span className="text-white">{J.resume}</span>{P.paused2}<span className="text-white">{J.startNow}</span>{P.paused3}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={startOnSchedule}
          disabled={!canArm || busy}
          className={`px-3 py-1.5 rounded text-sm disabled:opacity-40 cursor-pointer transition-colors ${armed ? "bg-emerald-600 text-white" : "bg-white/10 text-white"}`}
          title={armBlockReason ?? J.armTitle}
        >
          {armed ? J.armed : J.startOnSchedule}
        </button>
        <button
          type="button"
          onClick={startNow}
          disabled={!canStartNow || busy}
          className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title={P.startNowTitle}
        >
          {J.startNow}
        </button>
        <button
          type="button"
          onClick={pause}
          disabled={!canPause || busy}
          className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title={P.pauseTitle}
        >
          {J.pause}
        </button>
        <button
          type="button"
          onClick={resume}
          disabled={!canResume || busy}
          className="px-3 py-1.5 rounded bg-yellow-400 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title={P.resumeTitle}
        >
          {J.resume}
        </button>
        <button
          type="button"
          onClick={hardStop}
          disabled={!canHardStop || busy}
          className="px-3 py-1.5 rounded bg-red-500/90 hover:bg-red-500 text-white font-bold text-sm disabled:opacity-40 cursor-pointer"
          title={J.hardStopTitle}
        >
          {J.hardStop}
        </button>
      </div>

      {armBlockReason && (
        <p className="text-[11px] text-amber-300/80 mb-2 leading-snug">
          ⚠️ <span className="text-white font-semibold">{J.startOnSchedule}</span> {J.blocked(armBlockReason)}
        </p>
      )}

      {err && (
        <p className="text-sm text-red-300 mb-2 rounded bg-red-500/10 px-2 py-1">{err}</p>
      )}
      {recentRun && (
        <div className="text-xs text-white/60">
          {J.lastRun} {new Date(recentRun.finished_at).toLocaleString('el-GR')} · http{" "}
          {recentRun.http_status ?? "—"} ·{" "}
          {recentRun.status === "ok"
            ? J.rows(recentRun.rows_upserted ?? 0)
            : recentRun.error ?? recentRun.status}
        </div>
      )}
      <ParseReport kind="participants" year={job.year} runs={runs} />
    </section>
  );
}

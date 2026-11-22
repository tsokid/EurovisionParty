// src/admin/modules/parser/ResultsCard.tsx
// Continuous Results parser card. Five canonical actions:
//   Start on Schedule | Start Now | Pause | Resume | Hard Stop

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
const R = t.parserUi.results;

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
        {R.loading}
      </section>
    );
  }

  const status = job.status;

  // Schedule-arm gating (migration 045): mirror arm_parse_job's checks
  // in the UI so the button reflects whether arming will actually work.
  const startMs    = job.scheduled_start_at ? Date.parse(job.scheduled_start_at) : NaN;
  const endMs      = job.scheduled_end_at   ? Date.parse(job.scheduled_end_at)   : NaN;
  const startInPast = Number.isFinite(startMs) && startMs <= Date.now();
  const endInPast   = Number.isFinite(endMs)   && endMs   <= Date.now();
  const respectOff  = !job.respect_schedule;
  const armBlockReason =
    respectOff             ? J.blockRespect :
    !job.scheduled_start_at ? J.blockNoStart :
    startInPast            ? J.blockStartPast :
    endInPast              ? J.blockEndPast :
    null;

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

  // Use arm_parse_job (not hard_stop) so the future-time validation in
  // migration 045 fires and the cron-tick guard (stopped_at = null) passes.
  const startOnSchedule = () =>
    wrap(async () => {
      const { error } = await supabase.rpc("arm_parse_job", {
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
      R.hardStopConfirm,
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
        <h3 className="font-semibold text-white">{R.title}</h3>
        <StatusPill status={status} />
      </header>
      <p className="text-sm text-white/60 mb-1">{R.polls} {job.poll_count}</p>
      <p className="text-sm text-white/60 mb-3">
        {R.lastPoll}{" "}
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
          {R.running1(String(job.poll_interval_minutes ?? "—"))}<span className="text-white">{J.pause}</span>{R.running2}<span className="text-white">{J.hardStop}</span>{R.running3}
        </p>
      )}
      {status === "stopped" && (
        <p className="text-[11px] text-white/55 mb-2 leading-snug">
          {R.paused1}<span className="text-white">{J.resume}</span>{R.paused2}<span className="text-white">{J.startNow}</span>{R.paused3}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={startOnSchedule}
          disabled={!canArm || busy}
          className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40 cursor-pointer"
          title={armBlockReason ?? J.armTitle}
        >
          {J.startOnSchedule}
        </button>
        <button
          type="button"
          onClick={startNow}
          disabled={!canStartNow || busy}
          className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title={R.startNowTitle}
        >
          {J.startNow}
        </button>
        <button
          type="button"
          onClick={pause}
          disabled={!canPause || busy}
          className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title={R.pauseTitle}
        >
          {J.pause}
        </button>
        <button
          type="button"
          onClick={resume}
          disabled={!canResume || busy}
          className="px-3 py-1.5 rounded bg-yellow-400 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          title={R.resumeTitle}
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

      <details className="mt-2">
        <summary className="text-sm text-white/70 cursor-pointer">
          {R.recent(recentRuns.length)}
        </summary>
        <table className="w-full text-xs mt-2">
          <thead className="text-white/50">
            <tr>
              <th className="text-left">{R.cols.finished}</th>
              <th>{R.cols.http}</th>
              <th>{R.cols.status}</th>
              <th>{R.cols.rows}</th>
              <th className="text-left">{R.cols.error}</th>
            </tr>
          </thead>
          <tbody>
            {recentRuns.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td>{new Date(r.finished_at).toLocaleTimeString('el-GR')}</td>
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
                  {R.noRuns}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </details>
      {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
      <ParseReport kind="results" year={job.year} runs={recentRuns} />
    </section>
  );
}

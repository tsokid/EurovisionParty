// src/admin/modules/parser/ParticipantsCard.tsx
// One-shot Participants parser card. Run Now starts the job and immediately
// invokes the edge function (so the admin sees the result live). On success
// the job transitions to `done`; Reset lifts it back to `idle`.

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
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

  const canRun = job.status === "idle" || job.status === "error";
  const canReset = job.status === "done" || job.status === "error";

  const runNow = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { error: rpcErr } = await supabase.rpc("start_parse_job", {
        p_year: job.year,
        p_kind: "participants",
      });
      if (rpcErr) throw rpcErr;
      const { error: fnErr } = await supabase.functions.invoke(
        "eurovision-parse",
        { body: { action: "participants" } },
      );
      if (fnErr) throw fnErr;
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { error: rpcErr } = await supabase.rpc("reset_parse_job", {
        p_year: job.year,
        p_kind: "participants",
      });
      if (rpcErr) throw rpcErr;
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">Participants Parser</h3>
        <StatusPill status={job.status} />
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
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={runNow}
          disabled={!canRun || busy}
          className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40"
        >
          Run Now
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!canReset || busy}
          className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40"
        >
          Reset
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

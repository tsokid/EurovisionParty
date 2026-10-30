// src/admin/modules/parser/FinalizeCard.tsx
// Terminal action: finalize the contest of the job's year through the
// finalize_contest lifecycle RPC (current -> finalized). It locks the
// results, stops the Results parser, scores every room of that year and
// computes winners. Two-click confirm; cannot be undone. A successful
// finalize publishes automatically (spec §7) through the shared
// invokePublish, which queues a trailing run when a publish is already
// in flight; a failed or busy publish is shown and the finalize stands
// (Publish again from the Contests module).
//
// "Reset Finalized" (reset_manual_results) is refused by the database
// once the contest is finalized or archived, so it is offered only while
// the contest of the job's year is still upcoming or current. Results of
// a finalized year are corrected through Contests (Edit + Republish).

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { formatError } from "../../lib/formatError";
import { invokePublish, outcomeText, type PublishOutcome } from "../contests/publish";
import type { ParseJob } from "./useParserState";

interface Props {
  job?: ParseJob;
  onRefresh: () => void;
}

export function FinalizeCard({ job, onRefresh }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Confirmation banner after success. finalize_contest returns the number
  // of rooms of the year whose winners it computed.
  const [report, setReport] = useState<{ winners: number } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<PublishOutcome | null>(null);
  // Stage of the job year's contest; null until loaded (or no contest row).
  const [stage, setStage] = useState<string | null>(null);

  const finalized = job?.status === "finalized";
  const year = job?.year;

  useEffect(() => {
    if (year === undefined) return;
    let live = true;
    supabase
      .from("contests")
      .select("stage")
      .eq("year", year)
      .maybeSingle()
      .then(({ data }) => {
        if (live) setStage((data as { stage?: string } | null)?.stage ?? null);
      });
    return () => {
      live = false;
    };
  }, [year, job?.status]);

  const contestLocked = stage === "finalized" || stage === "archived";
  // Unknown stage: keep the reset hidden rather than offer a refused action.
  const canReset = finalized && stage !== null && !contestLocked;

  const resetFinalized = async () => {
    if (!job) return;
    setBusy(true);
    setErr(null);
    setReport(null);
    try {
      const { error } = await supabase.rpc("reset_manual_results", {
        p_year: job.year,
      });
      if (error) throw error;
      onRefresh();
      setConfirmReset(false);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!job) return;
    setBusy(true);
    setErr(null);
    setReport(null);
    try {
      const { data, error } = await supabase.rpc("finalize_contest", {
        p_year: job.year,
      });
      if (error) throw error;
      setReport({ winners: typeof data === "number" ? data : 0 });
      setStage("finalized");

      onRefresh();
      setConfirm(false);
    } catch (e) {
      setErr(formatError(e));
      return;
    } finally {
      setBusy(false);
    }
    setPublishing(true);
    setPublished(null);
    try {
      setPublished(await invokePublish());
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="rounded-xl border border-red-400/30 bg-red-500/5 p-4">
      <h3 className="font-semibold text-red-300 mb-2">Finalize Contest</h3>
      <p className="text-sm text-white/70 mb-3">
        {job
          ? `Finalize ${job.year}: locks results, scores all rooms of ${job.year}, computes winners.`
          : "No results job loaded."}
      </p>
      <p className="text-xs text-white/50 mb-3">
        {contestLocked && job
          ? `To correct results of ${job.year}, edit its entries in Contests, then Publish.`
          : "This cannot be undone."}
      </p>
      {!confirm ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={!job || finalized || busy}
            className="px-3 py-1.5 rounded bg-red-500 text-white font-bold text-sm disabled:opacity-40"
          >
            {finalized ? "Already finalized" : `Finalize ${job?.year ?? ""}`.trim()}
          </button>
          {canReset && !confirmReset && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={busy}
              className="px-3 py-1.5 rounded bg-white/10 text-amber-300 font-bold text-sm disabled:opacity-40"
              title="Clears all results, resets scoring, and returns parser to idle so you can re-run."
            >
              ↺ Reset Finalized
            </button>
          )}
          {canReset && confirmReset && (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-amber-300/80">Clears scores + results for all rooms. Sure?</span>
              <button
                type="button"
                onClick={resetFinalized}
                disabled={busy}
                className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm disabled:opacity-40"
              >
                {busy ? "Resetting…" : "Yes, reset"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                disabled={busy}
                className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={finalize}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-red-500 text-white font-bold text-sm disabled:opacity-40"
          >
            {busy ? "Finalizing…" : `Yes, finalize ${job?.year ?? ""}`.trim()}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      )}
      {report && (
        <div className="mt-3 rounded bg-emerald-500/10 border border-emerald-400/30 p-3 text-xs sm:text-sm">
          <p className="font-semibold text-emerald-300">✅ {job?.year} finalized.</p>
          <p className="mt-1 text-white/75">
            Rooms of {job?.year} with winners computed:{" "}
            <span className="text-white font-bold tabular-nums">{report.winners}</span>
          </p>
        </div>
      )}
      {publishing && <p className="text-sm text-white/60 mt-2">Publishing…</p>}
      {published && (
        <p
          className={`text-sm mt-2 break-all ${
            published.status === "ok" || published.status === "noop"
              ? "text-emerald-300"
              : published.status === "busy"
                ? "text-amber-300"
                : "text-red-300"
          }`}
        >
          {outcomeText(published)}
          {published.warning && ` Warning: ${published.warning}`}
        </p>
      )}
      {err && <p className="text-sm text-red-300 mt-2 break-all">{err}</p>}
    </section>
  );
}

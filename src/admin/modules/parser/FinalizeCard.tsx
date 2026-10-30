// src/admin/modules/parser/FinalizeCard.tsx
// Terminal action: finalize the contest of the job's year through the
// finalize_contest lifecycle RPC (current -> finalized). It locks the
// results, stops the Results parser, scores every room of that year and
// computes winners. Two-click confirm; cannot be undone.

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { formatError } from "../../lib/formatError";
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

  const finalized = job?.status === "finalized";

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

      onRefresh();
      setConfirm(false);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
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
      <p className="text-xs text-white/50 mb-3">This cannot be undone.</p>
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
          {finalized && !confirmReset && (
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
          {finalized && confirmReset && (
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
      {err && <p className="text-sm text-red-300 mt-2 break-all">{err}</p>}
    </section>
  );
}

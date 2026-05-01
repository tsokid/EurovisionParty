// src/admin/modules/parser/FinalizeCard.tsx
// Terminal action: Finalize Results for the given year. Stops the Results
// parser permanently and unlocks Final phase for hosts. Two-click confirm;
// cannot be undone.

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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Confirmation banner after success: total rooms with predictions vs
  // rooms that actually got scored. The RPC returns rooms scored.
  const [report, setReport] = useState<{ scored: number; totalRooms: number; totalWithPredictions: number } | null>(null);

  const finalized = job?.status === "finalized";

  const finalize = async () => {
    if (!job) return;
    setBusy(true);
    setErr(null);
    setReport(null);
    try {
      const { data, error } = await supabase.rpc("finalize_results", {
        p_year: job.year,
      });
      if (error) throw error;

      // Sanity report: how many rooms had predictions vs how many got
      // scored. Uses the existing realtime queryable tables — no new
      // RPC needed.
      const [{ count: roomsWithPreds }, { count: scoredRooms }, { count: allRooms }] = await Promise.all([
        supabase.from("predictions").select("room_id", { count: "exact", head: true }),
        supabase.from("results").select("room_id", { count: "exact", head: true }),
        supabase.from("rooms").select("id", { count: "exact", head: true }),
      ]);
      setReport({
        scored: typeof data === "number" ? data : 0,
        totalRooms: allRooms ?? 0,
        totalWithPredictions: roomsWithPreds ?? scoredRooms ?? 0,
      });

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
      <h3 className="font-semibold text-red-300 mb-2">Finalize Results</h3>
      <p className="text-sm text-white/70 mb-3">
        Stops the Results parser permanently and propagates the scoreboard to
        every room with predictions. This cannot be undone.
      </p>
      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          disabled={finalized || busy}
          className="px-3 py-1.5 rounded bg-red-500 text-white font-bold text-sm disabled:opacity-40"
        >
          {finalized ? "Already finalized" : "Finalize"}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={finalize}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-red-500 text-white font-bold text-sm disabled:opacity-40"
          >
            {busy ? "Finalizing…" : "Yes, finalize"}
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
          <p className="font-semibold text-emerald-300">✅ Finalized.</p>
          <ul className="mt-1 text-white/75 space-y-0.5">
            <li>Rooms scored this run: <span className="text-white font-bold tabular-nums">{report.scored}</span></li>
            <li>Rooms with predictions: <span className="text-white font-bold tabular-nums">{report.totalWithPredictions}</span></li>
            <li>Total rooms in DB: <span className="text-white font-bold tabular-nums">{report.totalRooms}</span></li>
          </ul>
          {report.scored < report.totalWithPredictions && (
            <p className="mt-2 text-amber-300">
              ⚠️ Some prediction-bearing rooms didn&apos;t get scored. Check the Phase Monitor module for stragglers.
            </p>
          )}
        </div>
      )}
      {err && <p className="text-sm text-red-300 mt-2 break-all">{err}</p>}
    </section>
  );
}

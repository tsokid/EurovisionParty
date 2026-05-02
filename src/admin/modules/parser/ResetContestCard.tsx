// src/admin/modules/parser/ResetContestCard.tsx
// Full contest reset — clears both parse jobs, participants, results, and
// unscores all predictions. Use when switching to a new year / contest URL.

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { formatError } from "../../lib/formatError";

interface Props {
  year: number;
  onRefresh: () => void;
}

type Step = "idle" | "confirm1" | "confirm2" | "busy" | "done";

export function ResetContestCard({ year, onRefresh }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [err, setErr] = useState<string | null>(null);

  const reset = async () => {
    setStep("busy");
    setErr(null);
    try {
      const { error } = await supabase.rpc("reset_contest", { p_year: year });
      if (error) throw error;
      setStep("done");
      onRefresh();
    } catch (e) {
      setErr(formatError(e));
      setStep("confirm2");
    }
  };

  return (
    <section className="rounded-xl border border-orange-400/30 bg-orange-500/5 p-4">
      <h3 className="font-semibold text-orange-300 mb-1">Reset for New Contest</h3>
      <p className="text-sm text-white/60 mb-3">
        Clears all parsed participants &amp; results, unscores predictions,
        resets prediction points on players, and returns both parser jobs to{" "}
        <span className="font-mono text-white/80">idle</span>. Use when
        switching to a new year or re-running with a different source URL.
      </p>

      <ul className="text-xs text-white/45 mb-4 space-y-0.5 list-disc list-inside">
        <li>Deletes all rows in <span className="font-mono">eurovision_{year}_participants</span> (+ results cascade)</li>
        <li>Deletes all per-room <span className="font-mono">results</span> rows</li>
        <li>Un-scores all predictions (locked → unlocked, points → null)</li>
        <li>Resets <span className="font-mono">pred_points = 0</span>, recalculates <span className="font-mono">total_points</span></li>
        <li>Both parse jobs → <span className="font-mono">idle</span></li>
      </ul>

      {step === "idle" && (
        <button
          type="button"
          onClick={() => setStep("confirm1")}
          className="px-3 py-1.5 rounded bg-orange-500/80 hover:bg-orange-500 text-white font-bold text-sm transition-colors"
        >
          ↺ Reset Contest
        </button>
      )}

      {step === "confirm1" && (
        <div className="space-y-2">
          <p className="text-sm text-orange-300 font-semibold">
            ⚠ This will wipe all parsed data and un-score every room. Are you sure?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("confirm2")}
              className="px-3 py-1.5 rounded bg-orange-500 text-white font-bold text-sm"
            >
              Yes, continue
            </button>
            <button
              type="button"
              onClick={() => setStep("idle")}
              className="px-3 py-1.5 rounded bg-white/10 text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "confirm2" && (
        <div className="space-y-2">
          <p className="text-sm text-red-300 font-semibold">
            Final confirmation — this cannot be undone. Proceed?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded bg-red-600 text-white font-bold text-sm"
            >
              Yes, reset everything
            </button>
            <button
              type="button"
              onClick={() => setStep("idle")}
              className="px-3 py-1.5 rounded bg-white/10 text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "busy" && (
        <p className="text-sm text-orange-300 animate-pulse">Resetting…</p>
      )}

      {step === "done" && (
        <div className="rounded bg-emerald-500/10 border border-emerald-400/30 p-3 text-sm">
          <p className="font-semibold text-emerald-300">✅ Reset complete.</p>
          <p className="text-white/60 text-xs mt-1">
            Both parser jobs are now idle. Update the source URLs if needed, then run Participants first.
          </p>
          <button
            type="button"
            onClick={() => setStep("idle")}
            className="mt-2 px-3 py-1 rounded bg-white/10 text-white text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {err && <p className="text-sm text-red-300 mt-2 break-all">{err}</p>}
    </section>
  );
}

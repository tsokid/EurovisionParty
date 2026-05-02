// src/admin/modules/parser/ResetContestCard.tsx
// Full contest reset with optional deep-clean flags.
// Core reset (parsed data + jobs) always runs. Three optional steps
// let the host decide how far to wipe game state.

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { formatError } from "../../lib/formatError";

interface Props {
  year: number;
  onRefresh: () => void;
}

type Step = "idle" | "options" | "confirm" | "busy" | "done";

interface Options {
  deletePredictions: boolean;
  resetPoints: boolean;
  deleteRooms: boolean;
}

const CORE_ITEMS = [
  "Clears parsed participants & results",
  "Un-scores predictions (keeps them, unlocks them)",
  "Resets pred_points, recalculates total_points",
  "Both parse jobs → idle",
];

export function ResetContestCard({ year, onRefresh }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [opts, setOpts] = useState<Options>({ deletePredictions: false, resetPoints: false, deleteRooms: false });
  const [err, setErr] = useState<string | null>(null);

  const toggle = (key: keyof Options) => {
    setOpts((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Selecting deleteRooms implies and overrides A + B (cascade handles them)
      if (key === "deleteRooms" && next.deleteRooms) {
        next.deletePredictions = false;
        next.resetPoints = false;
      }
      return next;
    });
  };

  const reset = async () => {
    setStep("busy");
    setErr(null);
    try {
      const { error } = await supabase.rpc("reset_contest", {
        p_year: year,
        p_delete_predictions: opts.deletePredictions,
        p_reset_points: opts.resetPoints,
        p_delete_rooms: opts.deleteRooms,
      });
      if (error) throw error;
      setStep("done");
      onRefresh();
    } catch (e) {
      setErr(formatError(e));
      setStep("confirm");
    }
  };

  const cancel = () => { setStep("idle"); setOpts({ deletePredictions: false, resetPoints: false, deleteRooms: false }); setErr(null); };

  // Build a plain-language summary of what will happen
  const summary: string[] = [...CORE_ITEMS];
  if (opts.deleteRooms) {
    summary.push("⚠ Deletes ALL rooms → cascades to players, predictions, results, quiz, duels, winners");
  } else {
    if (opts.deletePredictions) summary.push("Deletes all predictions (cannot be re-entered)");
    if (opts.resetPoints) summary.push("Zeros quiz + duel + pred points on every player");
  }

  return (
    <section className="rounded-xl border border-orange-400/30 bg-orange-500/5 p-4">
      <h3 className="font-semibold text-orange-300 mb-1">Reset for New Contest</h3>
      <p className="text-sm text-white/60 mb-3">
        Always clears parsed data and returns parser jobs to idle.
        Choose how deep to wipe game state below.
      </p>

      {/* ── Idle ── */}
      {step === "idle" && (
        <button
          type="button"
          onClick={() => setStep("options")}
          className="px-3 py-1.5 rounded bg-orange-500/80 hover:bg-orange-500 text-white font-bold text-sm transition-colors"
        >
          ↺ Reset Contest…
        </button>
      )}

      {/* ── Options ── */}
      {step === "options" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1.5">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">Always included</p>
            {CORE_ITEMS.map((item) => (
              <p key={item} className="text-xs text-white/55 flex gap-2">
                <span className="text-emerald-400 flex-shrink-0">✓</span> {item}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Also wipe…</p>

            <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${opts.deletePredictions && !opts.deleteRooms ? "border-orange-400/40 bg-orange-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"} ${opts.deleteRooms ? "opacity-40 pointer-events-none" : ""}`}>
              <input
                type="checkbox"
                checked={opts.deletePredictions}
                onChange={() => toggle("deletePredictions")}
                disabled={opts.deleteRooms}
                className="mt-0.5 accent-orange-400"
              />
              <div>
                <p className="text-sm font-semibold text-white">A — Delete all predictions</p>
                <p className="text-xs text-white/50 mt-0.5">Removes every player's picks. They'd have to re-submit for the new contest.</p>
              </div>
            </label>

            <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${opts.resetPoints && !opts.deleteRooms ? "border-orange-400/40 bg-orange-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"} ${opts.deleteRooms ? "opacity-40 pointer-events-none" : ""}`}>
              <input
                type="checkbox"
                checked={opts.resetPoints}
                onChange={() => toggle("resetPoints")}
                disabled={opts.deleteRooms}
                className="mt-0.5 accent-orange-400"
              />
              <div>
                <p className="text-sm font-semibold text-white">B — Reset all player points</p>
                <p className="text-xs text-white/50 mt-0.5">Zeros quiz, duel, and prediction points on every player across all rooms.</p>
              </div>
            </label>

            <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${opts.deleteRooms ? "border-red-400/40 bg-red-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
              <input
                type="checkbox"
                checked={opts.deleteRooms}
                onChange={() => toggle("deleteRooms")}
                className="mt-0.5 accent-red-400"
              />
              <div>
                <p className="text-sm font-semibold text-white">C — Delete all rooms / games</p>
                <p className="text-xs text-white/50 mt-0.5">Nuclear option. Deletes every room and cascades to players, predictions, results, winners, quiz sessions, duels — everything. Implies A + B.</p>
              </div>
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStep("confirm")}
              className="px-3 py-1.5 rounded bg-orange-500 text-white font-bold text-sm"
            >
              Continue →
            </button>
            <button type="button" onClick={cancel} className="px-3 py-1.5 rounded bg-white/10 text-white text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm ── */}
      {step === "confirm" && (
        <div className="space-y-3">
          <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Will execute</p>
            {summary.map((item) => (
              <p key={item} className="text-xs text-white/70 flex gap-2">
                <span className={item.startsWith("⚠") ? "text-red-400" : "text-orange-400"}>→</span> {item}
              </p>
            ))}
          </div>
          <p className="text-sm font-semibold text-red-300">This cannot be undone. Proceed?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
            >
              Yes, reset everything
            </button>
            <button type="button" onClick={cancel} className="px-3 py-1.5 rounded bg-white/10 text-white text-sm">
              Cancel
            </button>
          </div>
          {err && <p className="text-sm text-red-300 break-all">{err}</p>}
        </div>
      )}

      {/* ── Busy ── */}
      {step === "busy" && (
        <p className="text-sm text-orange-300 animate-pulse">Resetting…</p>
      )}

      {/* ── Done ── */}
      {step === "done" && (
        <div className="rounded bg-emerald-500/10 border border-emerald-400/30 p-3 text-sm space-y-1">
          <p className="font-semibold text-emerald-300">✅ Reset complete.</p>
          <ul className="text-xs text-white/55 space-y-0.5">
            {summary.map((item) => (
              <li key={item}>· {item.replace(/^⚠ /, "")}</li>
            ))}
          </ul>
          <p className="text-xs text-white/40 pt-1">Update source URLs if needed, then run Participants first.</p>
          <button type="button" onClick={cancel} className="mt-1 px-3 py-1 rounded bg-white/10 text-white text-xs">
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}

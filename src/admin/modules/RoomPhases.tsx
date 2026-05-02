// src/admin/modules/RoomPhases.tsx
// Admin escape hatch for bulk-flipping every room currently in
// phase X to phase Y. The normal flow is automatic (host advances
// lobby → pre_night, participants parser → predictions_open, results
// parser → final). This is for misfires.

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { formatError } from "../lib/formatError";

const PHASES = [
  { id: "lobby", label: "Lobby" },
  { id: "pre_night", label: "Pre-Night Show" },
  { id: "predictions_open", label: "Predictions Open" },
  { id: "voting_live", label: "Voting Live" },
  { id: "final", label: "Final" },
] as const;

type Phase = typeof PHASES[number]["id"];

export default function RoomPhases() {
  const [from, setFrom] = useState<Phase>("pre_night");
  const [to, setTo] = useState<Phase>("predictions_open");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  const submit = async () => {
    if (from === to) {
      setErr("from and to must differ");
      return;
    }
    if (
      !window.confirm(
        `Flip every room currently in '${from}' to '${to}'? This cannot be undone from the UI.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc("admin_advance_all_rooms", {
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      setResult(typeof data === "number" ? data : 0);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <header>
        <h2 className="text-xl font-bold text-white">🎬 Room Phases</h2>
        <p className="text-sm text-white/60 mt-1">
          Bulk-flip every room currently in one phase to another. The normal
          flow is automatic — host advances lobby → pre_night, participants
          parser opens predictions, results parser ends the game. Use this
          only when the automation misfires.
        </p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4 max-w-xl">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <label className="text-sm text-white/80 flex flex-col gap-1">
            <span className="text-xs text-white/50 uppercase tracking-wide">From</span>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value as Phase)}
              className="bg-[#1a0a2e] border border-white/15 text-white rounded px-2 py-1.5"
            >
              {PHASES.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#1a0a2e] text-white">{p.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-white/80 flex flex-col gap-1">
            <span className="text-xs text-white/50 uppercase tracking-wide">To</span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value as Phase)}
              className="bg-[#1a0a2e] border border-white/15 text-white rounded px-2 py-1.5"
            >
              {PHASES.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#1a0a2e] text-white">{p.label}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy || from === to}
          className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
        >
          {busy ? "Working…" : `Flip all rooms ${from} → ${to}`}
        </button>

        {result !== null && (
          <p className="text-sm text-emerald-300 mt-3">
            ✅ Flipped {result} room{result === 1 ? "" : "s"}. Each active
            player got a notification.
          </p>
        )}
        {err && <p className="text-sm text-red-300 mt-3">{err}</p>}
      </section>

      <p className="text-xs text-white/40 max-w-xl">
        Notifications are sent only to players currently in flipped rooms; the
        client-side notification panel handles the banner.
      </p>
    </div>
  );
}

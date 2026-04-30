// src/admin/modules/parser/FinalizeCard.tsx
// Terminal action: Finalize Results 2026. Stops the Results parser permanently
// and unlocks Final phase for hosts. Two-click confirm; cannot be undone.

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { ParseJob } from "./useParserState";

interface Props {
  job?: ParseJob;
  onRefresh: () => void;
}

export function FinalizeCard({ job, onRefresh }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const finalized = job?.status === "finalized";

  const finalize = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc("finalize_results", {
        p_year: 2026,
      });
      if (error) throw error;
      onRefresh();
      setConfirm(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-red-400/30 bg-red-500/5 p-4">
      <h3 className="font-semibold text-red-300 mb-2">
        Finalize Results 2026
      </h3>
      <p className="text-sm text-white/70 mb-3">
        Stops the Results parser permanently. Hosts can advance their rooms to
        Final phase. This cannot be undone.
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
            Yes, finalize
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
      {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
    </section>
  );
}

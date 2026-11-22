// src/admin/modules/parser/GamePhaseCard.tsx
// The owner's phase buttons for one contest year (migration 079): Open
// predictions when the grand final starts, Close predictions when the
// televote opens. Finalize (its own card) ends the games. Each button
// moves every room of the year that has left the lobby and is not final;
// rooms that leave the lobby later land on the year's phase. Parsing never
// moves rooms.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { formatError } from "../../lib/formatError";
import { t } from "../../i18n";

type GamePhase = "pre_night" | "predictions_open" | "voting_live" | "final";
type Target = "pre_night" | "predictions_open" | "voting_live";

const T = t.parserUi.phase;
const PHASE_LABEL: Record<string, string> = T.labels;

const ACTION: Record<Target, { button: string; confirm: (y: number) => string }> = {
  predictions_open: { button: T.open, confirm: T.openConfirm },
  voting_live: { button: T.close, confirm: T.closeConfirm },
  pre_night: { button: T.back, confirm: T.backConfirm },
};

interface Props {
  year: number;
  pollMs?: number;
}

export function GamePhaseCard({ year, pollMs = 5000 }: Props) {
  const [gamePhase, setGamePhase] = useState<GamePhase | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [moved, setMoved] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase.from("contests").select("game_phase").eq("year", year).maybeSingle(),
      supabase.from("rooms").select("phase").eq("year", year),
    ]);
    if (c.error || r.error) {
      setErr(formatError(c.error ?? r.error));
      return;
    }
    setGamePhase(((c.data as { game_phase: GamePhase } | null)?.game_phase) ?? null);
    const next: Record<string, number> = {};
    for (const row of (r.data ?? []) as { phase: string }[]) next[row.phase] = (next[row.phase] ?? 0) + 1;
    setCounts(next);
  }, [year]);

  useEffect(() => {
    setMoved(null);
    setConfirm(null);
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  const run = async (target: Target) => {
    setBusy(true);
    setErr(null);
    setMoved(null);
    try {
      const { data, error } = await supabase.rpc("set_game_phase", { p_year: year, p_phase: target });
      if (error) throw error;
      setMoved(typeof data === "number" ? data : 0);
      setConfirm(null);
      await load();
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const isFinal = gamePhase === "final";
  const canOpen = gamePhase !== null && gamePhase !== "predictions_open";
  const canClose = gamePhase === "predictions_open";
  const canBack = gamePhase === "predictions_open" || gamePhase === "voting_live";
  const summary = Object.keys(PHASE_LABEL)
    .filter((p) => counts[p])
    .map((p) => `${PHASE_LABEL[p]}: ${counts[p]}`)
    .join(" · ");

  return (
    <section className="rounded-xl border border-sky-400/30 bg-sky-500/5 p-4">
      <h3 className="font-semibold text-sky-300 mb-2">{T.title(year)}</h3>
      <p className="text-sm text-white/70 mb-1">
        {T.now} <span className="text-white font-semibold">{gamePhase ? PHASE_LABEL[gamePhase] : "…"}</span>
      </p>
      <p className="text-xs text-white/50 mb-3">
        {T.rooms(year, summary)}
      </p>
      {isFinal && (
        <p className="text-xs text-amber-300/80 mb-3">
          {T.finalized(year)}
        </p>
      )}

      {confirm ? (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-white/80">{ACTION[confirm].confirm(year)}</span>
          <button
            type="button"
            onClick={() => run(confirm)}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-sky-500 text-black font-bold text-sm disabled:opacity-40"
          >
            {busy ? t.parserUi.working : t.parserUi.yes}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(null)}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40"
          >
            {t.parserUi.cancel}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirm("predictions_open")}
            disabled={!canOpen}
            className="px-3 py-1.5 rounded bg-sky-500 text-black font-bold text-sm disabled:opacity-40"
          >
            {ACTION.predictions_open.button}
          </button>
          <button
            type="button"
            onClick={() => setConfirm("voting_live")}
            disabled={!canClose}
            className="px-3 py-1.5 rounded bg-fuchsia-500 text-white font-bold text-sm disabled:opacity-40"
          >
            {ACTION.voting_live.button}
          </button>
          {canBack && (
            <button
              type="button"
              onClick={() => setConfirm("pre_night")}
              className="px-3 py-1.5 rounded bg-white/10 text-amber-300 font-bold text-sm"
            >
              {ACTION.pre_night.button}
            </button>
          )}
        </div>
      )}

      {moved !== null && (
        <p className="text-sm text-emerald-300 mt-3">
          {T.moved(moved)}
        </p>
      )}
      {err && <p className="text-sm text-red-300 mt-3">{err}</p>}
    </section>
  );
}

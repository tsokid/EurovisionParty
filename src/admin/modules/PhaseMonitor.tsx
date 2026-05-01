// src/admin/modules/PhaseMonitor.tsx
// At-a-glance KPI of where every active room currently sits in the
// game phase progression. Used to verify the parser triggers landed
// each room in the expected phase, and to spot stragglers that need
// manual advancement (the Room Phases module handles bulk flipping).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { formatError } from "../lib/formatError";

const PHASES = [
  { id: "lobby", label: "Lobby", color: "bg-white/15 text-white" },
  { id: "pre_night", label: "Pre-Night", color: "bg-blue-500/20 text-blue-300" },
  { id: "predictions_open", label: "Predictions Open", color: "bg-violet-500/25 text-violet-200" },
  { id: "voting_live", label: "Voting Live", color: "bg-pink-500/25 text-pink-200" },
  { id: "final", label: "Final", color: "bg-emerald-500/25 text-emerald-200" },
] as const;

interface RoomRow {
  id: string;
  code: string;
  phase: string;
  phase_updated_at: string | null;
  player_count: number;
}

interface ParserStatus {
  participants: string | null;
  results: string | null;
}

export default function PhaseMonitor() {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [parser, setParser] = useState<ParserStatus>({ participants: null, results: null });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [{ data: r, error: rErr }, { data: j, error: jErr }] = await Promise.all([
        supabase
          .from("rooms")
          .select("id, code, phase, phase_updated_at, players:players(count)")
          .order("phase_updated_at", { ascending: false }),
        supabase
          .from("parse_jobs")
          .select("kind, status")
          .eq("year", 2026),
      ]);
      if (rErr) throw rErr;
      if (jErr) throw jErr;

      type RawRoom = { id: string; code: string; phase: string; phase_updated_at: string | null; players: { count: number }[] };
      const mapped: RoomRow[] = (r ?? []).map((row) => {
        const raw = row as RawRoom;
        return {
          id: raw.id,
          code: raw.code,
          phase: raw.phase,
          phase_updated_at: raw.phase_updated_at,
          player_count: raw.players?.[0]?.count ?? 0,
        };
      });
      setRooms(mapped);

      const ps = (j ?? []).reduce<ParserStatus>(
        (acc, row) => {
          const r = row as { kind: string; status: string };
          if (r.kind === "participants") acc.participants = r.status;
          if (r.kind === "results") acc.results = r.status;
          return acc;
        },
        { participants: null, results: null },
      );
      setParser(ps);
      setRefreshedAt(new Date());
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Counts per phase (always 5 buckets, missing = 0).
  const counts = PHASES.map((p) => ({
    ...p,
    n: rooms.filter((r) => r.phase === p.id).length,
  }));
  const total = rooms.length;

  // Expected phase given parser state — purely advisory.
  const expectedPhase: string =
    parser.results === "finalized"
      ? "final"
      : parser.results === "running"
      ? "voting_live"
      : parser.participants === "done"
      ? "predictions_open"
      : "pre_night";

  const stragglers = rooms.filter((r) => r.phase !== expectedPhase && r.phase !== "lobby");

  return (
    <div className="p-4 space-y-4">
      <header>
        <h2 className="text-xl font-bold text-white">📊 Phase Monitor</h2>
        <p className="text-sm text-white/60 mt-1">
          Live count of rooms per phase. Refreshes every 15s.{" "}
          {refreshedAt && (
            <span className="text-white/40">
              · last updated {refreshedAt.toLocaleTimeString()}
            </span>
          )}
        </p>
      </header>

      {/* Parser status strip */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-wrap items-center gap-3 text-sm">
        <div>
          <span className="text-white/55 text-xs uppercase tracking-wide mr-2">Participants</span>
          <span className="font-bold text-white tabular-nums">
            {parser.participants ?? "—"}
          </span>
        </div>
        <div>
          <span className="text-white/55 text-xs uppercase tracking-wide mr-2">Results</span>
          <span className="font-bold text-white tabular-nums">
            {parser.results ?? "—"}
          </span>
        </div>
        <div className="ml-auto text-xs text-white/55">
          Expected phase from parser state:{" "}
          <span className="font-bold text-white">
            {PHASES.find((p) => p.id === expectedPhase)?.label ?? expectedPhase}
          </span>
        </div>
      </section>

      {/* KPI grid: one tile per phase */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {counts.map((p) => {
          const pct = total > 0 ? Math.round((p.n / total) * 100) : 0;
          const isExpected = p.id === expectedPhase;
          return (
            <div
              key={p.id}
              className={`rounded-xl border p-3 ${
                isExpected ? "border-euro-gold/50 bg-euro-gold/5" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <p className={`text-xs sm:text-sm font-bold uppercase tracking-wide rounded px-2 py-1 inline-block ${p.color}`}>
                {p.label}
              </p>
              <p className="text-3xl font-extrabold text-white mt-2 tabular-nums">{p.n}</p>
              <p className="text-xs text-white/55 tabular-nums">{pct}% of {total}</p>
            </div>
          );
        })}
      </section>

      {/* Stragglers — rooms not where they should be */}
      {stragglers.length > 0 && (
        <section className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
          <p className="text-sm font-bold text-amber-300 mb-2">
            ⚠️ {stragglers.length} room{stragglers.length === 1 ? "" : "s"} not in expected phase
            <span className="text-white/55 font-normal ml-1">
              (use the Room Phases module to bulk-advance)
            </span>
          </p>
          <ul className="text-xs sm:text-sm text-white/80 space-y-1 max-h-48 overflow-y-auto">
            {stragglers.slice(0, 25).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-2 py-1 rounded hover:bg-white/5">
                <span className="font-mono tracking-wide">{r.code}</span>
                <span className="text-white/55 tabular-nums">{r.player_count} player{r.player_count === 1 ? "" : "s"}</span>
                <span className="text-white/85 capitalize">{r.phase.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recently-flipped rooms */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-sm font-bold text-white/80 mb-2">All rooms · most recent first</p>
        {loading && rooms.length === 0 ? (
          <p className="text-sm text-white/50">Loading…</p>
        ) : (
          <ul className="text-xs sm:text-sm text-white/80 space-y-1 max-h-72 overflow-y-auto">
            {rooms.slice(0, 50).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-2 py-1">
                <span className="font-mono tracking-wide">{r.code}</span>
                <span className="text-white/85 capitalize w-32 sm:w-40 text-right">{r.phase.replace(/_/g, " ")}</span>
                <span className="text-white/45 tabular-nums w-16 text-right">{r.player_count}p</span>
                <span className="text-white/40 tabular-nums text-xs hidden sm:inline">
                  {r.phase_updated_at ? new Date(r.phase_updated_at).toLocaleTimeString() : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {err && <p className="text-sm text-red-300">{err}</p>}
    </div>
  );
}

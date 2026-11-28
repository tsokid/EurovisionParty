// src/admin/modules/PhaseMonitor.tsx
// At-a-glance KPI of where every active room currently sits in the
// game phase progression. Used to verify the parser triggers landed
// each room in the expected phase, and to spot stragglers that need
// manual advancement (the Game phase card on the Parser page moves a year's rooms).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { formatError } from "../lib/formatError";
import { fetchLiveContestYear } from "../../lib/liveContestYear";
import { t } from '../i18n';
import { visibleInterval } from '../../lib/visibleInterval';

const PHASES = [
  { id: "lobby", label: t.monitor.phases.lobby, color: "bg-white/15 text-white" },
  { id: "pre_night", label: t.monitor.phases.pre_night, color: "bg-blue-500/20 text-blue-300" },
  { id: "predictions_open", label: t.monitor.phases.predictions_open, color: "bg-violet-500/25 text-violet-200" },
  { id: "voting_live", label: t.monitor.phases.voting_live, color: "bg-pink-500/25 text-pink-200" },
  { id: "final", label: t.monitor.phases.final, color: "bg-emerald-500/25 text-emerald-200" },
] as const;

interface RoomRow {
  id: string;
  code: string;
  phase: string;
  phase_updated_at: string | null;
  player_count: number;
  host_name: string | null;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const liveYear = await fetchLiveContestYear();
      const [{ data: r, error: rErr }, { data: j, error: jErr }, { data: hosts, error: hErr }] =
        await Promise.all([
          supabase
            .from("rooms")
            .select("id, code, phase, phase_updated_at, players:players(count)")
            .order("phase_updated_at", { ascending: false }),
          supabase
            .from("parse_jobs")
            .select("kind, status")
            .eq("year", liveYear),
          supabase
            .from("players")
            .select("room_id, name")
            .eq("is_host", true),
        ]);
      if (rErr) throw rErr;
      if (jErr) throw jErr;
      if (hErr) throw hErr;

      const hostByRoom = new Map<string, string>();
      for (const h of hosts ?? []) {
        const row = h as { room_id: string; name: string };
        hostByRoom.set(row.room_id, row.name);
      }

      type RawRoom = { id: string; code: string; phase: string; phase_updated_at: string | null; players: { count: number }[] };
      const mapped: RoomRow[] = (r ?? []).map((row) => {
        const raw = row as RawRoom;
        return {
          id: raw.id,
          code: raw.code,
          phase: raw.phase,
          phase_updated_at: raw.phase_updated_at,
          player_count: raw.players?.[0]?.count ?? 0,
          host_name: hostByRoom.get(raw.id) ?? null,
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
    // Only while the admin tab is visible (28 Nov 2026).
    return visibleInterval(() => { void refresh(); }, 15_000);
  }, [refresh]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === rooms.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rooms.map((r) => r.id)));
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const codes = rooms
      .filter((r) => selected.has(r.id))
      .map((r) => r.code)
      .join(", ");
    if (!window.confirm(t.monitor.confirmDelete(selected.size, codes))) return;

    setDeleting(true);
    setErr(null);
    try {
      const { error } = await supabase
        .from("rooms")
        .delete()
        .in("id", [...selected]);
      if (error) throw error;
      setSelected(new Set());
      await refresh();
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setDeleting(false);
    }
  };

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

  const allChecked = rooms.length > 0 && selected.size === rooms.length;
  const someChecked = selected.size > 0 && selected.size < rooms.length;

  const RoomListItem = ({ r, showCheckbox = true }: { r: RoomRow; showCheckbox?: boolean }) => (
    <li
      key={r.id}
      className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
        selected.has(r.id) ? "bg-red-500/10" : "hover:bg-white/5"
      }`}
    >
      {showCheckbox && (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggleSelect(r.id)}
          className="accent-red-400 cursor-pointer shrink-0"
        />
      )}
      <span className="font-mono tracking-wide w-20 shrink-0">{r.code}</span>
      <span className="text-white/55 truncate flex-1 min-w-0 text-xs">
        {r.host_name ?? <span className="text-white/25 italic">{t.monitor.noHost}</span>}
      </span>
      <span className="text-white/55 tabular-nums text-xs shrink-0">{r.player_count}p</span>
      <span className="text-white/85 capitalize text-xs shrink-0 w-28 text-right">
        {r.phase.replace(/_/g, " ")}
      </span>
    </li>
  );

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-stage-text m-0">{t.monitor.title}</h2>
        <p className="text-sm text-white/60 mt-1">
          {t.monitor.lede}{" "}
          {refreshedAt && (
            <span className="text-white/40">
              {t.monitor.updated(refreshedAt.toLocaleTimeString('el-GR', { hourCycle: 'h23' }))}
            </span>
          )}
        </p>
      </header>

      {/* Parser status strip */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-wrap items-center gap-3 text-sm">
        <div>
          <span className="text-white/55 text-xs uppercase tracking-wide mr-2">{t.monitor.participants}</span>
          <span className="font-bold text-white tabular-nums">
            {parser.participants ?? "—"}
          </span>
        </div>
        <div>
          <span className="text-white/55 text-xs uppercase tracking-wide mr-2">{t.monitor.results}</span>
          <span className="font-bold text-white tabular-nums">
            {parser.results ?? "—"}
          </span>
        </div>
        <div className="ml-auto text-xs text-white/55">
          {t.monitor.expected}{" "}
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
              <p className="text-xs text-white/55 tabular-nums">{t.monitor.pctOf(pct, total)}</p>
            </div>
          );
        })}
      </section>

      {/* Stragglers — rooms not where they should be */}
      {stragglers.length > 0 && (
        <section className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
          <p className="text-sm font-bold text-amber-300 mb-2">
            ⚠️ {t.monitor.stragglers(stragglers.length)}
            <span className="text-white/55 font-normal ml-1">
              {t.monitor.stragglersHint}
            </span>
          </p>
          <ul className="text-xs sm:text-sm text-white/80 space-y-0.5 max-h-48 overflow-y-auto">
            {stragglers.slice(0, 25).map((r) => (
              <RoomListItem key={r.id} r={r} showCheckbox={false} />
            ))}
          </ul>
        </section>
      )}

      {/* All rooms with select / delete */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-3 mb-2">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => { if (el) el.indeterminate = someChecked; }}
            onChange={toggleSelectAll}
            className="accent-red-400 cursor-pointer"
            aria-label={t.monitor.selectAll}
          />
          <p className="text-sm font-bold text-white/80 flex-1">
            {t.monitor.all}
          </p>
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="px-3 py-1 rounded bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
            >
              {deleting ? t.monitor.deleting : t.monitor.deleteN(selected.size)}
            </button>
          )}
          <button
            onClick={() => { refresh(); setSelected(new Set()); }}
            disabled={loading}
            className="text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
          >
            {t.monitor.refresh}
          </button>
        </div>

        {loading && rooms.length === 0 ? (
          <p className="text-sm text-white/50">{t.common.loading}</p>
        ) : (
          <ul className="text-xs sm:text-sm text-white/80 space-y-0.5 max-h-96 overflow-y-auto">
            {rooms.slice(0, 100).map((r) => (
              <RoomListItem key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>

      {err && <p className="text-sm text-red-300">{err}</p>}
    </div>
  );
}

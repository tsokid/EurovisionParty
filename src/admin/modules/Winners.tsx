import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const CATEGORIES = ['champion', 'thief', 'duelist', 'oracle', 'guru'] as const;
type Category = typeof CATEGORIES[number];

const CAT_LABELS: Record<Category, { emoji: string; label: string; metric: string }> = {
  champion: { emoji: '👑', label: 'Champion', metric: 'Total points' },
  thief:    { emoji: '🦹', label: 'Thief',    metric: 'Points stolen' },
  duelist:  { emoji: '⚔️', label: 'Duelist',  metric: 'Duels won' },
  oracle:   { emoji: '🔮', label: 'Oracle',   metric: 'Prediction points' },
  guru:     { emoji: '🧠', label: 'Guru',     metric: 'Correct trivia' },
};

interface Room {
  id: string;
  code: string;
  phase: string;
  created_at: string;
  host_name?: string | null;
}

interface Player {
  id: string;
  name: string;
  total_points: number;
  is_host?: boolean | null;
}

// Map room id -> host player name. Built once when rooms are loaded by
// querying players where is_host=true. Falls back to rooms.host_name when
// the host record is missing (rare — happens if the host left the room).
type HostMap = Record<string, string>;

interface Winner {
  id: string;
  category: Category;
  player_id: string;
  metric_value: number;
  is_sudden_death_winner: boolean;
}

export default function Winners() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [hostMap, setHostMap] = useState<HostMap>({});
  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Load rooms + host players in one shot. We need both because:
  //   - rooms.host_name is the denormalized text the host typed at create time
  //   - players.is_host=true is the live link to the actual host player row
  // The live player record is the source of truth; rooms.host_name is the
  // fallback in case the host has left the room (player row may be gone).
  useEffect(() => {
    (async () => {
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('id, code, phase, created_at, host_name')
        .order('created_at', { ascending: false })
        .limit(50);
      if (roomErr) { setMsg({ kind: 'err', text: roomErr.message }); return; }
      const rs = (roomData ?? []) as Room[];
      setRooms(rs);
      if (rs.length > 0 && !roomId) setRoomId(rs[0].id);

      // Pull hosts for those rooms in a single query
      if (rs.length > 0) {
        const ids = rs.map((r) => r.id);
        const { data: hostPlayers } = await supabase
          .from('players')
          .select('room_id, name')
          .eq('is_host', true)
          .in('room_id', ids);
        const map: HostMap = {};
        for (const r of rs) {
          // Prefer live player.name; fall back to rooms.host_name; final fallback '—'
          const live = (hostPlayers ?? []).find((h) => (h as { room_id: string }).room_id === r.id);
          map[r.id] = (live as { name?: string } | undefined)?.name
            ?? r.host_name
            ?? '—';
        }
        setHostMap(map);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRoom = useCallback(async (rid: string) => {
    const [{ data: pl }, { data: wn }] = await Promise.all([
      supabase.from('players').select('id, name, total_points, is_host').eq('room_id', rid).order('total_points', { ascending: false }),
      supabase.from('winners').select('id, category, player_id, metric_value, is_sudden_death_winner').eq('room_id', rid),
    ]);
    setPlayers((pl ?? []) as Player[]);
    setWinners((wn ?? []) as Winner[]);
  }, []);

  useEffect(() => { if (roomId) loadRoom(roomId); }, [roomId, loadRoom]);

  async function compute() {
    if (!roomId) return;
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc('compute_winners', { p_room_id: roomId });
    setBusy(false);
    if (error) { setMsg({ kind: 'err', text: error.message }); return; }
    setMsg({ kind: 'ok', text: `Computed ${data ?? 0} winner row(s).` });
    await loadRoom(roomId);
  }

  async function clearAll() {
    if (!roomId) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('admin_clear_winners', { p_room_id: roomId });
    setBusy(false);
    if (error) { setMsg({ kind: 'err', text: error.message }); return; }
    setMsg({ kind: 'ok', text: 'Cleared all winners for this room.' });
    await loadRoom(roomId);
  }

  async function override(category: Category, playerId: string) {
    if (!roomId) return;
    setBusy(true); setMsg(null);
    const player = players.find((p) => p.id === playerId);
    const { error } = await supabase.rpc('admin_set_winner', {
      p_room_id: roomId,
      p_category: category,
      p_player_id: playerId,
      p_metric: player?.total_points ?? 0,
    });
    setBusy(false);
    if (error) { setMsg({ kind: 'err', text: error.message }); return; }
    setMsg({ kind: 'ok', text: `${CAT_LABELS[category].label} → ${player?.name ?? '—'}.` });
    await loadRoom(roomId);
  }

  const winnersByCat = (cat: Category) => winners.filter((w) => w.category === cat);
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? '—';

  const room = rooms.find((r) => r.id === roomId);

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h2 className="text-xl font-bold text-white">🏆 Winners</h2>
        <p className="text-sm text-white/60 mt-1">
          Compute or override the five winner categories for any room. Co-winners are supported (multiple rows per category).
        </p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider font-semibold block mb-2">Room</label>
          <select
            value={roomId ?? ''}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
          >
            {rooms.length === 0 && <option>No rooms yet</option>}
            {rooms.map((r) => (
              <option key={r.id} value={r.id} className="bg-euro-purple-dark">
                {r.code} · host: {hostMap[r.id] ?? r.host_name ?? '—'} · {r.phase} · {new Date(r.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
          {room && (
            <p className="text-xs text-white/40 mt-2">
              Host: <span className="text-white/85 font-semibold">{hostMap[room.id] ?? room.host_name ?? '—'}</span>
              {' · '}
              ID: <span className="font-mono">{room.id.slice(0, 8)}…</span>
              {' · '}
              Players: {players.length}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={compute}
            disabled={busy || !roomId}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg disabled:opacity-40 transition"
          >
            Compute winners
          </button>
          <button
            onClick={clearAll}
            disabled={busy || !roomId || winners.length === 0}
            className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 font-bold rounded-lg disabled:opacity-40 transition"
          >
            Clear all
          </button>
          {msg && (
            <span className={`self-center text-sm ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
              {msg.text}
            </span>
          )}
        </div>
      </section>

      <section className="space-y-3">
        {CATEGORIES.map((cat) => {
          const ws = winnersByCat(cat);
          const meta = CAT_LABELS[cat];
          return (
            <div key={cat} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <span className="text-xl" aria-hidden>{meta.emoji}</span> {meta.label}
                  </h3>
                  <p className="text-xs text-white/40">Metric: {meta.metric}</p>
                </div>
                <div>
                  {ws.length === 0 && <span className="text-white/40 text-sm italic">— no winner —</span>}
                  {ws.map((w) => (
                    <span
                      key={w.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-euro-pink/15 border border-euro-pink/30 text-euro-pink-light text-sm font-bold mr-2"
                    >
                      {playerName(w.player_id)}
                      <span className="text-white/50 font-normal">· {w.metric_value}</span>
                      {w.is_sudden_death_winner && <span className="text-euro-gold text-xs">SD</span>}
                    </span>
                  ))}
                </div>
              </div>
              {players.length > 0 && (
                <div className="mt-3">
                  <details className="group">
                    <summary className="text-xs text-white/50 cursor-pointer hover:text-white/80 list-none">
                      <span className="group-open:hidden">Override winner →</span>
                      <span className="hidden group-open:inline">Hide override</span>
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {players.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => override(cat, p.id)}
                          disabled={busy}
                          className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/80 text-xs hover:bg-white/10 hover:border-euro-pink/40 transition disabled:opacity-40"
                        >
                          {p.name} <span className="text-white/40">({p.total_points})</span>
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <p className="text-xs text-white/40">
        <strong>Compute</strong> runs the deterministic algorithm against jury+televote and quiz/duel data.{' '}
        <strong>Override</strong> wipes the category for the room and pins your chosen player. Use overrides only when the
        algorithm produces a wrong result (e.g. tied metric the deterministic logic can't break).
      </p>
    </div>
  );
}

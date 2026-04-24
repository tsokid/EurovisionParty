import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

const STORAGE_KEY = 'europarty_rooms';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

interface RoomEntry {
  playerId: string;
  roomId: string;
  roomCode: string;
  hostName: string;
  totalPoints: number;
  status: 'active' | 'away' | 'exited';
  leftAt: string | null;
  phase: string;
  isHost: boolean;
}

type Badge = 'LIVE' | 'AWAY' | 'ENDED';

function getBadge(entry: RoomEntry): Badge {
  if (entry.phase === 'finished') return 'ENDED';
  if (entry.status === 'active') return 'LIVE';
  if (entry.status === 'away') return 'AWAY';
  if (entry.leftAt && Date.now() - new Date(entry.leftAt).getTime() < TWO_HOURS_MS) return 'AWAY';
  return 'ENDED';
}

const badgeClass: Record<Badge, string> = {
  LIVE: 'bg-green-400/20 text-green-400 border border-green-400/30',
  AWAY: 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/25',
  ENDED: 'bg-white/5 text-white/30 border border-white/10',
};

function removeFromStorage(roomCode: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete stored[roomCode.toUpperCase()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

export default function YourRoomsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      let stored: Record<string, { playerId: string }>;
      try {
        stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      } catch {
        return;
      }

      const playerIds = Object.values(stored).map((v) => v.playerId);
      if (!playerIds.length) return;

      const { data, error } = await supabase
        .from('players')
        .select('id, status, left_at, total_points, is_host, rooms!inner(id, code, phase, host_name)')
        .in('id', playerIds);

      if (error) {
        console.error('[YourRoomsPanel] query failed:', error.message);
        // Fallback: migration not yet applied
        const { data: fallback, error: fbErr } = await supabase
          .from('players')
          .select('id, is_active, total_points, is_host, rooms!inner(id, code, phase, host_name)')
          .in('id', playerIds);
        if (fbErr) { console.error('[YourRoomsPanel] fallback failed:', fbErr.message); return; }
        if (!fallback?.length) return;
        const fallbackEntries: RoomEntry[] = (fallback as any[])
          .filter((p) => p.rooms)
          .map((p) => ({
            playerId: p.id,
            roomId: p.rooms.id,
            roomCode: p.rooms.code,
            hostName: p.rooms.host_name,
            totalPoints: p.total_points,
            status: p.is_active ? 'active' : 'exited',
            leftAt: null,
            phase: p.rooms.phase,
            isHost: p.is_host ?? false,
          }));
        fallbackEntries.sort((a, b) => ({ LIVE: 0, AWAY: 1, ENDED: 2 }[getBadge(a)] - ({ LIVE: 0, AWAY: 1, ENDED: 2 }[getBadge(b)])));
        setRooms(fallbackEntries);
        return;
      }

      if (!data?.length) return;

      const entries: RoomEntry[] = (data as any[])
        .filter((p) => p.rooms)   // drop orphaned player rows (room deleted)
        .map((p) => ({
          playerId: p.id,
          roomId: p.rooms.id,
          roomCode: p.rooms.code,
          hostName: p.rooms.host_name,
          totalPoints: p.total_points,
          status: p.status,
          leftAt: p.left_at,
          phase: p.rooms.phase,
          isHost: p.is_host ?? false,
        }));

      const order: Record<Badge, number> = { LIVE: 0, AWAY: 1, ENDED: 2 };
      entries.sort((a, b) => order[getBadge(a)] - order[getBadge(b)]);
      setRooms(entries);
    }

    load();
  }, []);

  const handleLeave = async (entry: RoomEntry) => {
    setBusy((b) => ({ ...b, [entry.playerId]: true }));
    try {
      const { error } = await supabase
        .from('players')
        .update({ is_active: false, status: 'exited', left_at: new Date().toISOString() })
        .eq('id', entry.playerId);

      if (error?.message?.includes('status')) {
        // Fallback: migration not yet applied
        await supabase.from('players').update({ is_active: false }).eq('id', entry.playerId);
      }

      setRooms((prev) => prev.map((r) =>
        r.playerId === entry.playerId
          ? { ...r, status: 'exited', leftAt: new Date().toISOString() }
          : r
      ));
    } finally {
      setBusy((b) => ({ ...b, [entry.playerId]: false }));
    }
  };

  const handleDelete = async (entry: RoomEntry) => {
    if (!window.confirm(t('yourRooms.deleteConfirm', { defaultValue: 'Delete this room? This cannot be undone.' }))) return;
    setBusy((b) => ({ ...b, [entry.playerId]: true }));
    try {
      await supabase.from('rooms').delete().eq('id', entry.roomId);
      removeFromStorage(entry.roomCode);
      setRooms((prev) => prev.filter((r) => r.roomId !== entry.roomId));
    } finally {
      setBusy((b) => ({ ...b, [entry.playerId]: false }));
    }
  };

  if (!rooms.length) return null;

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 mb-4">
      <p className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-2">
        {t('yourRooms.title')}
      </p>
      <div
        className="max-h-56 overflow-y-auto flex flex-col gap-1.5"
        style={{
          maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
        }}
      >
        {rooms.map((entry) => {
          const badge = getBadge(entry);
          const canJoin = badge !== 'ENDED';
          const canLeave = entry.status === 'active' || entry.status === 'away';
          const isBusy = busy[entry.playerId];

          return (
            <div
              key={entry.playerId}
              className="flex flex-col gap-1.5 p-2 rounded-xl border bg-white/5 border-white/10"
            >
              {/* Main row — tap to join */}
              <button
                disabled={!canJoin}
                onClick={() => canJoin && navigate(`/room/${entry.roomCode}`)}
                className={`flex items-center gap-2 text-left w-full transition-colors
                  ${canJoin ? 'cursor-pointer' : 'cursor-default opacity-50'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">
                    {entry.hostName}'s Room
                  </p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {entry.roomCode} · {entry.totalPoints} pts
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badgeClass[badge]}`}>
                  {badge}
                </span>
              </button>

              {/* CTA row */}
              <div className="flex gap-1.5 pt-0.5 border-t border-white/8">
                {canJoin && (
                  <button
                    onClick={() => navigate(`/room/${entry.roomCode}`)}
                    className="flex-1 text-[11px] font-semibold text-euro-purple-light bg-euro-purple/20 hover:bg-euro-purple/35 rounded-lg py-1 transition-colors"
                  >
                    {t('yourRooms.join', { defaultValue: 'Join' })}
                  </button>
                )}
                {canLeave && (
                  <button
                    disabled={isBusy}
                    onClick={() => handleLeave(entry)}
                    className="flex-1 text-[11px] font-semibold text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20 rounded-lg py-1 transition-colors disabled:opacity-50"
                  >
                    {isBusy ? '…' : t('yourRooms.leave', { defaultValue: 'Leave' })}
                  </button>
                )}
                {entry.isHost && (
                  <button
                    disabled={isBusy}
                    onClick={() => handleDelete(entry)}
                    className="flex-1 text-[11px] font-semibold text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg py-1 transition-colors disabled:opacity-50"
                  >
                    {isBusy ? '…' : t('yourRooms.delete', { defaultValue: '🗑 Delete' })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

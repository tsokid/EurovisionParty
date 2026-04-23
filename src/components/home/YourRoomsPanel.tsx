import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

const STORAGE_KEY = 'europarty_rooms';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

interface RoomEntry {
  playerId: string;
  roomCode: string;
  hostName: string;
  totalPoints: number;
  status: 'active' | 'away' | 'exited';
  leftAt: string | null;
  phase: string;
}

type Badge = 'LIVE' | 'AWAY' | 'ENDED';

function getBadge(entry: RoomEntry): Badge {
  if (entry.phase === 'finished') return 'ENDED';
  if (entry.status === 'active') return 'LIVE';
  if (entry.status === 'away') return 'AWAY';
  // exited — check grace period
  if (entry.leftAt && Date.now() - new Date(entry.leftAt).getTime() < TWO_HOURS_MS) return 'AWAY';
  return 'ENDED';
}

const badgeClass: Record<Badge, string> = {
  LIVE: 'bg-green-400/20 text-green-400 border border-green-400/30',
  AWAY: 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/25',
  ENDED: 'bg-white/5 text-white/30 border border-white/10',
};

export default function YourRoomsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomEntry[]>([]);

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
        .select('id, status, left_at, total_points, rooms!inner(code, phase, host_name)')
        .in('id', playerIds);

      if (error) {
        console.error('[YourRoomsPanel] query failed:', error.message, error.details);
        // Fallback: query without new columns (migration may not have run yet)
        const { data: fallback, error: fbErr } = await supabase
          .from('players')
          .select('id, is_active, total_points, rooms!inner(code, phase, host_name)')
          .in('id', playerIds);
        if (fbErr) { console.error('[YourRoomsPanel] fallback failed:', fbErr.message); return; }
        if (!fallback?.length) return;
        const fallbackEntries: RoomEntry[] = (fallback as any[]).map((p) => ({
          playerId: p.id,
          roomCode: p.rooms.code,
          hostName: p.rooms.host_name,
          totalPoints: p.total_points,
          status: p.is_active ? 'active' : 'exited',
          leftAt: null,
          phase: p.rooms.phase,
        }));
        fallbackEntries.sort((a, b) => ({ LIVE: 0, AWAY: 1, ENDED: 2 }[getBadge(a)] - ({ LIVE: 0, AWAY: 1, ENDED: 2 }[getBadge(b)])));
        setRooms(fallbackEntries);
        return;
      }

      if (!data?.length) return;

      const entries: RoomEntry[] = (data as any[]).map((p) => ({
        playerId: p.id,
        roomCode: p.rooms.code,
        hostName: p.rooms.host_name,
        totalPoints: p.total_points,
        status: p.status,
        leftAt: p.left_at,
        phase: p.rooms.phase,
      }));

      // Sort: LIVE → AWAY → ENDED
      const order: Record<Badge, number> = { LIVE: 0, AWAY: 1, ENDED: 2 };
      entries.sort((a, b) => order[getBadge(a)] - order[getBadge(b)]);

      setRooms(entries);
    }

    load();
  }, []);

  if (!rooms.length) return null;

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 mb-4">
      <p className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-2">
        {t('yourRooms.title')}
      </p>
      <div
        className="max-h-44 overflow-y-auto flex flex-col gap-1.5"
        style={{
          maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
        }}
      >
        {rooms.map((entry) => {
          const badge = getBadge(entry);
          const tappable = badge !== 'ENDED';
          return (
            <button
              key={entry.playerId}
              disabled={!tappable}
              onClick={() => tappable && navigate(`/room/${entry.roomCode}`)}
              className={`flex items-center gap-2 p-2 rounded-xl border text-left w-full transition-colors
                ${tappable
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer'
                  : 'bg-white/[0.03] border-white/5 cursor-default opacity-50'
                }`}
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
          );
        })}
      </div>
    </div>
  );
}

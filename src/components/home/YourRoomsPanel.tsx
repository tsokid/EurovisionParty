import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import {
  useUserRooms,
  getBadge,
  removeFromStorage,
  type RoomEntry,
  type RoomBadge,
} from '../../hooks/useUserRooms';

const badgeClass: Record<RoomBadge, string> = {
  LIVE: 'bg-green-400/20 text-green-400 border-green-400/30',
  AWAY: 'bg-yellow-400/12 text-yellow-300/80 border-yellow-400/20',
  ENDED: 'bg-white/5 text-white/30 border-white/10',
};

interface RoomCardProps {
  entry: RoomEntry;
  isBusy: boolean;
  onJoin: (entry: RoomEntry) => void;
  onLeave: (entry: RoomEntry) => void;
  onDelete: (entry: RoomEntry) => void;
}

function RoomCard({ entry, isBusy, onJoin, onLeave, onDelete }: RoomCardProps) {
  const { t } = useTranslation();
  const badge = getBadge(entry);
  const canJoin = badge !== 'ENDED';
  const canLeave = entry.status === 'active' || entry.status === 'away';
  const joinLabel = badge === 'AWAY'
    ? t('yourRooms.rejoin')
    : canJoin
      ? t('yourRooms.join')
      : t('yourRooms.endedLabel');

  return (
    <div
      className={`relative rounded-2xl border bg-white/[0.04] backdrop-blur-md p-5 sm:p-6 flex flex-col gap-4 transition-colors ${
        canJoin
          ? 'border-white/10 hover:border-euro-pink/40 hover:bg-white/[0.06]'
          : 'border-white/8 opacity-85'
      }`}
    >
      {entry.isHost && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onDelete(entry)}
          aria-label={t('yourRooms.delete')}
          title={t('yourRooms.delete')}
          className="absolute top-3 right-3 z-[2] w-8 h-8 rounded-lg bg-transparent border border-white/8 text-red-400/55 flex items-center justify-center hover:bg-red-400/10 hover:border-red-400/30 hover:text-red-400 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}

      <div className={`flex flex-col gap-1.5 ${entry.isHost ? 'pr-10' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[0.72rem] font-bold px-2.5 py-1 rounded-full border tracking-[0.08em] ${badgeClass[badge]}`}>
            {t(`yourRooms.${badge.toLowerCase()}`)}
          </span>
          {entry.isHost && (
            <span className="text-[0.72rem] font-bold text-euro-gold/90 tracking-[0.12em] uppercase">
              {t('yourRooms.host')}
            </span>
          )}
        </div>
        <p className="text-[1.2rem] sm:text-[1.25rem] font-bold text-white leading-tight truncate">
          {entry.hostName}'s Room
        </p>
        <p className="text-[0.92rem] text-white/45 tabular-nums">
          <code className="font-mono text-[0.88rem] text-white/60">{entry.roomCode}</code>
          <span className="mx-1.5">·</span>
          {entry.totalPoints} {t('common.pts')}
        </p>
      </div>

      <div className={`grid gap-3 ${canLeave ? 'grid-cols-[2fr_1fr]' : 'grid-cols-1'}`}>
        <button
          type="button"
          disabled={!canJoin || isBusy}
          onClick={() => canJoin && onJoin(entry)}
          className="group px-5 py-4 rounded-xl bg-gradient-to-br from-euro-purple-light to-euro-pink text-white text-[1.02rem] font-bold tracking-tight shadow-[0_4px_20px_rgba(168,85,247,0.35),0_2px_8px_rgba(236,72,153,0.25)] hover:brightness-110 hover:-translate-y-px transition-all min-h-[54px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:brightness-100 cursor-pointer"
        >
          {joinLabel}
          {canJoin && (
            <span className="text-[1.1rem] transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
          )}
        </button>

        {canLeave && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onLeave(entry)}
            className="px-3 py-3 rounded-xl bg-yellow-400/8 border border-yellow-400/[0.22] text-yellow-300/90 text-[0.95rem] font-semibold hover:bg-yellow-400/15 transition-colors min-h-[54px] disabled:opacity-50 cursor-pointer"
          >
            {isBusy ? '…' : t('yourRooms.leave')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function YourRoomsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { rooms, updateRooms } = useUserRooms();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isCarousel = rooms.length > 1;

  useEffect(() => {
    if (!isCarousel) return;
    const el = trackRef.current;
    if (!el) return;

    const handleScroll = () => {
      const cards = el.querySelectorAll<HTMLElement>('[data-room-card]');
      if (!cards.length) return;
      const center = el.scrollLeft + el.clientWidth / 2;
      let closest = 0;
      let closestDist = Infinity;
      cards.forEach((card, i) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const dist = Math.abs(cardCenter - center);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      });
      setActiveIndex(closest);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [isCarousel, rooms.length]);

  const handleJoin = (entry: RoomEntry) => navigate(`/room/${entry.roomCode}`);

  const handleLeave = async (entry: RoomEntry) => {
    setBusy((b) => ({ ...b, [entry.playerId]: true }));
    try {
      const { error } = await supabase
        .from('players')
        .update({ is_active: false, status: 'exited', left_at: new Date().toISOString() })
        .eq('id', entry.playerId);

      if (error?.message?.includes('status')) {
        await supabase.from('players').update({ is_active: false }).eq('id', entry.playerId);
      }

      updateRooms((prev) => prev.map((r) =>
        r.playerId === entry.playerId
          ? { ...r, status: 'exited', leftAt: new Date().toISOString() }
          : r
      ));
    } finally {
      setBusy((b) => ({ ...b, [entry.playerId]: false }));
    }
  };

  const handleDelete = async (entry: RoomEntry) => {
    if (!window.confirm(t('yourRooms.deleteConfirm'))) return;
    setBusy((b) => ({ ...b, [entry.playerId]: true }));
    try {
      await supabase.from('rooms').delete().eq('id', entry.roomId);
      removeFromStorage(entry.roomCode);
      updateRooms((prev) => prev.filter((r) => r.roomId !== entry.roomId));
    } finally {
      setBusy((b) => ({ ...b, [entry.playerId]: false }));
    }
  };

  const scrollToIndex = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>('[data-room-card]');
    const target = cards[i];
    if (!target) return;
    const offset = target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2;
    el.scrollTo({ left: offset, behavior: 'smooth' });
  };

  if (!rooms.length) return null;

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[0.78rem] font-bold tracking-[0.18em] uppercase text-white/55">
          {t('yourRooms.title')}
        </span>
        <span className="text-[0.78rem] text-white/40 tabular-nums">
          {t('yourRooms.roomCount', { count: rooms.length })}
        </span>
      </div>

      {isCarousel ? (
        <>
          <div
            ref={trackRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
            style={{ scrollPaddingLeft: '1rem', scrollPaddingRight: '1rem' }}
          >
            {rooms.map((entry) => (
              <div
                key={entry.playerId}
                data-room-card
                className="snap-start shrink-0 basis-[88%] sm:basis-[86%]"
              >
                <RoomCard
                  entry={entry}
                  isBusy={!!busy[entry.playerId]}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-1" role="tablist" aria-label={t('yourRooms.title')}>
            {rooms.map((_, i) => {
              const active = i === activeIndex;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollToIndex(i)}
                  aria-label={`Room ${i + 1}`}
                  aria-selected={active}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    active ? 'w-5 bg-white/80' : 'w-1.5 bg-white/25 hover:bg-white/40'
                  }`}
                />
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <RoomCard
            entry={rooms[0]}
            isBusy={!!busy[rooms[0].playerId]}
            onJoin={handleJoin}
            onLeave={handleLeave}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}

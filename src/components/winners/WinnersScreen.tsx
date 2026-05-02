// src/components/winners/WinnersScreen.tsx

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Share2, Search, Crown } from 'lucide-react';
import clsx from 'clsx';
import TieVotePanel from './TieVotePanel';
import SuddenDeathPanel from './SuddenDeathPanel';
import { computeWinners, fetchWinners, groupByCategory, hasTie, CATEGORY_META } from '../../lib/winners';
import type { WinnerRow, WinnerCategory } from '../../lib/winners';
import { useGameStore } from '../../stores/gameStore';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { avatarGradient, avatarInitial } from '../../lib/avatarUtils';

const CAT_DISPLAY: Record<WinnerCategory, { name: string; color: string; subtitle: string }> = {
  champion: { name: 'Champion',    color: 'text-euro-gold',   subtitle: 'Most Points' },
  duelist:  { name: 'The Duelist', color: 'text-red-400',     subtitle: 'Most Duels Won' },
  thief:    { name: 'Thief',       color: 'text-emerald-400', subtitle: 'Most Points Stolen in Duels' },
  guru:     { name: 'Guru',        color: 'text-purple-400',  subtitle: 'Most Correct Quiz Answers' },
  oracle:   { name: 'The Oracle',  color: 'text-cyan-400',    subtitle: 'Most Predictions Correct' },
};

const CAT_IMG: Record<WinnerCategory, string> = {
  champion: '/Cards/champion.jpg',
  duelist:  '/Cards/duelist.jpg',
  thief:    '/Cards/thief.jpg',
  guru:     '/Cards/guru.jpg',
  oracle:   '/Cards/oracle.jpg',
};

// Badge styles per category
const CAT_BADGE: Record<WinnerCategory, string> = {
  champion: 'bg-euro-gold/15 border-euro-gold/40 text-euro-gold',
  duelist:  'bg-red-500/15 border-red-400/40 text-red-400',
  thief:    'bg-emerald-500/15 border-emerald-400/40 text-emerald-400',
  guru:     'bg-purple-500/15 border-purple-400/40 text-purple-400',
  oracle:   'bg-cyan-500/15 border-cyan-400/40 text-cyan-400',
};

interface Props {
  roomId: string;
  isHost: boolean;
  playerNameById: Record<string, string>;
}

export default function WinnersScreen({ roomId, isHost, playerNameById }: Props) {
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { player: currentPlayer, room } = useGameStore();
  const { players } = useLeaderboard(room?.id);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (isHost) await computeWinners(roomId).catch(() => {});
    setWinners(await fetchWinners(roomId));
    setLoading(false);
  }, [roomId, isHost]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          className="w-8 h-8 border-[3px] border-white/20 border-t-euro-gold rounded-full"
        />
      </div>
    );
  }

  const groups = groupByCategory(winners);
  const champions = groups.champion;
  const isTied = hasTie(champions);
  const champNames = champions.map((r) => playerNameById[r.player_id] ?? '?');
  const champPts = champions[0] ? Number(champions[0].metric_value) : 0;

  const myWinCats: WinnerCategory[] = currentPlayer
    ? (['champion', 'duelist', 'thief', 'guru', 'oracle'] as WinnerCategory[]).filter(
        (c) => groups[c].some((r) => r.player_id === currentPlayer.id)
      )
    : [];
  const myCat = myWinCats[0] ?? null;
  const myRow = myCat ? groups[myCat].find((r) => r.player_id === currentPlayer?.id) ?? null : null;

  const otherCats: WinnerCategory[] = (['duelist', 'thief', 'guru', 'oracle'] as WinnerCategory[]).filter(
    (c) => groups[c].length > 0
  );

  const maxPts = players[0]?.total_points || 1;
  const filteredPlayers = search
    ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : players;

  return (
    <div className="w-full mx-auto px-4 sm:px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 flex flex-col gap-5 max-w-xl lg:max-w-3xl overflow-x-hidden">

      {/* Title */}
      <h2 className="text-[1.9rem] sm:text-3xl font-extrabold text-white leading-[1.05]">
        The{' '}
        <span className="bg-gradient-to-r from-euro-purple-light to-euro-pink bg-clip-text text-transparent">
          winners'
        </span>{' '}
        circle.
      </h2>

      {/* Champion hero
          Mobile: stacked vertically (full-width cards)
          sm+:    side-by-side grid
      */}
      {champions.length > 0 && (
        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">

          {/* Champion card */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="rounded-2xl border border-white/10 bg-white/[0.05] overflow-hidden flex"
            style={{ minHeight: '180px' }}
          >
            <img
              src={CAT_IMG.champion}
              alt="Champion"
              className="w-[45%] flex-shrink-0 object-cover"
            />
            <div className="p-4 flex flex-col min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-euro-gold/15 border border-euro-gold/40 px-2.5 py-1 text-[11px] font-bold text-euro-gold tracking-widest uppercase self-start mb-2">
                <Crown className="w-3 h-3" strokeWidth={2} />
                Champion
              </div>

              <p className="text-xl font-extrabold text-euro-gold leading-tight" style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                {champNames[0] ?? '—'}
              </p>
              <p className="text-xs text-white/45 uppercase tracking-widest mt-0.5">Most Points</p>

              {isTied && (
                <span className="mt-2 self-start inline-flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase">
                  ⚠ Tied
                </span>
              )}

              <div className="mt-auto pt-2">
                <p className="font-extrabold text-white tabular-nums leading-none" style={{ fontSize: 'clamp(2rem, 9vw, 2.5rem)' }}>
                  {champPts.toLocaleString()}
                </p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Total Points</p>
                <button
                  type="button"
                  className="mt-3 flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 px-4 text-sm font-semibold text-white transition-colors"
                  style={{ minHeight: '44px' }}
                >
                  <Share2 className="w-4 h-4" strokeWidth={2} /> Share
                </button>
              </div>
            </div>
          </motion.div>

          {/* YOUR CROWN — same layout as champion, gradient ribbon at bottom */}
          {myCat ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 20, delay: 0.06 }}
              className="rounded-2xl border border-pink-500/30 bg-white/[0.05] overflow-hidden flex flex-col"
              style={{ minHeight: '180px' }}
            >
              <div className="flex flex-1">
                <img
                  src={CAT_IMG[myCat]}
                  alt={CAT_DISPLAY[myCat].name}
                  className="w-[45%] flex-shrink-0 object-cover self-stretch"
                />
                <div className="p-4 flex flex-col min-w-0 flex-1">
                  <div className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase self-start mb-2', CAT_BADGE[myCat])}>
                    {CAT_DISPLAY[myCat].name}
                  </div>
                  <p className={clsx('text-base font-extrabold leading-snug', CAT_DISPLAY[myCat].color)}>
                    {CAT_DISPLAY[myCat].subtitle}
                  </p>
                  {myRow && (
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.07] px-3 py-3 mt-auto">
                      <span className="text-sm text-white/50">Your stat</span>
                      <span className="text-base font-bold text-white tabular-nums">
                        {Number(myRow.metric_value).toLocaleString()} pts
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Ribbon */}
              <div
                className="flex items-center justify-center gap-2 py-3 text-white text-[11px] font-extrabold tracking-[0.18em] uppercase"
                style={{ background: 'linear-gradient(90deg,#be185d,#a21caf,#7c3aed)' }}
              >
                <span>★</span> Your Crown <span>★</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center gap-3 p-8 text-center"
              style={{ minHeight: '120px' }}
            >
              <Crown className="w-10 h-10 text-white/20" strokeWidth={1.5} />
              <p className="text-base text-white/30">No crown this time</p>
            </motion.div>
          )}
        </div>
      )}

      {/* Tie overlay */}
      {isTied && (
        <TieVotePanel
          roomId={roomId}
          isHost={isHost}
          category="champion"
          tiedPlayerNames={champNames}
          onResolved={refresh}
        />
      )}

      {/* Non-champion sudden death */}
      <SuddenDeathPanel
        roomId={roomId}
        isHost={isHost}
        tiedCategories={(Object.keys(groups) as WinnerCategory[]).filter(
          (c) => c !== 'champion' && hasTie(groups[c])
        )}
        onResolved={refresh}
      />

      {/* Other crowns
          Mobile: horizontal scroll carousel (160px cards)
          sm+:    4-column grid
      */}
      {otherCats.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold text-white/35 tracking-widest uppercase">✦ Other Crowns</span>
            <span className="text-xs bg-white/10 text-white/50 rounded-full px-2 py-0.5 font-semibold">
              {otherCats.length} {otherCats.length === 1 ? 'category' : 'categories'}
            </span>
          </div>

          {/* Carousel row — extends to screen edge via negative margin */}
          <div
            className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0"
            style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' } as React.CSSProperties}
          >
            {otherCats.map((cat, i) => {
              const rows = groups[cat];
              const winnerNames = rows.map((r) => playerNameById[r.player_id] ?? '?');
              const metric = rows[0] ? Number(rows[0].metric_value) : 0;
              const display = CAT_DISPLAY[cat];
              const meta = CATEGORY_META[cat];

              return (
                <motion.div
                  key={cat}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-xl overflow-hidden relative border border-white/10 flex-shrink-0 sm:flex-shrink"
                  style={{ width: '160px', scrollSnapAlign: 'start' } as React.CSSProperties}
                >
                  <img
                    src={CAT_IMG[cat]}
                    alt={display.name}
                    className="w-full object-cover"
                    style={{ aspectRatio: '3/4' }}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
                    <p className={clsx('text-sm font-bold leading-tight', display.color)}>
                      {display.name}
                    </p>
                    <p className="text-[11px] text-white/45 uppercase tracking-wide mt-0.5">
                      {meta.metricLabel}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarGradient(i + 1)} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
                        {avatarInitial(winnerNames[0] ?? '?')}
                      </div>
                      <span className="text-[13px] text-white font-semibold truncate">{winnerNames[0]}</span>
                      <span className="text-[11px] text-white/40 flex-shrink-0 ml-auto">{metric}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {/* Trailing spacer so last card clears the right edge */}
            <div className="flex-shrink-0 w-1 sm:hidden" />
          </div>
        </div>
      )}

      {/* Final standings */}
      <div className="rounded-2xl bg-[rgba(255,255,255,0.04)] p-4">
        {/* Label + search stacked on mobile */}
        <p className="text-xs font-bold text-white/35 tracking-widest uppercase mb-3">Final Standings</p>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player"
            className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-white/[0.08] border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
          />
        </div>

        <div className="space-y-2">
          {filteredPlayers.map((p, i) => {
            const rank = i + 1;
            const isMe = p.id === currentPlayer?.id;
            const pct = Math.round((p.total_points / maxPts) * 100);

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025 }}
                className={clsx(
                  'grid items-center rounded-xl px-3 py-3',
                  isMe ? 'bg-euro-purple/15 border border-euro-purple/30' : 'bg-transparent',
                )}
                style={{
                  gridTemplateColumns: '36px 44px 1fr auto',
                  columnGap: '10px',
                  minHeight: '68px',
                }}
              >
                {/* Rank */}
                <div className="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white/50 tabular-nums">{rank}</span>
                </div>

                {/* Avatar */}
                <div className={clsx(
                  'w-11 h-11 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-base flex-shrink-0',
                  avatarGradient(i),
                )}>
                  {avatarInitial(p.name)}
                </div>

                {/* Name + bar */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={clsx('font-semibold text-base truncate', isMe ? 'text-euro-purple-light' : 'text-white')}>
                      {p.name}
                    </p>
                    {isMe && (
                      <span className="text-[10px] font-bold text-euro-purple-light bg-euro-purple/25 rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
                        you
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-[3px] rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.02, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                {/* Score */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xl font-extrabold tabular-nums text-white leading-none">
                    {p.total_points.toLocaleString()}
                  </p>
                </div>
              </motion.div>
            );
          })}
          {filteredPlayers.length === 0 && (
            <p className="text-center text-white/30 text-sm py-4">No player found</p>
          )}
        </div>

        <p className="text-center text-xs text-white/25 mt-5">
          The show's over. Screenshot your card, share the bragging rights.
        </p>
      </div>
    </div>
  );
}

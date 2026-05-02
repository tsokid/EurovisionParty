// src/components/winners/WinnersScreen.tsx
// Final-phase screen matching the reference design:
// - "The winners' circle." title
// - Champion hero card (left) + YOUR CROWN card (right)
// - Inline tie overlay (vote / sudden-death / accepted)
// - OTHER CROWNS horizontal row
// - FINAL STANDINGS with search

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

// Display labels and accent colours matching the card art
const CAT_DISPLAY: Record<WinnerCategory, { name: string; color: string; subtitle: string }> = {
  champion: { name: 'Champion',    color: 'text-euro-gold',   subtitle: 'Most Points' },
  duelist:  { name: 'The Duelist', color: 'text-red-400',     subtitle: 'Most Duels Won' },
  thief:    { name: 'Thief',       color: 'text-emerald-400', subtitle: 'Most Points Stolen' },
  guru:     { name: 'Guru',        color: 'text-purple-400',  subtitle: 'Most Quiz Answers' },
  oracle:   { name: 'The Oracle',  color: 'text-cyan-400',    subtitle: 'Most Predictions Correct' },
};

// Card image paths (public/Cards/)
const CAT_IMG: Record<WinnerCategory, string> = {
  champion: '/Cards/champion.jpg',
  duelist:  '/Cards/duelist.jpg',
  thief:    '/Cards/thief.jpg',
  guru:     '/Cards/guru.jpg',
  oracle:   '/Cards/oracle.jpg',
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

  // Current player's wins — champion first, then others
  const myWinCats: WinnerCategory[] = currentPlayer
    ? (['champion', 'duelist', 'thief', 'guru', 'oracle'] as WinnerCategory[]).filter(
        (c) => groups[c].some((r) => r.player_id === currentPlayer.id)
      )
    : [];
  const myCat = myWinCats[0] ?? null;
  const myRow = myCat ? groups[myCat].find((r) => r.player_id === currentPlayer?.id) ?? null : null;

  // Other crowns = non-champion categories with at least one winner
  const otherCats: WinnerCategory[] = (['duelist', 'thief', 'guru', 'oracle'] as WinnerCategory[]).filter(
    (c) => groups[c].length > 0
  );

  // Standings helpers
  const maxPts = players[0]?.total_points || 1;
  const filteredPlayers = search
    ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : players;

  return (
    <div className="max-w-3xl w-full mx-auto px-3 sm:px-5 lg:px-6 pb-8 pt-4 flex flex-col gap-5">

      {/* Title */}
      <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
        The{' '}
        <span className="bg-gradient-to-r from-euro-purple-light to-euro-pink bg-clip-text text-transparent">
          winners'
        </span>{' '}
        circle.
      </h2>

      {/* Champion hero */}
      {champions.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {/* Left — champion card */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="rounded-2xl border border-white/10 bg-white/[0.05] overflow-hidden flex"
          >
            <img
              src={CAT_IMG.champion}
              alt="Champion"
              className="w-[45%] flex-shrink-0 object-cover"
            />
            <div className="p-3 sm:p-4 flex flex-col min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-euro-gold/15 border border-euro-gold/40 px-2 py-0.5 text-[10px] font-bold text-euro-gold tracking-widest uppercase self-start mb-2">
                <Crown className="w-3 h-3" strokeWidth={2} />
                Champion
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-euro-gold leading-tight truncate">
                {champNames[0] ?? '—'}
              </p>
              <p className="text-[10px] text-white/45 uppercase tracking-widest mt-0.5">Most Points</p>

              {isTied && (
                <span className="mt-2 self-start inline-flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-400 tracking-wide uppercase">
                  ⚠ Tied for first
                </span>
              )}

              <div className="mt-auto">
                <p className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums leading-none">
                  {champPts.toLocaleString()}
                </p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Most Points</p>
                <button
                  type="button"
                  className="mt-2 flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                >
                  <Share2 className="w-3 h-3" strokeWidth={2} /> Share
                </button>
              </div>
            </div>
          </motion.div>

          {/* Right — YOUR CROWN */}
          {myCat ? (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', damping: 20, delay: 0.05 }}
              className="rounded-2xl border border-white/10 overflow-hidden relative"
            >
              {/* YOUR CROWN banner */}
              <div className="absolute top-0 right-0 z-10 bg-gradient-to-r from-euro-pink to-fuchsia-500 text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-bl-xl flex items-center gap-1">
                ★ Your Crown
              </div>
              <img
                src={CAT_IMG[myCat]}
                alt={CAT_DISPLAY[myCat].name}
                className="w-full object-cover"
                style={{ maxHeight: '55%' }}
              />
              <div className="p-3 bg-white/[0.04] flex flex-col gap-1.5">
                <p className={clsx('text-base font-extrabold leading-tight', CAT_DISPLAY[myCat].color)}>
                  {CAT_DISPLAY[myCat].name}
                </p>
                <p className="text-[10px] text-white/45 uppercase tracking-widest">{CAT_DISPLAY[myCat].subtitle}</p>
                {myRow && (
                  <div className="flex items-center justify-between rounded-xl bg-white/[0.07] px-3 py-2 mt-1">
                    <span className="text-xs text-white/50">Your stat</span>
                    <span className="text-sm font-bold text-white tabular-nums">
                      {Number(myRow.metric_value).toLocaleString()} pts
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            // Placeholder when current player didn't win a category
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center gap-2 p-6 text-center"
            >
              <Crown className="w-8 h-8 text-white/20" strokeWidth={1.5} />
              <p className="text-sm text-white/30">No crown this time</p>
            </motion.div>
          )}
        </div>
      )}

      {/* Tie overlay — vote / sudden-death / accepted */}
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

      {/* Other crowns */}
      {otherCats.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold text-white/35 tracking-widest uppercase flex items-center gap-1.5">
              ✦ Other Crowns
            </span>
            <span className="text-xs bg-white/10 text-white/50 rounded-full px-2 py-0.5 font-semibold">
              {otherCats.length} {otherCats.length === 1 ? 'category' : 'categories'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
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
                  className="rounded-xl overflow-hidden relative border border-white/10"
                >
                  <img
                    src={CAT_IMG[cat]}
                    alt={display.name}
                    className="w-full aspect-[3/4] object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
                    <p className={clsx('text-xs font-bold leading-tight', display.color)}>
                      {display.name}
                    </p>
                    <p className="text-[9px] text-white/45 uppercase tracking-wide mt-0.5">
                      {meta.metricLabel}
                    </p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarGradient(i + 1)} flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}>
                        {avatarInitial(winnerNames[0] ?? '?')}
                      </div>
                      <span className="text-[10px] text-white font-semibold truncate">{winnerNames[0]}</span>
                      <span className="text-[9px] text-white/40 flex-shrink-0">{metric}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Final standings */}
      <div className="rounded-2xl bg-[rgba(255,255,255,0.04)] p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-xs font-bold text-white/35 tracking-widest uppercase">Final Standings</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player"
              className="pl-7 pr-3 py-1.5 text-xs rounded-full bg-white/[0.08] border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 w-28 sm:w-32"
            />
          </div>
        </div>

        <div className="space-y-1.5">
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
                  'flex items-center gap-3 rounded-xl px-3 py-2.5',
                  isMe ? 'bg-euro-purple/15 border border-euro-purple/30' : 'bg-transparent',
                )}
              >
                <div className="w-6 h-6 rounded-full bg-white/[0.08] flex-shrink-0 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-white/45 tabular-nums">{rank}</span>
                </div>
                <div className={clsx(
                  'w-9 h-9 rounded-full bg-gradient-to-br flex-shrink-0 flex items-center justify-center text-white font-bold text-sm',
                  avatarGradient(i),
                )}>
                  {avatarInitial(p.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={clsx('font-semibold text-sm truncate', isMe ? 'text-euro-purple-light' : 'text-white')}>
                      {p.name}
                    </p>
                    {isMe && (
                      <span className="text-[10px] font-bold text-euro-purple-light bg-euro-purple/25 rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
                        you
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-[3px] rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.02, ease: 'easeOut' }}
                    />
                  </div>
                </div>
                <div className="flex-shrink-0 text-right min-w-[2.5rem]">
                  <p className="text-lg font-extrabold tabular-nums text-white leading-none">{p.total_points}</p>
                  <span className="text-[10px] text-white/20">--</span>
                </div>
              </motion.div>
            );
          })}
          {filteredPlayers.length === 0 && (
            <p className="text-center text-white/30 text-sm py-4">No player found</p>
          )}
        </div>

        <p className="text-center text-[11px] text-white/25 mt-4">
          The show's over. Screenshot your card, share the bragging rights.
        </p>
      </div>
    </div>
  );
}

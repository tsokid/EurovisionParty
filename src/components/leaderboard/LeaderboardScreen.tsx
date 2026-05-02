import { motion } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, Search } from 'lucide-react';
import clsx from 'clsx';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useGameStore } from '../../stores/gameStore';
import type { Player } from '../../lib/types';

const PODIUM = {
  1: {
    tone: 'text-euro-gold',
    ring: 'ring-euro-gold/40',
    bg: 'bg-euro-gold/10',
    rankBg: 'bg-euro-gold text-black',
    emoji: '👑',
    platformH: 'h-24 sm:h-28',
  },
  2: {
    tone: 'text-white',
    ring: 'ring-white/20',
    bg: 'bg-white/[0.07]',
    rankBg: 'bg-white/60 text-black',
    emoji: '🥈',
    platformH: 'h-16 sm:h-20',
  },
  3: {
    tone: 'text-amber-400',
    ring: 'ring-amber-500/30',
    bg: 'bg-amber-700/10',
    rankBg: 'bg-amber-500 text-white',
    emoji: '🥉',
    platformH: 'h-12 sm:h-14',
  },
} as const;

const AVATAR_GRADIENTS = [
  'from-pink-500 to-purple-600',
  'from-purple-500 to-indigo-600',
  'from-fuchsia-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-violet-600',
];
function avatarGradient(i: number) {
  return AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
}

interface PodiumColProps {
  player: Player;
  rank: 1 | 2 | 3;
  playerIndex: number;
  isCurrentPlayer: boolean;
  youLabel: string;
  ptsLabel: string;
}

function PodiumCol({ player: p, rank, playerIndex, isCurrentPlayer, youLabel, ptsLabel }: PodiumColProps) {
  const s = PODIUM[rank];
  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank === 1 ? 0.15 : rank === 2 ? 0.05 : 0.1, type: 'spring', damping: 18 }}
    >
      {rank === 1 ? (
        <Crown className="w-5 h-5 text-euro-gold mb-1.5" strokeWidth={2} />
      ) : (
        <div className="h-7" />
      )}
      <div className="relative">
        <div className={clsx(
          'w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-base sm:text-lg',
          avatarGradient(playerIndex),
          rank === 1 && 'shadow-[0_0_22px_rgba(147,51,234,0.55)]',
        )}>
          {p.name.charAt(0).toUpperCase()}
        </div>
        <span className={clsx(
          'absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-extrabold ring-2 ring-[#150930]',
          s.rankBg,
        )}>
          {rank}
        </span>
      </div>
      <p className={clsx('text-xs sm:text-sm font-bold mt-2 text-center leading-tight', s.tone)}>
        {p.name}
      </p>
      {isCurrentPlayer && (
        <span className="text-[10px] text-white/45 font-normal">({youLabel})</span>
      )}
      <p className={clsx('text-sm font-extrabold tabular-nums mt-0.5', s.tone)}>
        {p.total_points}{' '}
        <span className="text-[10px] font-medium text-white/40">{ptsLabel}</span>
      </p>
      <div className={clsx(
        'w-full mt-2 rounded-t-xl flex items-center justify-center ring-1',
        s.platformH, s.bg, s.ring,
      )}>
        <span className="text-xl sm:text-2xl opacity-50">{s.emoji}</span>
      </div>
    </motion.div>
  );
}

interface StandingRowProps {
  player: Player;
  rank: number;
  isCurrentPlayer: boolean;
  pct: number;
  gradientIdx: number;
  youLabel: string;
}

export function StandingRow({ player: p, rank, isCurrentPlayer, pct, gradientIdx, youLabel }: StandingRowProps) {
  return (
    <motion.div
      layoutId={`lb-${p.id}`}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ layout: { type: 'spring', damping: 25, stiffness: 200 } }}
      className={clsx(
        'flex items-center gap-3 rounded-xl px-3 py-2.5',
        isCurrentPlayer
          ? 'bg-euro-purple/15 border border-euro-purple/30'
          : 'bg-transparent',
      )}
    >
      <div className="w-6 h-6 rounded-full bg-white/[0.08] flex-shrink-0 flex items-center justify-center">
        <span className="text-[11px] font-bold text-white/45 tabular-nums">{rank}</span>
      </div>
      <div className={clsx(
        'w-9 h-9 rounded-full bg-gradient-to-br flex-shrink-0 flex items-center justify-center text-white font-bold text-sm',
        avatarGradient(gradientIdx),
      )}>
        {p.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={clsx('font-semibold text-sm truncate leading-tight', isCurrentPlayer ? 'text-euro-purple-light' : 'text-white')}>
            {p.name}
          </p>
          {isCurrentPlayer && (
            <span className="text-[10px] font-bold text-euro-purple-light bg-euro-purple/25 rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
              {youLabel}
            </span>
          )}
        </div>
        <div className="mt-1.5 h-[3px] rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>
      <div className="flex-shrink-0 text-right min-w-[2.5rem]">
        <p className="text-lg font-extrabold tabular-nums text-white leading-none">
          {p.total_points}
        </p>
        <span className="text-[10px] text-white/20 font-medium">--</span>
      </div>
    </motion.div>
  );
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { room, player: currentPlayer } = useGameStore();
  const { players, isLoading } = useLeaderboard(room?.id);
  const [search, setSearch] = useState('');

  if (!room) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/50">{t('common.loading')}</p>
      </div>
    );
  }

  const hasPoints = !!players[0] && players[0].total_points > 0;
  const maxPoints = hasPoints ? players[0].total_points : 1;
  const currentRank = currentPlayer ? players.findIndex((p) => p.id === currentPlayer.id) + 1 : 0;
  const me = players.find((p) => p.id === currentPlayer?.id);

  const standingsRows = hasPoints ? players.slice(3) : players;
  const filteredRows = search
    ? standingsRows.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : standingsRows;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col flex-1 max-w-3xl w-full mx-auto px-3 sm:px-5 lg:px-6 pb-6 gap-4 sm:gap-5">

        {/* Title */}
        <div className="pt-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            The{' '}
            <span className="bg-gradient-to-r from-euro-purple-light to-euro-pink bg-clip-text text-transparent">
              stage
            </span>{' '}
            rankings.
          </h2>
        </div>

        {isLoading && players.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-8 h-8 border-[3px] border-white/20 border-t-euro-purple-light rounded-full"
            />
          </div>
        )}

        {!isLoading && players.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-6 py-8 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-euro-purple to-euro-pink flex items-center justify-center">
              <Crown className="w-7 h-7 text-white" strokeWidth={2} />
            </div>
            <p className="text-lg font-bold text-white">
              {t('leaderboard.noPlayers', { defaultValue: 'No players yet' })}
            </p>
          </div>
        )}

        {/* Pre-game empty podium */}
        {!isLoading && players.length > 0 && !hasPoints && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-6 py-8 flex flex-col items-center text-center gap-3"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-euro-purple to-euro-pink flex items-center justify-center shadow-[0_0_24px_rgba(147,51,234,0.4)]">
              <Crown className="w-7 h-7 text-white" strokeWidth={2} />
            </div>
            <p className="text-lg font-bold text-white">
              {t('leaderboard.noPodiumYet', { defaultValue: 'Nobody on the podium yet' })}
            </p>
            <p className="text-sm text-white/55 max-w-xs">
              {`${players.length} ${t('leaderboard.noPodiumHint', { defaultValue: 'players ready. Play a quiz round or win a duel to claim the first crown.' })}`}
            </p>
          </motion.div>
        )}

        {/* Active podium */}
        {hasPoints && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end">
            {players[1] ? (
              <PodiumCol player={players[1]} rank={2} playerIndex={1}
                isCurrentPlayer={players[1].id === currentPlayer?.id}
                youLabel={t('common.you')} ptsLabel={t('common.pts')} />
            ) : <div />}
            <PodiumCol player={players[0]} rank={1} playerIndex={0}
              isCurrentPlayer={players[0].id === currentPlayer?.id}
              youLabel={t('common.you')} ptsLabel={t('common.pts')} />
            {players[2] ? (
              <PodiumCol player={players[2]} rank={3} playerIndex={2}
                isCurrentPlayer={players[2].id === currentPlayer?.id}
                youLabel={t('common.you')} ptsLabel={t('common.pts')} />
            ) : <div />}
          </div>
        )}

        {/* YOU card */}
        {me && players.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-euro-purple/30 bg-euro-purple/10 px-4 py-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={clsx(
                'w-10 h-10 rounded-full bg-gradient-to-br flex-shrink-0 flex items-center justify-center text-white font-bold text-base',
                avatarGradient(currentRank - 1),
              )}>
                {me.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-euro-purple-light tracking-widest uppercase leading-none">
                  {t('common.you')}
                </p>
                <p className="text-sm font-bold text-white truncate mt-0.5">
                  {me.name}
                  {currentRank > 0 && (
                    <span className="text-white/45 font-normal">
                      {' '}— {t('leaderboard.rankOf', {
                        defaultValue: `rank ${currentRank} of ${players.length}`,
                        rank: currentRank,
                        total: players.length,
                      })}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-extrabold text-white tabular-nums leading-none">{me.total_points}</p>
                <p className="text-[10px] text-white/40 font-medium uppercase tracking-wide mt-0.5">
                  {t('common.points', { defaultValue: 'Points' })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: me.quiz_points, label: t('leaderboard.quizPts', { defaultValue: 'Quiz pts' }) },
                { value: me.duel_points, label: t('leaderboard.duelPts', { defaultValue: 'Duel pts' }) },
                { value: me.pred_points, label: t('leaderboard.predPts', { defaultValue: 'Pred pts' }) },
              ].map(({ value, label }) => (
                <div key={label} className="rounded-xl bg-white/[0.07] px-2 py-2.5 text-center">
                  <p className="text-base font-extrabold text-white tabular-nums leading-none">{value}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mt-1">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Standings */}
        {players.length > 0 && (
          <div className="flex flex-col flex-1 min-h-0 rounded-2xl bg-[rgba(255,255,255,0.04)] p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold text-white/35 tracking-widest uppercase">
                {t('leaderboard.standings', { defaultValue: 'Standings' })}
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('leaderboard.searchPlayer', { defaultValue: 'Search player' })}
                  className="pl-7 pr-3 py-1.5 text-xs rounded-full bg-white/[0.08] border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 w-28 sm:w-32"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              {filteredRows.map((p, i) => {
                const rank = hasPoints ? i + 4 : i + 1;
                const realIndex = standingsRows.indexOf(p);
                const pct = hasPoints ? Math.round((p.total_points / maxPoints) * 100) : 0;
                return (
                  <StandingRow
                    key={p.id}
                    player={p}
                    rank={rank}
                    isCurrentPlayer={p.id === currentPlayer?.id}
                    pct={pct}
                    gradientIdx={hasPoints ? realIndex + 3 : realIndex}
                    youLabel={t('common.you')}
                  />
                );
              })}
              {filteredRows.length === 0 && (
                <p className="text-center text-white/30 text-sm py-4">
                  {t('leaderboard.noMatch', { defaultValue: 'No player found' })}
                </p>
              )}
            </div>

            <p className="text-center text-[11px] text-white/25 mt-3">
              {t('leaderboard.liveFooter', { defaultValue: 'Updated live as quizzes finish and duels resolve.' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

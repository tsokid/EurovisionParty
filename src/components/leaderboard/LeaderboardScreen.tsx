import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useGameStore } from '../../stores/gameStore';
import type { Player } from '../../lib/types';

const PODIUM = {
  1: { emoji: '👑', tone: 'text-euro-gold', ring: 'ring-euro-gold/50', glow: 'shadow-[0_0_30px_rgba(255,215,0,0.25)]', bg: 'bg-euro-gold/10' },
  2: { emoji: '🥈', tone: 'text-gray-200', ring: 'ring-white/30', glow: '', bg: 'bg-white/[0.06]' },
  3: { emoji: '🥉', tone: 'text-amber-500', ring: 'ring-amber-500/40', glow: '', bg: 'bg-amber-700/10' },
} as const;

interface PodiumCardProps {
  player: Player;
  rank: 1 | 2 | 3;
  isCurrentPlayer: boolean;
  youLabel: string;
  ptsLabel: string;
}

function PodiumCard({ player: p, rank, isCurrentPlayer, youLabel, ptsLabel }: PodiumCardProps) {
  const style = PODIUM[rank];
  // Visual height ordering: 1st tallest, 2nd middle, 3rd shortest.
  const heightClass = rank === 1 ? 'sm:pt-8' : rank === 2 ? 'sm:pt-12' : 'sm:pt-16';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank === 1 ? 0.15 : rank === 2 ? 0.05 : 0.1, type: 'spring', damping: 18 }}
      className={clsx('flex flex-col', heightClass)}
    >
      <div
        className={clsx(
          'flex flex-col items-center text-center rounded-2xl px-3 py-4 sm:py-5 ring-1',
          style.bg,
          style.ring,
          style.glow,
          isCurrentPlayer && 'border border-euro-purple/50',
        )}
      >
        <span className="text-2xl sm:text-3xl mb-1" aria-hidden>{style.emoji}</span>
        <span className="text-3xl sm:text-4xl mb-1" aria-hidden>{p.avatar_emoji}</span>
        <p className={clsx('text-sm sm:text-base font-bold truncate max-w-full', style.tone)}>
          {p.name}
        </p>
        {isCurrentPlayer && (
          <span className="mt-1 text-xs font-semibold text-euro-purple-light bg-euro-purple/20 rounded-full px-2 py-0.5">
            {youLabel}
          </span>
        )}
        <p className={clsx('text-2xl sm:text-3xl lg:text-4xl font-extrabold tabular-nums mt-2', style.tone)}>
          {p.total_points}
        </p>
        <p className="text-xs text-white/50 font-medium">{ptsLabel}</p>
      </div>
    </motion.div>
  );
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { room, player: currentPlayer } = useGameStore();
  const { players, isLoading } = useLeaderboard(room?.id);

  if (!room) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/50">{t('common.loading')}</p>
      </div>
    );
  }

  // Top 3 for the podium; the full list still includes everyone — top
  // ranks just get richer styling in the row list too.
  const top1 = players[0];
  const top2 = players[1];
  const top3 = players[2];

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5 gap-5 sm:gap-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-1">
          <h2 className="glow-text text-2xl sm:text-3xl font-extrabold text-center">
            {t('leaderboard.title')}
          </h2>
          {players.length > 0 && (
            <p className="text-xs sm:text-sm text-white/50">
              {players.length} {players.length === 1 ? t('common.player') : t('common.players')}
            </p>
          )}
        </div>

        {/* Loading */}
        {isLoading && players.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-8 h-8 border-3 border-white/20 border-t-euro-purple-light rounded-full"
            />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && players.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="text-5xl">🏆</div>
            <p className="text-white/55 text-sm sm:text-base">{t('leaderboard.noPlayers')}</p>
          </div>
        )}

        {/* Podium — only if we have at least 1 player. Layout puts 2nd
            on the left, 1st in the middle (tallest), 3rd on the right
            for the classic Eurovision-style podium look on sm+. On
            mobile they stack as a 3-col grid evenly. */}
        {top1 && (
          <div>
            <p className="text-sm text-white/50 font-semibold mb-2 px-1">
              {t('leaderboard.podium')}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
              {top2 ? (
                <PodiumCard
                  player={top2}
                  rank={2}
                  isCurrentPlayer={top2.id === currentPlayer?.id}
                  youLabel={t('common.you')}
                  ptsLabel={t('common.pts')}
                />
              ) : <div />}
              <PodiumCard
                player={top1}
                rank={1}
                isCurrentPlayer={top1.id === currentPlayer?.id}
                youLabel={t('common.you')}
                ptsLabel={t('common.pts')}
              />
              {top3 ? (
                <PodiumCard
                  player={top3}
                  rank={3}
                  isCurrentPlayer={top3.id === currentPlayer?.id}
                  youLabel={t('common.you')}
                  ptsLabel={t('common.pts')}
                />
              ) : <div />}
            </div>
          </div>
        )}

        {/* Full standings list */}
        {players.length > 0 && (
          <div className="flex flex-col flex-1 min-h-0">
            <p className="text-sm text-white/50 font-semibold mb-2 px-1">
              {t('leaderboard.standings')}
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {players.map((p, index) => {
                const rank = index + 1;
                const podium = rank <= 3 ? PODIUM[rank as 1 | 2 | 3] : null;
                const isCurrentPlayer = p.id === currentPlayer?.id;

                return (
                  <motion.div
                    key={p.id}
                    layoutId={`leaderboard-${p.id}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      layout: { type: 'spring', damping: 25, stiffness: 200 },
                      delay: index * 0.04,
                    }}
                  >
                    <div
                      className={clsx(
                        'flex items-center gap-3 sm:gap-4 rounded-xl px-3 sm:px-4 py-3 transition-all',
                        podium ? `${podium.bg} ring-1 ${podium.ring}` : 'glass',
                        isCurrentPlayer && !podium && 'border border-euro-purple/40 bg-euro-purple/8',
                      )}
                    >
                      {/* Rank badge */}
                      <div className="w-10 sm:w-12 flex-shrink-0 text-center">
                        {podium ? (
                          <span className="text-2xl sm:text-3xl">{podium.emoji}</span>
                        ) : (
                          <span className="text-base sm:text-lg font-bold text-white/45 tabular-nums">
                            #{rank}
                          </span>
                        )}
                      </div>

                      {/* Avatar */}
                      <span className="text-2xl sm:text-3xl flex-shrink-0" aria-hidden>{p.avatar_emoji}</span>

                      {/* Name & breakdown chips */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={clsx(
                            'font-bold text-sm sm:text-base truncate',
                            podium ? podium.tone : 'text-white',
                          )}>
                            {p.name}
                          </p>
                          {isCurrentPlayer && (
                            <span className="text-xs text-euro-gold bg-euro-gold/20 rounded-full px-2 py-0.5 font-semibold">
                              {t('common.you')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs sm:text-sm text-white/50 mt-1 font-medium">
                          <span>
                            <span className="text-white/40">{t('leaderboard.quizShort')}</span>
                            <span className="text-white/75 ml-1 tabular-nums">{p.quiz_points}</span>
                          </span>
                          <span>
                            <span className="text-white/40">{t('leaderboard.predShort')}</span>
                            <span className="text-white/75 ml-1 tabular-nums">{p.pred_points}</span>
                          </span>
                          <span>
                            <span className="text-white/40">{t('leaderboard.duelShort')}</span>
                            <span className="text-white/75 ml-1 tabular-nums">{p.duel_points}</span>
                          </span>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="flex-shrink-0 text-right">
                        <p className={clsx(
                          'text-2xl sm:text-3xl font-extrabold tabular-nums leading-none',
                          podium ? podium.tone : 'text-white',
                        )}>
                          {p.total_points}
                        </p>
                        <p className="text-xs text-white/40 font-medium mt-1">
                          {t('common.pts')}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

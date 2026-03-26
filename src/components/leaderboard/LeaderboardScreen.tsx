import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useGameStore } from '../../stores/gameStore';
const RANK_STYLES: Record<number, { emoji: string; color: string; bg: string }> = {
  1: {
    emoji: '\uD83D\uDC51',
    color: 'text-euro-gold',
    bg: 'bg-euro-gold/10 border-euro-gold/30',
  },
  2: {
    emoji: '\uD83E\uDD48',
    color: 'text-gray-300',
    bg: 'bg-gray-400/10 border-gray-400/20',
  },
  3: {
    emoji: '\uD83E\uDD49',
    color: 'text-amber-600',
    bg: 'bg-amber-700/10 border-amber-600/20',
  },
};

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

  return (
    <div className="flex flex-col h-full px-4 py-2">
      {/* Header */}
      <h2 className="glow-text text-xl font-bold mb-4 text-center">
        {t('leaderboard.title')}
      </h2>

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
          <div className="text-5xl">{'\uD83C\uDFC6'}</div>
          <p className="text-white/50 text-sm">{t('leaderboard.noPlayers')}</p>
        </div>
      )}

      {/* Player list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {players.map((p, index) => {
          const rank = index + 1;
          const rankStyle = RANK_STYLES[rank];
          const isCurrentPlayer = p.id === currentPlayer?.id;

          return (
            <motion.div
              key={p.id}
              layoutId={`leaderboard-${p.id}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                layout: { type: 'spring', damping: 25, stiffness: 200 },
                delay: index * 0.05,
              }}
            >
              <div
                className={clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all',
                  rankStyle ? `${rankStyle.bg} border` : 'glass',
                  isCurrentPlayer &&
                    !rankStyle &&
                    'border border-euro-gold/40 bg-euro-gold/5',
                )}
              >
                {/* Rank */}
                <div className="w-8 flex-shrink-0 text-center">
                  {rankStyle ? (
                    <span className="text-xl">{rankStyle.emoji}</span>
                  ) : (
                    <span className="text-sm font-bold text-white/40">
                      {rank}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <span className="text-2xl flex-shrink-0">{p.avatar_emoji}</span>

                {/* Name & details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={clsx(
                        'font-semibold text-sm truncate',
                        rankStyle ? rankStyle.color : 'text-white',
                      )}
                    >
                      {p.name}
                    </p>
                    {isCurrentPlayer && (
                      <span className="text-[10px] text-euro-gold bg-euro-gold/20 rounded-full px-1.5 py-0.5">
                        {t('common.you')}
                      </span>
                    )}
                  </div>
                  {/* Score breakdown */}
                  <div className="flex gap-2 text-[10px] text-white/30 mt-0.5">
                    <span>{t('leaderboard.quiz', { points: p.quiz_points })}</span>
                    <span>{t('leaderboard.pred', { points: p.pred_points })}</span>
                    <span>{t('leaderboard.duel', { points: p.duel_points })}</span>
                  </div>
                </div>

                {/* Total score */}
                <div className="flex-shrink-0 text-right">
                  <p
                    className={clsx(
                      'text-lg font-extrabold tabular-nums',
                      rankStyle ? rankStyle.color : 'text-white',
                    )}
                  >
                    {p.total_points}
                  </p>
                  <p className="text-[10px] text-white/30">{t('common.pts')}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

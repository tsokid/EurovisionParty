import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import ConfettiOverlay from '../ui/ConfettiOverlay';
import type { Player } from '../../lib/types';

interface WinnerCrownProps {
  winner: Player | null;
  visible: boolean;
  onDismiss?: () => void;
  /** When true, render a tie/tiebreak overlay instead of crowning a winner. */
  isTied?: boolean;
  /** Names of all tied players (used in tied mode). */
  tiedNames?: string[];
  /** Tied score (used in tied mode). */
  tiedScore?: number;
}

export default function WinnerCrown({
  winner,
  visible,
  onDismiss,
  isTied = false,
  tiedNames = [],
  tiedScore = 0,
}: WinnerCrownProps) {
  const { t } = useTranslation();
  // Memoize random star positions so they don't change on re-render
  const starPositions = useMemo(() =>
    Array.from({ length: 6 }, () => ({
      top: `${15 + Math.random() * 70}%`,
      left: `${5 + Math.random() * 90}%`,
      delay: 1.5 + Math.random() * 1.5,
      repeatDelay: 1 + Math.random() * 2,
    })),
  []);

  // Render nothing when there's no winner AND no tie to announce
  if (!winner && !isTied) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-euro-deep/95 backdrop-blur-lg px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={onDismiss}
        >
          {/* Confetti only when we have an undisputed winner */}
          {!isTied && <ConfettiOverlay trigger={visible} variant="champion" />}

          {/* Crown / Crossed-swords icon dropping from top */}
          <motion.div
            className="text-7xl sm:text-8xl mb-4"
            initial={{ y: -200, rotate: -30, opacity: 0 }}
            animate={{ y: 0, rotate: 0, opacity: 1 }}
            transition={{
              type: 'spring',
              damping: 10,
              stiffness: 80,
              delay: 0.3,
            }}
          >
            {isTied ? '\u2694\uFE0F' /* crossed swords */ : '\uD83D\uDC51' /* crown */}
          </motion.div>

          {/* Headline */}
          <motion.h1
            className={
              isTied
                ? 'text-amber-300 text-4xl sm:text-5xl font-black tracking-wider mb-4 text-center drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]'
                : 'glow-text-gold text-4xl sm:text-5xl font-black tracking-wider mb-4'
            }
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 150, delay: 0.6 }}
          >
            {isTied
              ? t('winnerCrown.tiebreak', { defaultValue: 'TIEBREAK!' })
              : t('winnerCrown.winner')}
          </motion.h1>

          {/* Subline */}
          {isTied ? (
            <motion.div
              className="text-center mb-6 max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
            >
              <p className="text-xl sm:text-2xl font-extrabold text-white mb-2">
                {t('winnerCrown.tieMatchOn', { defaultValue: 'The match is still on.' })}
              </p>
              <p className="text-sm text-white/65">
                {tiedNames.length > 0
                  ? t('winnerCrown.tiePlayers', {
                      defaultValue: '{{names}} are tied at the top.',
                      names: tiedNames.join(' & '),
                    })
                  : t('winnerCrown.tieGeneric', { defaultValue: 'Two players are tied at the top.' })}
              </p>
            </motion.div>
          ) : (
            <motion.h2
              className="glow-text text-3xl sm:text-4xl font-extrabold mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
            >
              {winner!.name}
            </motion.h2>
          )}

          {/* Score box */}
          <motion.div
            className="glass-strong rounded-2xl px-8 py-4 text-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.4 }}
          >
            {isTied ? (
              <>
                <p className="text-white/50 text-sm mb-1">
                  {t('winnerCrown.tiedAt', { defaultValue: 'Tied at' })}
                </p>
                <p className="text-5xl font-black text-amber-300 tabular-nums">
                  {tiedScore.toLocaleString()}
                </p>
                <p className="mt-3 text-xs text-amber-200/80 uppercase tracking-widest font-bold">
                  {t('winnerCrown.tieAction', { defaultValue: 'Vote below to decide' })}
                </p>
              </>
            ) : (
              <>
                <p className="text-white/50 text-sm mb-1">{t('winnerCrown.finalScore')}</p>
                <p className="text-5xl font-black glow-text-gold tabular-nums">
                  {winner!.total_points}
                </p>
                <div className="flex gap-4 mt-2 text-xs text-white/40">
                  <span>{t('leaderboard.quiz', { points: winner!.quiz_points })}</span>
                  <span>{t('leaderboard.pred', { points: winner!.pred_points })}</span>
                  <span>{t('leaderboard.duel', { points: winner!.duel_points })}</span>
                </div>
              </>
            )}
          </motion.div>

          {/* Stars decoration (positions memoized) — gold for winner, amber for tie */}
          {starPositions.map((star, i) => (
            <motion.div
              key={i}
              className={clsx(
                'absolute text-2xl pointer-events-none',
                isTied ? 'text-amber-400' : 'text-euro-gold',
              )}
              style={{ top: star.top, left: star.left }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.2, 0],
                rotate: [0, 180],
              }}
              transition={{
                delay: star.delay + i * 0.3,
                duration: 2,
                repeat: Infinity,
                repeatDelay: star.repeatDelay,
              }}
            >
              ✨
            </motion.div>
          ))}

          {/* Tap to dismiss hint */}
          <motion.p
            className="absolute bottom-8 text-white/30 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
          >
            {t('winnerCrown.tapClose')}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfettiOverlay from '../ui/ConfettiOverlay';
import type { Player } from '../../lib/types';

interface WinnerCrownProps {
  winner: Player | null;
  visible: boolean;
  onDismiss?: () => void;
}

export default function WinnerCrown({
  winner,
  visible,
  onDismiss,
}: WinnerCrownProps) {
  // Memoize random star positions so they don't change on re-render
  const starPositions = useMemo(() =>
    Array.from({ length: 6 }, () => ({
      top: `${15 + Math.random() * 70}%`,
      left: `${5 + Math.random() * 90}%`,
      delay: 1.5 + Math.random() * 1.5,
      repeatDelay: 1 + Math.random() * 2,
    })),
  []);

  if (!winner) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-euro-deep/95 backdrop-blur-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={onDismiss}
        >
          <ConfettiOverlay trigger={visible} variant="champion" />

          {/* Crown dropping from top */}
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
            {'\uD83D\uDC51'}
          </motion.div>

          {/* WINNER text */}
          <motion.h1
            className="glow-text-gold text-4xl sm:text-5xl font-black tracking-wider mb-4"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: 'spring',
              damping: 12,
              stiffness: 150,
              delay: 0.6,
            }}
          >
            WINNER!
          </motion.h1>

          {/* Winner avatar */}
          <motion.div
            className="text-6xl mb-2"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ delay: 0.9, duration: 0.5 }}
          >
            {winner.avatar_emoji}
          </motion.div>

          {/* Winner name */}
          <motion.h2
            className="glow-text text-3xl sm:text-4xl font-extrabold mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
          >
            {winner.name}
          </motion.h2>

          {/* Score */}
          <motion.div
            className="glass-strong rounded-2xl px-8 py-4 text-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.4 }}
          >
            <p className="text-white/50 text-sm mb-1">Final Score</p>
            <p className="text-5xl font-black glow-text-gold tabular-nums">
              {winner.total_points}
            </p>
            <div className="flex gap-4 mt-2 text-xs text-white/40">
              <span>Quiz: {winner.quiz_points}</span>
              <span>Pred: {winner.pred_points}</span>
              <span>Duel: {winner.duel_points}</span>
            </div>
          </motion.div>

          {/* Stars decoration (positions memoized) */}
          {starPositions.map((star, i) => (
            <motion.div
              key={i}
              className="absolute text-euro-gold text-2xl pointer-events-none"
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
            Tap anywhere to close
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

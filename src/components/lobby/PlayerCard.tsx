import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { Player } from '../../lib/types';

interface PlayerCardProps {
  player: Player;
  isCurrentPlayer?: boolean;
  showScore?: boolean;
}

export default function PlayerCard({
  player,
  isCurrentPlayer = false,
  showScore = false,
}: PlayerCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={clsx(
        'glass rounded-xl px-4 py-3 flex items-center gap-3',
        isCurrentPlayer &&
          'border-euro-gold/50 shadow-[0_0_16px_rgba(251,191,36,0.15)]',
      )}
    >
      {/* Emoji avatar */}
      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-2xl shrink-0">
        {player.avatar_emoji}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span
          className={clsx(
            'font-semibold truncate block',
            isCurrentPlayer ? 'text-euro-gold' : 'text-euro-white',
          )}
        >
          {player.name}
        </span>
        {isCurrentPlayer && (
          <span className="text-[11px] text-white/40">You</span>
        )}
      </div>

      {/* Right side: score or ready indicator */}
      <div className="shrink-0">
        {showScore ? (
          <span className="text-euro-gold font-bold tabular-nums">
            {player.total_points}
          </span>
        ) : (
          <span className="text-euro-green text-sm">✓ Ready</span>
        )}
      </div>
    </motion.div>
  );
}

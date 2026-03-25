import { motion } from 'framer-motion';
import clsx from 'clsx';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

interface AnswerButtonProps {
  text: string;
  index: number;
  selected: boolean;
  isCorrect: boolean;
  revealed: boolean;
  onSelect: () => void;
  disabled: boolean;
}

export default function AnswerButton({
  text,
  index,
  selected,
  isCorrect,
  revealed,
  onSelect,
  disabled,
}: AnswerButtonProps) {
  const showCorrect = revealed && isCorrect;
  const showWrong = revealed && selected && !isCorrect;

  return (
    <motion.button
      type="button"
      whileTap={disabled ? {} : { scale: 0.97 }}
      onClick={onSelect}
      disabled={disabled}
      className={clsx(
        'w-full min-h-[56px] rounded-xl px-4 py-3 text-left flex items-center gap-3',
        'transition-all duration-200 cursor-pointer',
        // Default glass style
        !revealed && !selected && 'glass border border-white/10 hover:border-white/25',
        // Selected but not yet revealed
        !revealed && selected && 'glass border-2 border-euro-purple-light bg-euro-purple/30',
        // Correct answer revealed
        showCorrect &&
          'bg-euro-green/20 border-2 border-euro-green shadow-[0_0_20px_rgba(34,197,94,0.3)]',
        // Wrong answer revealed
        showWrong &&
          'bg-euro-red/20 border-2 border-euro-red shadow-[0_0_20px_rgba(239,68,68,0.3)]',
        // Dimmed non-selected when revealed
        revealed && !selected && !isCorrect && 'glass border border-white/5 opacity-40',
        disabled && !revealed && 'cursor-not-allowed opacity-60',
      )}
    >
      {/* Letter badge */}
      <span
        className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
          showCorrect && 'bg-euro-green/30 text-euro-green',
          showWrong && 'bg-euro-red/30 text-euro-red',
          !revealed && 'bg-white/10 text-white/70',
          revealed && !selected && !isCorrect && 'bg-white/5 text-white/30',
        )}
      >
        {showCorrect ? '\u2713' : showWrong ? '\u2717' : LETTERS[index]}
      </span>

      {/* Answer text */}
      <span
        className={clsx(
          'flex-1 text-base font-medium',
          showCorrect && 'text-euro-green',
          showWrong && 'text-euro-red',
          !revealed && 'text-white',
          revealed && !selected && !isCorrect && 'text-white/40',
        )}
      >
        {text}
      </span>
    </motion.button>
  );
}

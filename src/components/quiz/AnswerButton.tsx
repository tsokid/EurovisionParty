import { useEffect } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Check, X } from 'lucide-react';

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

/**
 * One answer. After the reveal: the right answer gets the green sweep,
 * a wrong pick shakes for 200 ms (motion map #8), the rest dim.
 * Reduced motion: colours only, no sweep or shake.
 */
export default function AnswerButton({
  text,
  index,
  selected,
  isCorrect,
  revealed,
  onSelect,
  disabled,
}: AnswerButtonProps) {
  const reduce = useReducedMotion() ?? false;
  const controls = useAnimationControls();
  const showCorrect = revealed && isCorrect;
  const showWrong = revealed && selected && !isCorrect;

  useEffect(() => {
    if (showWrong && !reduce) {
      void controls.start({ x: [0, -7, 7, -5, 5, 0], transition: { duration: 0.2, ease: 'easeOut' } });
    }
  }, [showWrong, reduce, controls]);

  return (
    <motion.button
      type="button"
      animate={controls}
      whileTap={disabled || reduce ? undefined : { scale: 0.97 }}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected || undefined}
      data-state={showCorrect ? 'correct' : showWrong ? 'wrong' : revealed ? 'dim' : selected ? 'picked' : undefined}
      className={clsx(
        'qz-ans',
        !revealed && selected && 'picked',
        showCorrect && 'ok',
        showWrong && 'bad',
        revealed && !showCorrect && !showWrong && 'dim',
      )}
    >
      <span className="qz-ans-l" aria-hidden="true">
        {showCorrect ? <Check strokeWidth={3} /> : showWrong ? <X strokeWidth={3} /> : LETTERS[index]}
      </span>
      <span className="qz-ans-t">{text}</span>
    </motion.button>
  );
}

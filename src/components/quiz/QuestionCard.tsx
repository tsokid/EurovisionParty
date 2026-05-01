import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import Timer from '../ui/Timer';
import AnswerButton from './AnswerButton';
import ConfettiOverlay from '../ui/ConfettiOverlay';
import { TIMER_SECONDS } from '../../lib/constants';
import { getLocalizedQuestion } from '../../lib/questionLocale';
import type { QuizQuestion } from '../../lib/types';

function shuffleOptions(options: string[], correctIndex: number): { options: string[]; correctIndex: number } {
  const indexed = options.map((o, i) => ({ o, i }));
  for (let n = indexed.length - 1; n > 0; n--) {
    const k = Math.floor(Math.random() * (n + 1));
    [indexed[n], indexed[k]] = [indexed[k], indexed[n]];
  }
  return {
    options: indexed.map((x) => x.o),
    correctIndex: indexed.findIndex((x) => x.i === correctIndex),
  };
}

interface QuestionCardProps {
  question: QuizQuestion | undefined;
  questionIndex: number;
  totalQuestions: number;
  onAnswer: (answerIndex: number, isCorrect: boolean) => void;
  /** Fires the moment the user picks an option — before reveal/advance delay.
   *  Parent uses this to stop the countdown so the clock doesn't keep ticking. */
  onSelect?: (answerIndex: number) => void;
  timeRemaining: number;
}

const FEEDBACK_DELAY_MS = 500;
const ADVANCE_DELAY_MS = 2000;

export default function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  onAnswer,
  onSelect,
  timeRemaining,
}: QuestionCardProps) {
  const { t } = useTranslation();
  // Hooks must run in the same order every render — declare them BEFORE any early return
  const { question: localQ, options: rawOptions } = getLocalizedQuestion(question);
  // Shuffle once per question (stable across re-renders for same question.id)
  const { options, correctIndex: shuffledCorrectIndex } = useMemo<{ options: string[]; correctIndex: number }>(
    () => question ? shuffleOptions(rawOptions, question.correct_index) : { options: rawOptions, correctIndex: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question?.id],
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);

  // Reset state when question changes
  useEffect(() => {
    setSelectedIndex(null);
    setRevealed(false);
    setHasAnswered(false);
  }, [question?.id]);

  // Show timeout state when timer expires (parent handles auto-submit)
  useEffect(() => {
    if (timeRemaining <= 0 && !hasAnswered) {
      setHasAnswered(true);
      setRevealed(true);
    }
  }, [timeRemaining, hasAnswered]);

  const handleSelect = useCallback(
    (index: number) => {
      if (hasAnswered || revealed || !question) return;

      setSelectedIndex(index);
      setHasAnswered(true);
      // Tell parent immediately so it can stop the timer at the moment of click,
      // not 2.5s later after the reveal+advance delay.
      onSelect?.(index);

      // Short delay before revealing correct answer
      setTimeout(() => {
        setRevealed(true);
        const isCorrect = index === shuffledCorrectIndex;

        // Auto-advance after feedback
        setTimeout(() => {
          onAnswer(index, isCorrect);
        }, ADVANCE_DELAY_MS);
      }, FEEDBACK_DELAY_MS);
    },
    [hasAnswered, revealed, question, onAnswer, onSelect, shuffledCorrectIndex],
  );

  // Nothing to render if the parent hasn't provided a question (transient state,
  // e.g. AnimatePresence exit frames, bounds overrun, or a missing-from-bank ID).
  if (!question) return null;

  const answeredCorrectly = revealed && selectedIndex === shuffledCorrectIndex;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="flex flex-col h-full"
      >
        {/* Header: progress + timer */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-white/60 font-medium">
            {t('questionCard.progress', { current: questionIndex + 1, total: totalQuestions })}
          </span>
          <Timer seconds={TIMER_SECONDS} remaining={timeRemaining} size={56} />
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full bg-white/10 mb-6">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-euro-purple to-euro-pink"
            initial={{ width: 0 }}
            animate={{
              width: `${((questionIndex + 1) / totalQuestions) * 100}%`,
            }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Question text */}
        <h2 className="text-lg font-bold text-white mb-6 leading-relaxed">
          {localQ}
        </h2>

        {/* Answer options */}
        <div className="flex flex-col gap-3 flex-1">
          {options.map((option, idx) => (
            <AnswerButton
              key={idx}
              text={option}
              index={idx}
              selected={selectedIndex === idx}
              isCorrect={idx === shuffledCorrectIndex}
              revealed={revealed}
              onSelect={() => handleSelect(idx)}
              disabled={hasAnswered}
            />
          ))}
        </div>

        {/* Feedback text */}
        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-center"
            >
              {answeredCorrectly ? (
                <p className="text-euro-green font-bold text-lg">{t('questionCard.correct')}</p>
              ) : selectedIndex === null || selectedIndex === -1 ? (
                <p className="text-euro-gold font-bold text-lg">{t('questionCard.timeUp')}</p>
              ) : (
                <p className="text-euro-red font-bold text-lg">{t('questionCard.wrong')}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <ConfettiOverlay trigger={answeredCorrectly} variant="correct" />
      </motion.div>
    </AnimatePresence>
  );
}

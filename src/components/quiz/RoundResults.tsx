import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ConfettiOverlay from '../ui/ConfettiOverlay';
import { QUESTIONS_PER_ROUND, MAX_ROUNDS } from '../../lib/constants';
import type { QuizAnswer, QuizQuestion } from '../../lib/types';

interface RoundResultsProps {
  roundNumber: number;
  answers: QuizAnswer[];
  questions: QuizQuestion[];
  onContinue: () => void;
  isLastRound: boolean;
}

export default function RoundResults({
  roundNumber,
  answers,
  questions,
  onContinue,
  isLastRound,
}: RoundResultsProps) {
  const { t } = useTranslation();
  const [animatedScore, setAnimatedScore] = useState(0);

  const totalScore = answers.reduce((sum, a) => sum + a.points_awarded, 0);
  const correctCount = answers.filter((a) => a.is_correct).length;
  const avgTime =
    answers.length > 0
      ? answers.reduce((sum, a) => sum + (a.response_seconds ?? 0), 0) / answers.length
      : 0;

  // Animate the score counter
  useEffect(() => {
    if (totalScore === 0) return;

    const duration = 1500;
    const steps = 30;
    const increment = totalScore / steps;
    let current = 0;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), totalScore);
      setAnimatedScore(current);
      if (step >= steps) clearInterval(interval);
    }, duration / steps);

    return () => clearInterval(interval);
  }, [totalScore]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      className="flex flex-col items-center px-4 py-6"
    >
      <ConfettiOverlay trigger={totalScore > 500} variant="win" />

      <Card variant="strong" className="w-full max-w-sm text-center">
        {/* Title */}
        <motion.h2
          className="glow-text text-3xl font-extrabold mb-2"
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
        >
          {t('roundResults.complete', { num: roundNumber })}
        </motion.h2>

        {/* Animated score */}
        <motion.div
          className="my-6"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', damping: 15 }}
        >
          <p className="text-white/60 text-sm font-medium mb-1">{t('roundResults.pointsEarned')}</p>
          <p className="text-5xl font-extrabold glow-text-gold tabular-nums">
            {animatedScore}
          </p>
        </motion.div>

        {/* Stats row */}
        <div className="flex justify-center gap-6 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">
              {t('roundResults.correctCount', { count: correctCount, total: QUESTIONS_PER_ROUND })}
            </p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white tabular-nums">
              {t('roundResults.avgTime', { time: avgTime.toFixed(1) })}
            </p>
          </div>
        </div>

        {/* Answer breakdown */}
        <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
          {questions.map((q, idx) => {
            const answer = answers.find((a) => a.question_id === q.id);
            const isCorrect = answer?.is_correct ?? false;

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.05 }}
                className="flex items-center gap-2 text-left text-sm"
              >
                <span
                  className={
                    isCorrect
                      ? 'text-euro-green flex-shrink-0'
                      : 'text-euro-red flex-shrink-0'
                  }
                >
                  {isCorrect ? '\u2713' : '\u2717'}
                </span>
                <span className="text-white/70 truncate flex-1">
                  {q.question}
                </span>
                {answer && answer.points_awarded > 0 && (
                  <span className="text-euro-gold text-xs font-bold flex-shrink-0">
                    +{answer.points_awarded}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Continue button */}
        <Button fullWidth onClick={onContinue}>
          {isLastRound ? t('roundResults.finalResults') : t('roundResults.nextRound', { current: roundNumber + 1, max: MAX_ROUNDS })}
        </Button>
      </Card>
    </motion.div>
  );
}

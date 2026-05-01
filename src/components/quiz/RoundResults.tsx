import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { CheckCircle2, Flame, Trophy, Sparkles } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ConfettiOverlay from '../ui/ConfettiOverlay';
import { QUESTIONS_PER_ROUND, MAX_ROUNDS, TIMER_SECONDS } from '../../lib/constants';
import { useGameStore } from '../../stores/gameStore';
import type { QuizAnswer, QuizQuestion } from '../../lib/types';

interface RoundResultsProps {
  roundNumber: number;
  answers: QuizAnswer[];
  /** Kept for API compatibility — the new layout doesn't render the
   *  per-question breakdown but consumers still pass it. */
  questions: QuizQuestion[];
  onContinue: () => void;
  isLastRound: boolean;
}

export default function RoundResults({
  roundNumber,
  answers,
  onContinue,
  isLastRound,
}: RoundResultsProps) {
  const { t } = useTranslation();
  const { player, players } = useGameStore();
  const [animatedScore, setAnimatedScore] = useState(0);

  const totalScore = answers.reduce((sum, a) => sum + a.points_awarded, 0);
  const correctCount = answers.filter((a) => a.is_correct).length;

  // Best streak across this round only.
  const bestStreak = (() => {
    let best = 0;
    let cur = 0;
    for (const a of answers) {
      if (a.is_correct) { cur += 1; if (cur > best) best = cur; }
      else cur = 0;
    }
    return best;
  })();

  // Live rank in the room — based on quiz_points which the server has
  // already updated by the time we land on this screen.
  const ranked = [...players]
    .filter((p) => p.is_active)
    .sort((a, b) => (b.quiz_points ?? 0) - (a.quiz_points ?? 0));
  const myRank = Math.max(1, ranked.findIndex((p) => p.id === player?.id) + 1);

  // Encouragement copy + label depend on which round just finished.
  // Round 1/3 done → "WARMED UP", round 2/3 done → "ALMOST DONE".
  const phaseLabel = isLastRound
    ? t('quiz.almostDone')
    : roundNumber === 1
    ? t('quiz.warmedUp')
    : t('quiz.halfwayThere');
  const encouragement = isLastRound ? t('quiz.lastRoundCopy') : t('quiz.encouragementCopy');
  const remainingRounds = MAX_ROUNDS - roundNumber;

  // Animate the score counter
  useEffect(() => {
    if (totalScore === 0) {
      setAnimatedScore(0);
      return;
    }
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      className="flex flex-col flex-1 max-w-2xl w-full mx-auto px-2 sm:px-4 py-2 sm:py-4 gap-5"
    >
      <ConfettiOverlay trigger={totalScore > 500} variant="win" />

      {/* Round selector pill — visual progress through rounds */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/12 p-1">
          {Array.from({ length: MAX_ROUNDS }).map((_, i) => {
            const r = i + 1;
            const isCurrent = r === roundNumber + (isLastRound ? 0 : 1);
            const isFinalLabel = r === MAX_ROUNDS;
            return (
              <span
                key={r}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs sm:text-sm font-semibold transition-all',
                  isCurrent
                    ? 'bg-gradient-to-r from-euro-purple to-euro-pink text-white shadow-[0_0_18px_rgba(168,85,247,0.4)]'
                    : 'text-white/55',
                )}
              >
                {isFinalLabel ? t('roundResults.finalResults').replace(/^📊 /, '').slice(0, 5) || `Round ${r}` : `Round ${r}`}
              </span>
            );
          })}
        </div>
      </div>

      {/* "ROUND N COMPLETE" pill */}
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-euro-green/15 border border-euro-green/40 px-4 py-1.5 text-xs sm:text-sm font-bold tracking-[0.16em] text-euro-green">
          <CheckCircle2 className="w-4 h-4" strokeWidth={2.4} />
          {t('quiz.roundCompletePill', { num: roundNumber })}
        </span>
      </div>

      {/* Main card */}
      <Card className="py-7 sm:py-9 px-4 sm:px-6">
        {/* Glowing score bubble */}
        <div className="flex justify-center">
          <div className="relative">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12, delay: 0.05 }}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-euro-pink to-euro-purple flex flex-col items-center justify-center shadow-[0_0_45px_rgba(236,72,153,0.6)]"
            >
              <p className="text-3xl sm:text-4xl font-extrabold tabular-nums leading-none text-white">
                {animatedScore}
              </p>
              <p className="text-[10px] sm:text-xs font-bold tracking-[0.18em] text-white/85 mt-1">
                {t('quiz.ptsTiny')}
              </p>
            </motion.div>
            <Sparkles
              className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 text-white/90"
              strokeWidth={2.2}
              aria-hidden
            />
          </div>
        </div>

        {/* Phase label + next round title */}
        <div className="mt-5 text-center">
          <p className="text-xs sm:text-sm font-bold tracking-[0.18em] text-euro-pink">
            {phaseLabel}
          </p>
          <h2 className="glow-text text-3xl sm:text-4xl font-extrabold mt-1">
            {isLastRound
              ? t('roundResults.complete', { num: roundNumber })
              : t('quiz.roundOf', { current: roundNumber + 1, max: MAX_ROUNDS })}
          </h2>
          <p className="text-white/65 text-sm sm:text-base mt-2 max-w-md mx-auto">
            {encouragement}
          </p>
        </div>

        {/* 3 stat tiles: correct · best streak · rank */}
        <div className="mt-5 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl bg-white/[0.04] border border-white/8 px-2 sm:px-3 py-3">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide text-white/55">
              <CheckCircle2 className="w-3.5 h-3.5 text-euro-green" strokeWidth={2.4} />
              <span className="uppercase">{t('quiz.statCorrectLabel')}</span>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-white mt-1 tabular-nums">
              {correctCount} / {QUESTIONS_PER_ROUND}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/8 px-2 sm:px-3 py-3">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide text-white/55">
              <Flame className="w-3.5 h-3.5 text-orange-400" strokeWidth={2.4} />
              <span className="uppercase">{t('quiz.statBestStreakLabel')}</span>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-white mt-1 tabular-nums">
              {bestStreak}×
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/8 px-2 sm:px-3 py-3">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide text-white/55">
              <Trophy className="w-3.5 h-3.5 text-euro-gold" strokeWidth={2.4} />
              <span className="uppercase">{t('quiz.statRankLabel')}</span>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-white mt-1 tabular-nums">
              #{myRank}
            </p>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="mt-6 sm:mt-7">
          <Button size="lg" fullWidth onClick={onContinue}>
            <Sparkles className="w-4 h-4" strokeWidth={2.2} />
            {isLastRound
              ? t('roundResults.finalResults')
              : t('quiz.startRound', { num: roundNumber + 1 })}
          </Button>
        </div>

        {/* Footer line */}
        <p className="mt-3 text-center text-xs sm:text-sm text-white/45">
          {isLastRound
            ? t('quiz.lastRoundFooter', { questions: QUESTIONS_PER_ROUND, timer: TIMER_SECONDS })
            : t('quiz.roundsLeftFooter', {
                remaining: remainingRounds,
                questions: QUESTIONS_PER_ROUND,
                timer: TIMER_SECONDS,
              })}
        </p>
      </Card>

      {/* Round dots: completed (green), current (pink glow), future (grey) */}
      <div className="flex justify-center gap-2 mt-1">
        {Array.from({ length: MAX_ROUNDS }).map((_, i) => {
          const dotRound = i + 1;
          const isComplete = dotRound <= roundNumber;
          const isNext = dotRound === roundNumber + 1;
          return (
            <span
              key={i}
              className={clsx(
                'rounded-full transition-all',
                isNext
                  ? 'w-3 h-3 bg-euro-pink shadow-[0_0_8px_rgba(236,72,153,0.6)]'
                  : isComplete
                  ? 'w-2 h-2 bg-euro-green/80'
                  : 'w-2 h-2 bg-white/15',
              )}
              aria-hidden
            />
          );
        })}
      </div>
    </motion.div>
  );
}

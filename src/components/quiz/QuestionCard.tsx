import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Check, Clock, Star, X } from 'lucide-react';
import TimerRing from './TimerRing';
import AnswerButton from './AnswerButton';
import { PointsFlight } from '../stage';
import { TIMER_SECONDS, SCORING } from '../../lib/constants';
import { getLocalizedQuestion } from '../../lib/questionLocale';
import type { QuizQuestion } from '../../lib/types';

function shuffleOptions(
  options: string[],
  correctIndex: number,
): { options: string[]; correctIndex: number; originalIndexAt: number[] } {
  const indexed = options.map((o, i) => ({ o, i }));
  for (let n = indexed.length - 1; n > 0; n--) {
    const k = Math.floor(Math.random() * (n + 1));
    [indexed[n], indexed[k]] = [indexed[k], indexed[n]];
  }
  return {
    options: indexed.map((x) => x.o),
    correctIndex: indexed.findIndex((x) => x.i === correctIndex),
    // maps shuffled position → original position, so the server receives the
    // unshuffled index and can compare against quiz_questions.correct_index
    originalIndexAt: indexed.map((x) => x.i),
  };
}

/** The chip for the answer just given: points exactly as scored, plus why. */
export interface AnswerChipView {
  points: number;
  reason: string;
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
  /** Seconds per question: quiz 15 (default), duels 12. */
  timerSeconds?: number;
  mode?: 'quiz' | 'duel';
  /** Quiz round, for the eyebrow. */
  roundNumber?: number;
  /** Outcome of the questions already answered in this set (true = correct). */
  history?: boolean[];
  /** Points chip once the parent knows the scored result. */
  chip?: AnswerChipView | null;
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
  timerSeconds = TIMER_SECONDS,
  mode = 'quiz',
  roundNumber,
  history = [],
  chip = null,
}: QuestionCardProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  // Hooks must run in the same order every render — declare them BEFORE any early return
  const { question: localQ, options: rawOptions } = getLocalizedQuestion(question);
  // Shuffle once per question (stable across re-renders for same question.id)
  const { options, correctIndex: shuffledCorrectIndex, originalIndexAt } = useMemo<{ options: string[]; correctIndex: number; originalIndexAt: number[] }>(
    () => question ? shuffleOptions(rawOptions, question.correct_index) : { options: rawOptions, correctIndex: 0, originalIndexAt: rawOptions.map((_, i) => i) },
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
        // Send original (unshuffled) index so server can compare against
        // quiz_questions.correct_index, which stores the original position.
        const originalIndex = originalIndexAt[index] ?? index;

        // Auto-advance after feedback
        setTimeout(() => {
          onAnswer(originalIndex, isCorrect);
        }, ADVANCE_DELAY_MS);
      }, FEEDBACK_DELAY_MS);
    },
    [hasAnswered, revealed, question, onAnswer, onSelect, shuffledCorrectIndex],
  );

  // Nothing to render if the parent hasn't provided a question (transient state,
  // e.g. AnimatePresence exit frames, bounds overrun, or a missing-from-bank ID).
  if (!question) return null;

  const answeredCorrectly = revealed && selectedIndex === shuffledCorrectIndex;
  const timedOut = revealed && (selectedIndex === null || selectedIndex === -1);
  const verdict: 'ok' | 'bad' | 'time' = answeredCorrectly ? 'ok' : timedOut ? 'time' : 'bad';
  const { tier1, tier2, tier3 } = SCORING.quiz;
  const rules = mode === 'duel'
    ? t('questionCard.rulesDuel')
    : t('questionCard.rulesQuiz', { t1: tier1.maxSeconds, p1: tier1.points, t2: tier2.maxSeconds, p2: tier2.points, p3: tier3.points });
  const eyebrow = mode === 'duel'
    ? t('questionCard.eyebrowDuel')
    : t('questionCard.eyebrowQuiz', { round: roundNumber ?? 1, max: 3 });
  const maxPoints = mode === 'duel' ? 12 : tier1.points;
  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.25, ease: 'easeOut' as const } };

  let feedbackIcon: ReactNode = <X strokeWidth={3} aria-hidden="true" />;
  if (verdict === 'ok') feedbackIcon = <Check strokeWidth={3} aria-hidden="true" />;
  if (verdict === 'time') feedbackIcon = <Clock strokeWidth={2.6} aria-hidden="true" />;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, x: -40 }}
        transition={reduce ? { duration: 0.2 } : { type: 'spring', damping: 25, stiffness: 250 }}
        className="qz-q"
      >
        {/* Header: where we are + timer */}
        <div className="qz-q-head">
          <div className="qz-q-where">
            <div className="t-eyebrow">{eyebrow}</div>
            <div className="qz-q-count">
              {t('questionCard.progressLead')}{' '}
              <span className="num">{questionIndex + 1}</span>{' '}
              {t('questionCard.progressOf')}{' '}
              <span className="num">{totalQuestions}</span>
            </div>
          </div>
          <TimerRing seconds={timerSeconds} remaining={timeRemaining} />
        </div>

        {/* Per-question segments: green right, red wrong, pink now */}
        <div className="qz-segs" aria-hidden="true">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <i
              key={i}
              className={clsx(
                i < history.length && (history[i] ? 'ok' : 'bad'),
                i === questionIndex && i >= history.length && 'now',
              )}
            />
          ))}
        </div>

        {/* Question, then the verdict card in its place once revealed */}
        <AnimatePresence mode="wait" initial={false}>
          {!revealed ? (
            <motion.section key="q" className="card-hero qz-hero" {...fade}>
              <span className="chip chip-gold qz-upto">
                <Star aria-hidden="true" strokeWidth={2.4} />
                {t('questionCard.upTo', { points: maxPoints })}
              </span>
              <h2 className="qz-text">{localQ}</h2>
            </motion.section>
          ) : (
            <motion.section key="v" className={clsx('card qz-verdict', verdict)} role="status" {...fade}>
              <div className="qz-verdict-h">
                <span className="qz-verdict-ico">{feedbackIcon}</span>
                <h2 className="t-h2">
                  {verdict === 'ok' ? t('questionCard.correct') : verdict === 'time' ? t('questionCard.timeUp') : t('questionCard.wrong')}
                </h2>
              </div>
              <div className="qz-verdict-pts">
                {chip ? (
                  <PointsFlight points={chip.points} reason={chip.reason} className="qz-chip" />
                ) : (
                  <span className="t-meta">{t('questionCard.scoring')}</span>
                )}
              </div>
              <p className="t-meta qz-q-sub">{localQ}</p>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Answer options */}
        <div className="qz-answers">
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

        <p className="t-meta qz-rules">
          {revealed && questionIndex + 1 < totalQuestions ? <>{t('questionCard.nextAuto')} · </> : null}
          {rules}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

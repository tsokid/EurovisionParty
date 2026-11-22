import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { Swords } from 'lucide-react';
import { QUESTIONS_BY_ID } from '../../lib/questions';
import { getLocalizedQuestion } from '../../lib/questionLocale';
import { calcDuelPoints } from '../../hooks/useDuels';
import { duelAnswerChip } from '../../lib/answerPoints';
import QuestionCard, { type AnswerChipView } from '../quiz/QuestionCard';
import { duelChipView } from '../quiz/chipText';
import { PointsChip } from '../stage';
import type { Duel, DuelAnswer, QuizQuestion } from '../../lib/types';

/** How long the "+N · 12−s" chip stays before the next duel question
 *  (presentation only: the next question's clock starts after it). */
export const DUEL_CHIP_HOLD_MS = 900;

const DUEL_TIMER = 12; // 12 seconds per question

interface DuelPlayScreenProps {
  duel: Duel;
  playerId: string;
  onComplete: (answers: DuelAnswer[]) => void;
  onCancel: () => void;
}

export default function DuelPlayScreen({ duel, onComplete, onCancel }: DuelPlayScreenProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const questions: QuizQuestion[] = (duel.question_ids ?? [])
    .map((id) => QUESTIONS_BY_ID.get(id))
    .filter(Boolean) as QuizQuestion[];

  // Localize questions for the current language
  const localizedQuestions = useMemo(
    () => questions.map((q) => {
      const loc = getLocalizedQuestion(q);
      return { ...q, question: loc.question, options: loc.options };
    }),
    [questions],
  );

  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<DuelAnswer[]>([]);
  const [countdown, setCountdown] = useState(DUEL_TIMER);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const [chip, setChip] = useState<AnswerChipView | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (holdRef.current) clearTimeout(holdRef.current); }, []);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittedRef = useRef(false);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    autoSubmittedRef.current = true;
  }, []);

  // Reset timer for each question
  useEffect(() => {
    if (finished) return;

    autoSubmittedRef.current = false;
    setCountdown(DUEL_TIMER);
    setQuestionStartTime(Date.now());

    // Defer the interval until the question card has finished its entrance
    // animation so the clock isn't already counting down before the user
    // can read or click an answer.
    const startDelay = setTimeout(() => {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 500);

    return () => {
      clearTimeout(startDelay);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [questionIndex, finished]);

  const handleAnswer = useCallback((answerIndex: number, isCorrect: boolean) => {
    const currentQuestion = questions[questionIndex];
    if (!currentQuestion) return; // guard against bounds / missing-ID edge cases

    const now = Date.now();
    const responseMs = now - questionStartTime;
    const points = calcDuelPoints(responseMs, isCorrect);

    const answer: DuelAnswer = {
      questionId: currentQuestion.id,
      answerIndex,
      answeredAt: new Date(now).toISOString(),
      responseMs,
      points,
    };

    const updatedAnswers = [...answers, answer];

    // Presentation only: show "+N · 12−s" for this answer, then move on.
    setChip(duelChipView(duelAnswerChip(answer, isCorrect), t));
    if (holdRef.current) clearTimeout(holdRef.current);
    holdRef.current = setTimeout(() => {
      setChip(null);
      setAnswers(updatedAnswers);
      if (questionIndex + 1 < questions.length) {
        setQuestionIndex((prev) => prev + 1);
      } else {
        // All questions answered
        setFinished(true);
        if (countdownRef.current) clearInterval(countdownRef.current);
        onComplete(updatedAnswers);
      }
    }, DUEL_CHIP_HOLD_MS);
  }, [questionIndex, questions, answers, questionStartTime, onComplete, t]);

  // Auto-submit wrong answer when timer hits 0
  useEffect(() => {
    if (countdown === 0 && !finished && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleAnswer(-1, false); // -1 = timeout, 0 points
    }
  }, [countdown, finished, handleAnswer]);

  if (questions.length === 0 || questionIndex >= localizedQuestions.length) {
    return (
      <div className="du-play-empty">
        <p className="t-meta">{t('duelPlay.errorLoading')}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{t('duelPlay.goBack')}</button>
      </div>
    );
  }

  const correctOf = (a: DuelAnswer) => QUESTIONS_BY_ID.get(a.questionId)?.correct_index === a.answerIndex;

  if (finished) {
    const totalScore = answers.reduce((s, a) => s + a.points, 0);
    return (
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        className="du-play-done"
      >
        <section className="card du-done-card" role="status">
          <span className="du-done-ico"><Swords aria-hidden="true" strokeWidth={2.4} /></span>
          <h2 className="t-h2">{t('duelPlay.submitted')}</h2>
          <div className="du-done-chips">
            {answers.map((a, i) => {
              const v = duelChipView(duelAnswerChip(a, correctOf(a)), t);
              return <PointsChip key={i} points={v.points} reason={v.reason} />;
            })}
          </div>
          <p className="t-meta du-done-sum">
            {t('duelPlay.yourScore')} <span className="num">{totalScore}</span>
          </p>
          <p className="t-meta">{t('duelPlay.waitingOpponent')}</p>
        </section>
      </motion.div>
    );
  }

  return (
    <div className="du-play">
      <QuestionCard
        question={localizedQuestions[questionIndex]}
        questionIndex={questionIndex}
        totalQuestions={localizedQuestions.length}
        onAnswer={handleAnswer}
        onSelect={stopCountdown}
        timeRemaining={countdown}
        timerSeconds={DUEL_TIMER}
        mode="duel"
        history={answers.map(correctOf)}
        chip={chip}
      />
    </div>
  );
}

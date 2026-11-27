import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { Swords } from 'lucide-react';
import { duelAnswerChip } from '../../lib/answerPoints';
import { duelAnswer, duelNext, secondsLeft, type Serve } from '../../lib/servedQuestions';
import QuestionCard, { type AnswerChipView } from '../quiz/QuestionCard';
import { duelChipView } from '../quiz/chipText';
import { PointsChip } from '../stage';
import type { Duel, DuelAnswer } from '../../lib/types';

/** How long the "+N · 12−s" chip stays before the next duel question
 *  (presentation only). */
export const DUEL_CHIP_HOLD_MS = 900;

const DUEL_TIMER = 12; // 12 seconds per question
const DUEL_QUESTIONS = 3;

interface DuelPlayScreenProps {
  duel: Duel;
  playerId: string;
  /** The server has scored and recorded every answer (099); this only closes the screen. */
  onComplete: (answers: DuelAnswer[]) => void;
  onCancel: () => void;
}

// The server serves the three duel questions one at a time and keeps the
// clock (099): the same three for both players, drawn when the duel was
// accepted. The browser never holds the answers; each verdict comes back
// with the answer, and the third one decides the duel on the server.
export default function DuelPlayScreen({ duel, onComplete, onCancel }: DuelPlayScreenProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;

  const [serve, setServe] = useState<Serve | null>(null);
  const [verdictIndex, setVerdictIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<DuelAnswer[]>([]);
  const [countdown, setCountdown] = useState(DUEL_TIMER);
  const [finished, setFinished] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [chip, setChip] = useState<AnswerChipView | null>(null);
  const pendingRef = useRef<DuelAnswer | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Mirrors answers for the async next(); updated with each answer.
  const answersRef = useRef<DuelAnswer[]>([]);

  const stopCountdown = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const next = useCallback(async () => {
    try {
      const step = await duelNext(duel.id);
      if (step.finished) {
        setServe(null);
        setFinished(true);
        onComplete(answersRef.current);
        return;
      }
      setVerdictIndex(null);
      setChip(null);
      pendingRef.current = null;
      setServe(step);
    } catch {
      setLoadError(true);
    }
  }, [duel.id, onComplete]);

  // First question once mounted (a remount in strict mode asks once).
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => { if (live) void next(); });
    return () => { live = false; };
  }, [next]);

  // Countdown from the server's deadline, recomputed from the clock.
  useEffect(() => {
    if (!serve) return;
    const update = () => setCountdown(secondsLeft(serve.deadlineMs));
    update();
    tickRef.current = setInterval(update, 250);
    return stopCountdown;
  }, [serve, stopCountdown]);

  const handlePick = useCallback(async (original: number | null) => {
    if (!serve) return;
    stopCountdown();
    let answer: DuelAnswer;
    try {
      const v = await duelAnswer(serve.serveId, original);
      answer = {
        questionId: serve.question.id,
        answerIndex: v.timedOut || original == null ? -1 : original,
        answeredAt: new Date().toISOString(),
        responseMs: v.responseMs,
        points: v.points,
        correct: v.isCorrect,
      };
      setVerdictIndex(v.correctIndex);
    } catch {
      answer = { questionId: serve.question.id, answerIndex: -1, answeredAt: new Date().toISOString(), responseMs: DUEL_TIMER * 1000, points: 0, correct: false };
      setVerdictIndex(-1);
    }
    pendingRef.current = answer;
    setChip(duelChipView(duelAnswerChip(answer, !!answer.correct), t));
  }, [serve, stopCountdown, t]);

  const handleAnswer = useCallback(() => {
    const answer = pendingRef.current;
    if (!answer) return;
    pendingRef.current = null;
    setAnswers((prev) => [...prev, answer]);
    answersRef.current = [...answersRef.current, answer];
    void next();
  }, [next]);

  if (loadError) {
    return (
      <div className="du-play-empty">
        <p className="t-meta">{t('duelPlay.errorLoading')}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{t('duelPlay.goBack')}</button>
      </div>
    );
  }

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
              const v = duelChipView(duelAnswerChip(a, !!a.correct), t);
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

  if (!serve) {
    return (
      <div className="du-play-empty">
        <p className="t-meta">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="du-play">
      <QuestionCard
        question={serve.question}
        questionIndex={serve.position - 1}
        totalQuestions={DUEL_QUESTIONS}
        onAnswer={handleAnswer}
        onSelect={stopCountdown}
        onPick={handlePick}
        correctIndex={verdictIndex}
        timeRemaining={countdown}
        timerSeconds={DUEL_TIMER}
        mode="duel"
        history={answers.map((a) => !!a.correct)}
        chip={chip}
      />
    </div>
  );
}

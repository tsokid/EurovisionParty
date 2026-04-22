import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { QUESTIONS_BY_ID } from '../../lib/questions';
import { getLocalizedQuestion } from '../../lib/questionLocale';
import { calcDuelPoints } from '../../hooks/useDuels';
import QuestionCard from '../quiz/QuestionCard';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import type { Duel, DuelAnswer, QuizQuestion } from '../../lib/types';

const DUEL_TIMER = 12; // 12 seconds per question

interface DuelPlayScreenProps {
  duel: Duel;
  playerId: string;
  onComplete: (answers: DuelAnswer[]) => void;
  onCancel: () => void;
}

export default function DuelPlayScreen({ duel, onComplete, onCancel }: DuelPlayScreenProps) {
  const { t } = useTranslation();
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
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittedRef = useRef(false);

  // Reset timer for each question
  useEffect(() => {
    if (finished) return;

    autoSubmittedRef.current = false;
    setCountdown(DUEL_TIMER);
    setQuestionStartTime(Date.now());

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
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
    setAnswers(updatedAnswers);

    if (questionIndex + 1 < questions.length) {
      setQuestionIndex((prev) => prev + 1);
    } else {
      // All questions answered
      setFinished(true);
      if (countdownRef.current) clearInterval(countdownRef.current);
      onComplete(updatedAnswers);
    }
  }, [questionIndex, questions, answers, questionStartTime, onComplete]);

  // Auto-submit wrong answer when timer hits 0
  useEffect(() => {
    if (countdown === 0 && !finished && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleAnswer(-1, false); // -1 = timeout, 0 points
    }
  }, [countdown, finished, handleAnswer]);

  if (questions.length === 0 || questionIndex >= localizedQuestions.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
        <p className="text-white/50">{t('duelPlay.errorLoading')}</p>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t('duelPlay.goBack')}</Button>
      </div>
    );
  }

  if (finished) {
    const totalScore = answers.reduce((s, a) => s + a.points, 0);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-full gap-4 px-4"
      >
        <div className="text-5xl">⚔️</div>
        <h2 className="glow-text text-2xl font-bold">{t('duelPlay.submitted')}</h2>
        <Card className="text-center w-full max-w-xs">
          <p className="text-sm text-white/50">{t('duelPlay.yourScore')}</p>
          <p className="text-4xl font-bold glow-text-gold">{totalScore}</p>
          <p className="text-xs text-white/30 mt-1">out of 36 possible</p>
        </Card>
        <p className="text-sm text-white/40 text-center">
          {t('duelPlay.waitingOpponent')}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 py-2">
      {/* Duel header */}
      <div className="flex items-center justify-between mb-3">
        <Badge variant="purple">{t('duelPlay.header', { current: questionIndex + 1, total: questions.length })}</Badge>
        <div className="flex items-center gap-2">
          {answers.map((a, i) => (
            <span key={i} className={`text-xs font-bold ${a.points > 0 ? 'text-euro-green' : 'text-euro-red'}`}>
              {a.points > 0 ? `+${a.points}` : '0'}
            </span>
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1">
        <QuestionCard
          question={localizedQuestions[questionIndex]}
          questionIndex={questionIndex}
          totalQuestions={localizedQuestions.length}
          onAnswer={handleAnswer}
          timeRemaining={countdown}
        />
      </div>
    </div>
  );
}

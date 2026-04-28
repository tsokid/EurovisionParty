import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuiz } from '../../hooks/useQuiz';
import { useGameStore } from '../../stores/gameStore';
import { selectRoundQuestions } from '../../lib/questionRandomizer';
import { QUESTIONS } from '../../lib/questions';
import { supabase } from '../../lib/supabase';
import { fetchSeenQuestionIds } from '../../lib/usedQuestions';
import {
  TIMER_SECONDS,
  QUESTIONS_PER_ROUND,
  MAX_ROUNDS,
} from '../../lib/constants';
import type { QuizAnswer, QuizQuestion } from '../../lib/types';

import Button from '../ui/Button';
import Card from '../ui/Card';
import RoundIntro from './RoundIntro';
import QuestionCard from './QuestionCard';
import RoundResults from './RoundResults';

type QuizPhase = 'waiting' | 'intro' | 'playing' | 'results' | 'complete';

export default function QuizScreen() {
  const { t } = useTranslation();
  const { room, player, setActiveTab, quizProgress, setQuizProgress } = useGameStore();
  const quiz = useQuiz();

  const [phase, setPhase] = useState<QuizPhase>('waiting');
  const [roundNumber, setRoundNumber] = useState(1);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [roundAnswers, setRoundAnswers] = useState<QuizAnswer[]>([]);
  const [roundQuestions, setRoundQuestions] = useState<QuizQuestion[]>([]);
  const [questionOpenedAt, setQuestionOpenedAt] = useState<string>(
    new Date().toISOString(),
  );
  const [usedQuestionIds, setUsedQuestionIds] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const restoredRef = useRef(false);

  // --- Restore quiz progress on mount ---
  // Tab switch: restore from Zustand store (instant, no network)
  // Page refresh: derive from DB answers to find the correct round
  useEffect(() => {
    if (restoredRef.current || !player || !room) return;
    restoredRef.current = true;

    const stored = quizProgress;
    if (stored && stored.roomId === room.id && stored.playerId === player.id) {
      // Restore from store (tab switch)
      setPhase(stored.phase);
      setRoundNumber(stored.roundNumber);
      setQuestionIndex(stored.questionIndex);
      setUsedQuestionIds(stored.usedQuestionIds);
      setRoundAnswers(stored.roundAnswers);
      const questions = stored.questionIds
        .map((id) => QUESTIONS.find((q) => q.id === id))
        .filter(Boolean) as QuizQuestion[];
      setRoundQuestions(questions);
      return;
    }

    // No valid store — derive from DB (page refresh)
    // Fetch quiz answers to determine round progress, and ALL seen question IDs
    // (quiz + duels) so no question is repeated regardless of game mode.
    Promise.all([
      supabase
        .from('quiz_answers')
        .select('round_number, question_id')
        .eq('player_id', player.id),
      fetchSeenQuestionIds(player.id, room.id),
    ]).then(([{ data: answers }, allSeenIds]) => {
      if (!answers?.length) {
        // No quiz answers yet — but might have duel question IDs to exclude
        if (allSeenIds.length) setUsedQuestionIds(allSeenIds);
        return;
      }

      const countByRound: Record<number, number> = {};
      for (const a of answers) {
        countByRound[a.round_number] = (countByRound[a.round_number] ?? 0) + 1;
      }

      // allSeenIds already includes quiz + duel questions
      setUsedQuestionIds(allSeenIds);

      for (let r = 1; r <= MAX_ROUNDS; r++) {
        if ((countByRound[r] ?? 0) < QUESTIONS_PER_ROUND) {
          setRoundNumber(r);
          setPhase('waiting');
          return;
        }
      }
      setRoundNumber(MAX_ROUNDS);
      setPhase('complete');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, room?.id]);

  // --- Sync quiz state to store (for tab switch persistence) ---
  useEffect(() => {
    if (!player || !room || !restoredRef.current) return;
    setQuizProgress({
      roomId: room.id,
      playerId: player.id,
      phase,
      roundNumber,
      questionIndex,
      questionIds: roundQuestions.map((q) => q.id),
      usedQuestionIds,
      roundAnswers,
    });
  }, [phase, roundNumber, questionIndex, roundQuestions, usedQuestionIds, roundAnswers, player, room, setQuizProgress]);

  // Track active countdown per question
  const [countdown, setCountdown] = useState(TIMER_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittedRef = useRef(false);

  // Use a ref for handleAnswer to avoid stale closures in the timer effect
  const handleAnswerRef = useRef<(answerIndex: number, isCorrect: boolean) => void>(() => {});

  useEffect(() => {
    if (phase !== 'playing') {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    autoSubmittedRef.current = false;
    setCountdown(TIMER_SECONDS);
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
  }, [phase, questionIndex]);

  // Auto-submit wrong answer when timer hits 0 (uses ref to avoid stale closure)
  useEffect(() => {
    if (countdown === 0 && phase === 'playing' && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleAnswerRef.current(-1, false);
    }
  }, [countdown, phase]);

  // Start a round
  const handleStartRound = useCallback(() => {
    if (!room || !player) return;
    setSubmitError(null);

    const questions = selectRoundQuestions(usedQuestionIds);
    setRoundQuestions(questions);
    setUsedQuestionIds((prev) => [...prev, ...questions.map((q) => q.id)]);
    setQuestionIndex(0);
    setRoundAnswers([]);
    setQuestionOpenedAt(new Date().toISOString());
    setPhase('intro');
  }, [room, player, usedQuestionIds]);

  // Handle intro dismiss
  const handleIntroDismiss = useCallback(() => {
    setQuestionOpenedAt(new Date().toISOString());
    setPhase('playing');
  }, []);

  // Handle answer submission
  const handleAnswer = useCallback(
    async (answerIndex: number, isCorrect: boolean) => {
      if (!player || !roundQuestions[questionIndex]) return;

      const question = roundQuestions[questionIndex];
      setSubmitError(null);

      try {
        const answer = await quiz.submitAnswer(
          player.id,
          question.id,
          answerIndex,
          isCorrect,
          questionOpenedAt,
          room?.id,
          roundNumber,
        );

        setRoundAnswers((prev) => [...prev, answer]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit answer';
        // Show error briefly but still advance
        setSubmitError(msg);
        setTimeout(() => setSubmitError(null), 3000);
        setRoundAnswers((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            room_id: room?.id ?? '',
            player_id: player.id,
            round_number: roundNumber,
            question_id: question.id,
            answer_index: answerIndex >= 0 ? answerIndex : null,
            is_correct: false,
            question_opened_at: questionOpenedAt,
            answered_at: new Date().toISOString(),
            response_seconds: null,
            points_awarded: 0,
          },
        ]);
      }

      // Advance to next question or results
      if (questionIndex + 1 < QUESTIONS_PER_ROUND && questionIndex + 1 < roundQuestions.length) {
        setQuestionIndex((prev) => prev + 1);
        setQuestionOpenedAt(new Date().toISOString());
      } else {
        setPhase('results');
      }
    },
    [player, room, roundNumber, roundQuestions, questionIndex, questionOpenedAt, quiz],
  );

  // Keep the ref in sync with the latest handleAnswer
  useEffect(() => {
    handleAnswerRef.current = handleAnswer;
  }, [handleAnswer]);

  // Handle continue from results
  const handleContinue = useCallback(() => {
    if (roundNumber >= MAX_ROUNDS) {
      setPhase('complete');
    } else {
      setRoundNumber((prev) => prev + 1);
      setPhase('waiting');
    }
  }, [roundNumber]);

  // Loading state
  if (!room || !player) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-euro-purple border-t-transparent rounded-full animate-spin" />
        <p className="text-white/50 text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 py-2">
      <AnimatePresence mode="wait">
        {/* WAITING PHASE */}
        {phase === 'waiting' && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center flex-1 gap-6"
          >
            <div className="text-5xl mb-2">🎵</div>
            <h2 className="glow-text text-2xl font-bold text-center">
              {t('quiz.title')}
            </h2>
            <p className="text-white/60 text-center">
              {t('quiz.roundOf', { current: roundNumber, max: MAX_ROUNDS })}
            </p>
            <Button size="lg" onClick={handleStartRound}>
              {t('quiz.startRound', { num: roundNumber })}
            </Button>
            <p className="text-xs text-white/30 text-center max-w-xs">
              {t('quiz.hint', { count: QUESTIONS_PER_ROUND, timer: TIMER_SECONDS })}
            </p>
          </motion.div>
        )}

        {/* ROUND INTRO */}
        {phase === 'intro' && (
          <RoundIntro
            key={`intro-${roundNumber}`}
            roundNumber={roundNumber}
            onDismiss={handleIntroDismiss}
          />
        )}

        {/* PLAYING PHASE */}
        {phase === 'playing' && roundQuestions[questionIndex] && (
          <motion.div
            key={`playing-${questionIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1"
          >
            <QuestionCard
              question={roundQuestions[questionIndex]}
              questionIndex={questionIndex}
              totalQuestions={roundQuestions.length}
              onAnswer={handleAnswer}
              timeRemaining={countdown}
            />
          </motion.div>
        )}

        {/* RESULTS PHASE */}
        {phase === 'results' && (
          <motion.div
            key={`results-${roundNumber}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1"
          >
            <RoundResults
              roundNumber={roundNumber}
              answers={roundAnswers}
              questions={roundQuestions}
              onContinue={handleContinue}
              isLastRound={roundNumber >= MAX_ROUNDS}
            />
          </motion.div>
        )}

        {/* QUIZ COMPLETE */}
        {phase === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center flex-1 gap-4"
          >
            <motion.div
              className="text-6xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              🏆
            </motion.div>
            <h2 className="glow-text text-3xl font-extrabold">
              {t('quiz.completeTitle')}
            </h2>
            <p className="text-white/60 text-center max-w-xs">
              {t('quiz.completeDesc', { max: MAX_ROUNDS })}
            </p>
            <Card className="text-center">
              <p className="text-sm text-white/50">{t('quiz.yourPoints')}</p>
              <p className="text-3xl font-bold glow-text-gold">
                {player.quiz_points}
              </p>
            </Card>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('leaderboard')}
            >
              {t('quiz.viewBoard')}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error display — auto-dismisses after 3s */}
      <AnimatePresence>
        {(submitError || quiz.error) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-4 p-3 rounded-xl bg-euro-red/20 border border-euro-red/30 text-euro-red text-sm text-center"
          >
            {submitError || quiz.error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

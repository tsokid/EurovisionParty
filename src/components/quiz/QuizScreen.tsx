import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuiz } from '../../hooks/useQuiz';
import { useGameStore } from '../../stores/gameStore';
import { selectRoundQuestions } from '../../lib/questionRandomizer';
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
  const { room, player, setActiveTab } = useGameStore();
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
        <p className="text-white/50 text-sm">Loading quiz...</p>
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
              Quiz Time!
            </h2>
            <p className="text-white/60 text-center">
              Round {roundNumber} of {MAX_ROUNDS}
            </p>
            <Button size="lg" onClick={handleStartRound}>
              🎶 Start Round {roundNumber}
            </Button>
            <p className="text-xs text-white/30 text-center max-w-xs">
              {QUESTIONS_PER_ROUND} questions · {TIMER_SECONDS}s each · Play at your own pace
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
              Quiz Complete!
            </h2>
            <p className="text-white/60 text-center max-w-xs">
              All {MAX_ROUNDS} rounds finished!
            </p>
            <Card className="text-center">
              <p className="text-sm text-white/50">Your quiz points</p>
              <p className="text-3xl font-bold glow-text-gold">
                {player.quiz_points}
              </p>
            </Card>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('leaderboard')}
            >
              📊 View Leaderboard
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

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
  const { room, player, players, setActiveTab, quizProgress, setQuizProgress } = useGameStore();
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

  // Per-round breakdown + best streak — populated when quiz completes.
  // Keyed by round_number → { correct, total, points }. Fetches all of
  // this player's quiz_answers in this room and groups them.
  const [completionSummary, setCompletionSummary] = useState<{
    rounds: { round: number; correct: number; total: number; points: number }[];
    bestStreak: number;
  } | null>(null);

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

  // Build the per-round / best-streak summary when the quiz completes.
  // We fetch from quiz_answers rather than relying on roundAnswers state
  // because that resets between rounds — by 'complete' it only has the
  // final round's data. Order by (round_number, answered_at) so the
  // streak walk is deterministic.
  useEffect(() => {
    if (phase !== 'complete' || !player || !room || completionSummary) return;
    let cancelled = false;
    supabase
      .from('quiz_answers')
      .select('round_number, is_correct, points_awarded, answered_at')
      .eq('player_id', player.id)
      .eq('room_id', room.id)
      .order('round_number', { ascending: true })
      .order('answered_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const byRound: Record<number, { round: number; correct: number; total: number; points: number }> = {};
        let bestStreak = 0;
        let currentStreak = 0;
        for (const a of data as Array<{ round_number: number; is_correct: boolean; points_awarded: number | null }>) {
          const r = a.round_number;
          if (!byRound[r]) byRound[r] = { round: r, correct: 0, total: 0, points: 0 };
          byRound[r].total += 1;
          if (a.is_correct) {
            byRound[r].correct += 1;
            byRound[r].points += a.points_awarded ?? 0;
            currentStreak += 1;
            if (currentStreak > bestStreak) bestStreak = currentStreak;
          } else {
            currentStreak = 0;
          }
        }
        const rounds = Object.values(byRound).sort((a, b) => a.round - b.round);
        setCompletionSummary({ rounds, bestStreak });
      });
    return () => { cancelled = true; };
  }, [phase, player, room, completionSummary]);

  // Track active countdown per question
  const [countdown, setCountdown] = useState(TIMER_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittedRef = useRef(false);

  // Use a ref for handleAnswer to avoid stale closures in the timer effect
  const handleAnswerRef = useRef<(answerIndex: number, isCorrect: boolean) => void>(() => {});

  // Stop the running countdown without resetting its displayed value.
  // Used by onSelect (when the user picks) and on unmount.
  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    // Block the auto-submit-on-zero effect from firing for this question.
    autoSubmittedRef.current = true;
  }, []);

  useEffect(() => {
    if (phase !== 'playing') {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    autoSubmittedRef.current = false;
    setCountdown(TIMER_SECONDS);

    // Defer the actual interval until the question card has finished its
    // entrance animation (~500ms spring) so the clock isn't already
    // counting down before the user can read or click an answer.
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
              onSelect={stopCountdown}
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
        {phase === 'complete' && (() => {
          const ranked = [...players]
            .filter((p) => p.is_active)
            .sort((a, b) => (b.quiz_points ?? 0) - (a.quiz_points ?? 0));
          const myRank = Math.max(1, ranked.findIndex((p) => p.id === player.id) + 1);
          const top3 = ranked.slice(0, 3);

          return (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col flex-1 gap-5 sm:gap-6 max-w-3xl w-full mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-6"
            >
              {/* Header: trophy + title */}
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  className="text-6xl sm:text-7xl"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  🏆
                </motion.div>
                <h2 className="glow-text text-2xl sm:text-3xl lg:text-4xl font-extrabold text-center">
                  {t('quiz.completeTitle')}
                </h2>
                <p className="text-white/60 text-center text-sm sm:text-base">
                  {t('quiz.completeDesc', { max: MAX_ROUNDS })}
                </p>
              </div>

              {/* Top stat trio: total points · best streak · rank */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <Card className="text-center py-4 sm:py-5">
                  <p className="text-xs sm:text-sm text-white/55 font-medium">{t('quiz.totalPoints')}</p>
                  <motion.p
                    className="text-3xl sm:text-4xl lg:text-5xl font-extrabold glow-text-gold mt-1 tabular-nums"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', damping: 12 }}
                  >
                    {player.quiz_points}
                  </motion.p>
                </Card>
                <Card className="text-center py-4 sm:py-5">
                  <p className="text-xs sm:text-sm text-white/55 font-medium">{t('quiz.bestStreak')}</p>
                  <motion.p
                    className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-euro-cyan mt-1 tabular-nums"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: 'spring', damping: 12 }}
                  >
                    {completionSummary?.bestStreak ?? '—'}
                  </motion.p>
                </Card>
                <Card className="text-center py-4 sm:py-5">
                  <p className="text-xs sm:text-sm text-white/55 font-medium">{t('quiz.yourRank')}</p>
                  <motion.p
                    className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-euro-purple-light mt-1 tabular-nums"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: 'spring', damping: 12 }}
                  >
                    #{myRank}
                  </motion.p>
                  <p className="text-xs text-white/40 font-medium mt-0.5">
                    of {ranked.length}
                  </p>
                </Card>
              </div>

              {/* Per-round breakdown */}
              {completionSummary && completionSummary.rounds.length > 0 && (
                <div>
                  <p className="text-sm sm:text-base text-white/55 font-semibold mb-2 px-1">
                    {t('quiz.roundBreakdown')}
                  </p>
                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    {completionSummary.rounds.map((r, i) => (
                      <motion.div
                        key={r.round}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + i * 0.06 }}
                      >
                        <Card className="text-center py-3 sm:py-4">
                          <p className="text-xs sm:text-sm text-white/55 font-medium">
                            {t('quiz.roundLabel', { num: r.round })}
                          </p>
                          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tabular-nums">
                            {r.correct}<span className="text-white/35">/{r.total}</span>
                          </p>
                          <p className="text-xs sm:text-sm text-euro-gold font-bold mt-0.5">
                            +{r.points} {t('quiz.ptsSuffix')}
                          </p>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top 3 in room */}
              {top3.length > 0 && (
                <Card className="py-4">
                  <p className="text-sm sm:text-base text-white/55 font-semibold mb-2 px-1">
                    {t('quiz.topInRoom')}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {top3.map((p, i) => {
                      const isMe = p.id === player.id;
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                      return (
                        <li
                          key={p.id}
                          className={`flex items-center gap-3 px-2 py-2 rounded-lg ${
                            isMe ? 'bg-euro-purple/20 border border-euro-purple/40' : ''
                          }`}
                        >
                          <span className="text-lg w-7 text-center" aria-hidden>{medal}</span>
                          <span className="text-xl sm:text-2xl leading-none" aria-hidden>{p.avatar_emoji ?? '🎤'}</span>
                          <span className={`flex-1 text-sm sm:text-base font-semibold truncate ${isMe ? 'text-white' : 'text-white/85'}`}>
                            {p.name}
                            {isMe && (
                              <span className="ml-1.5 text-xs sm:text-sm text-euro-purple-light font-medium">
                                ({t('quiz.youLabel')})
                              </span>
                            )}
                          </span>
                          <span className="text-sm sm:text-base font-bold text-euro-gold tabular-nums">
                            {p.quiz_points ?? 0}
                            <span className="text-xs sm:text-sm text-white/45 font-medium ml-1">
                              {t('quiz.ptsSuffix')}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-1">
                <Button
                  size="md"
                  fullWidth
                  onClick={() => setActiveTab('leaderboard')}
                >
                  {t('quiz.viewBoard')}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => setActiveTab('duels')}
                >
                  {t('quiz.challengeFriend')}
                </Button>
              </div>
            </motion.div>
          );
        })()}
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

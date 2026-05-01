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
import { Trophy, Flame, Zap, Swords, BarChart3 } from 'lucide-react';

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

  // Per-round breakdown + best streak + accuracy + fastest correct
  // answer — populated when quiz completes. Fetches all of this
  // player's quiz_answers in this room and aggregates.
  const [completionSummary, setCompletionSummary] = useState<{
    rounds: { round: number; correct: number; total: number; points: number }[];
    bestStreak: number;
    totalCorrect: number;
    totalAnswered: number;
    fastestSeconds: number | null;
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
      .select('round_number, is_correct, points_awarded, response_seconds, answered_at')
      .eq('player_id', player.id)
      .eq('room_id', room.id)
      .order('round_number', { ascending: true })
      .order('answered_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const byRound: Record<number, { round: number; correct: number; total: number; points: number }> = {};
        let bestStreak = 0;
        let currentStreak = 0;
        let totalCorrect = 0;
        let fastestSeconds: number | null = null;
        for (const a of data as Array<{ round_number: number; is_correct: boolean; points_awarded: number | null; response_seconds: number | null }>) {
          const r = a.round_number;
          if (!byRound[r]) byRound[r] = { round: r, correct: 0, total: 0, points: 0 };
          byRound[r].total += 1;

          if (a.is_correct) {
            byRound[r].correct += 1;
            byRound[r].points += a.points_awarded ?? 0;
            totalCorrect += 1;
            currentStreak += 1;
            if (currentStreak > bestStreak) bestStreak = currentStreak;
            const secs = a.response_seconds;
            if (secs != null && secs > 0 && (fastestSeconds === null || secs < fastestSeconds)) {
              fastestSeconds = secs;
            }
          } else {
            currentStreak = 0;
          }
        }
        const rounds = Object.values(byRound).sort((a, b) => a.round - b.round);

        setCompletionSummary({
          rounds,
          bestStreak,
          totalCorrect,
          totalAnswered: data.length,
          fastestSeconds,
        });
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
          const totalCorrect = completionSummary?.totalCorrect ?? 0;
          const totalAnswered = completionSummary?.totalAnswered ?? 0;
          const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

          return (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col flex-1 gap-5 sm:gap-6 max-w-2xl w-full mx-auto px-2 sm:px-4 py-2 sm:py-4"
            >
              {/* QUIZ COMPLETE pill */}
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-euro-gold/15 border border-euro-gold/40 px-4 py-1.5 text-xs sm:text-sm font-bold tracking-[0.18em] text-euro-gold">
                  <Trophy className="w-4 h-4" strokeWidth={2.4} />
                  {t('quiz.completePill')}
                </span>
              </div>

              {/* Main score card */}
              <Card className="py-6 sm:py-8 px-4 sm:px-6">
                {/* Final score */}
                <div className="flex flex-col items-center text-center">
                  <p className="text-xs sm:text-sm font-bold tracking-[0.16em] text-white/60">
                    {t('quiz.finalScoreLabel')}
                  </p>
                  <motion.p
                    className="text-5xl sm:text-7xl font-extrabold tabular-nums mt-2 bg-gradient-to-r from-euro-purple-light to-euro-pink bg-clip-text text-transparent"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', damping: 12 }}
                  >
                    {player.quiz_points.toLocaleString()}
                  </motion.p>
                  <p className="text-sm sm:text-base text-white/65 mt-2">
                    {completionSummary
                      ? t('quiz.scoreSubline', {
                          correct: totalCorrect,
                          total: totalAnswered,
                          rank: myRank,
                          players: ranked.length,
                        })
                      : t('quiz.completeDesc', { max: MAX_ROUNDS })}
                  </p>
                </div>

                {/* Per-round bars */}
                {completionSummary && completionSummary.rounds.length > 0 && (
                  <div className="mt-6 sm:mt-7 flex flex-col gap-3">
                    {completionSummary.rounds.map((r, i) => {
                      const accPct = r.total > 0 ? (r.correct / r.total) * 100 : 0;
                      return (
                        <motion.div
                          key={r.round}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.07 }}
                          className="rounded-xl bg-white/[0.04] border border-white/8 px-3 sm:px-4 py-3"
                        >
                          <div className="flex items-center justify-between text-sm sm:text-base font-semibold">
                            <span className="text-white">{t('quiz.roundLabel', { num: r.round })}</span>
                            <span className="text-white/65 tabular-nums">
                              {r.correct}/{r.total}
                              <span className="text-white/35 mx-2">·</span>
                              <span className="text-euro-gold">{r.points} {t('quiz.ptsSuffix')}</span>
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-euro-purple to-euro-pink"
                              initial={{ width: 0 }}
                              animate={{ width: `${accPct}%` }}
                              transition={{ delay: 0.3 + i * 0.07, duration: 0.6 }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Stat trio: best streak · accuracy · top category */}
                {completionSummary && (
                  <div className="mt-5 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-xl bg-white/[0.04] border border-white/8 px-2 sm:px-3 py-3">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide text-white/55">
                        <Flame className="w-3.5 h-3.5 text-orange-400" strokeWidth={2.2} />
                        <span className="uppercase">{t('quiz.bestStreak')}</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-extrabold text-white mt-1 tabular-nums">
                        {completionSummary.bestStreak}×
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/[0.04] border border-white/8 px-2 sm:px-3 py-3">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide text-white/55">
                        <BarChart3 className="w-3.5 h-3.5 text-euro-cyan" strokeWidth={2.2} />
                        <span className="uppercase">{t('quiz.accuracy')}</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-extrabold text-white mt-1 tabular-nums">
                        {accuracy}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/[0.04] border border-white/8 px-2 sm:px-3 py-3">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide text-white/55">
                        <Zap className="w-3.5 h-3.5 text-euro-gold" strokeWidth={2.4} />
                        <span className="uppercase">{t('quiz.fastest')}</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-extrabold text-white mt-1 tabular-nums">
                        {completionSummary.fastestSeconds != null
                          ? t('quiz.fastestValue', {
                              seconds: completionSummary.fastestSeconds.toFixed(1),
                            })
                          : t('quiz.noFastest')}
                      </p>
                    </div>
                  </div>
                )}

                {/* CTAs */}
                <div className="mt-6 sm:mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <Button
                    size="md"
                    fullWidth
                    onClick={() => setActiveTab('duels')}
                  >
                    <Swords className="w-4 h-4" strokeWidth={2.2} />
                    {t('quiz.continueDuels')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    onClick={() => setActiveTab('leaderboard')}
                  >
                    <Trophy className="w-4 h-4" strokeWidth={2.2} />
                    {t('quiz.viewLeaderboard')}
                  </Button>
                </div>

                {/* Tagline */}
                <p className="mt-4 text-center text-xs sm:text-sm text-white/45">
                  {t('quiz.scoresCarry')}
                </p>
              </Card>

              {/* Round indicator dots — visual echo of the reference */}
              <div className="flex justify-center gap-2 mt-1">
                {Array.from({ length: MAX_ROUNDS }).map((_, i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-euro-green/80"
                    aria-hidden
                  />
                ))}
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

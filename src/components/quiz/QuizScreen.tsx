import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import { supabase } from '../../lib/supabase';
import { quizAnswer, quizNext, quizState, secondsLeft, type Serve } from '../../lib/servedQuestions';
import {
  TIMER_SECONDS,
  QUESTIONS_PER_ROUND,
  MAX_ROUNDS,
} from '../../lib/constants';
import type { QuizAnswer } from '../../lib/types';
import type { Standing } from '../../lib/roundStandings';
import { quizAnswerChip } from '../../lib/answerPoints';
import { quizChipView } from './chipText';
import type { AnswerChipView } from './QuestionCard';
import { Trophy, Flame, Zap, Swords, BarChart3, Music, Sparkles, ListChecks, Clock, Activity } from 'lucide-react';

import Button from '../ui/Button';
import Card from '../ui/Card';
import RoundIntro from './RoundIntro';
import QuestionCard from './QuestionCard';
import RoundResults from './RoundResults';
import { markPlayed, quizCompleteKey, wasPlayed } from '../../lib/playedOnce';

type QuizPhase = 'waiting' | 'intro' | 'playing' | 'results' | 'complete';

/** How long the answer's "+N · 2,1″" chip stays before the next question
 *  (presentation only). Kept for the duel screen and tests. */
export const CHIP_HOLD_MS = 900;

// The server serves each question and keeps its clock (099): a question's
// time runs from the moment it is served, even if the player leaves the
// tab or the app (owner decision 1a). On return the player sees the round
// and question they are at and presses Start (resume). The browser never
// holds the correct answer: it arrives with the verdict.
export default function QuizScreen() {
  const { t, i18n } = useTranslation();
  const { room, player, players, setActiveTab } = useGameStore();

  const [phase, setPhase] = useState<QuizPhase>('waiting');
  const [roundNumber, setRoundNumber] = useState(1);
  // 0-based position of the question on screen (or next to serve).
  const [questionIndex, setQuestionIndex] = useState(0);
  const [roundAnswers, setRoundAnswers] = useState<QuizAnswer[]>([]);
  const [serve, setServe] = useState<Serve | null>(null);
  // The server's correct option for the question on screen, once answered.
  const [verdictIndex, setVerdictIndex] = useState<number | null>(null);
  const pendingRef = useRef<QuizAnswer | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Room totals when the round started: the round-end leaderboard reorders from these.
  const [roundStartStandings, setRoundStartStandings] = useState<Standing[] | null>(null);
  // The scored chip of the answer on screen (motion map #8).
  const [answerChip, setAnswerChip] = useState<AnswerChipView | null>(null);
  // The player is mid-round (came back): the waiting card says where.
  const [resuming, setResuming] = useState(false);
  const [restored, setRestored] = useState(false);

  // The «quiz complete» entrance plays once per browser: decided the first
  // time this mount reaches 'complete', marked seen as soon as it shows.
  const completeKey = room && player ? quizCompleteKey(room.id, player.id) : null;
  const completePlayIn = useRef<boolean | null>(null);
  if (phase === 'complete' && completePlayIn.current === null && completeKey) {
    completePlayIn.current = !wasPlayed(completeKey);
  }
  useEffect(() => {
    if (phase === 'complete' && completeKey) markPlayed(completeKey);
  }, [phase, completeKey]);
  const playIn = completePlayIn.current === true;

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

  // --- Where the player is: asked from the server on every mount ---
  useEffect(() => {
    if (!player || !room) return;
    let live = true;
    void (async () => {
      try {
        const s = await quizState(room.id);
        if (!live) return;
        if (s.done) {
          setRoundNumber(MAX_ROUNDS);
          setPhase('complete');
          setRestored(true);
          return;
        }
        setRoundNumber(s.round);
        setQuestionIndex(s.position - 1);
        setResuming(s.answered > 0 || s.open != null);
        if (s.answered > 0) {
          const { data } = await supabase
            .from('quiz_answers')
            .select('*')
            .eq('player_id', player.id)
            .eq('room_id', room.id)
            .eq('round_number', s.round)
            .order('answered_at', { ascending: true });
          if (live) setRoundAnswers((data ?? []) as QuizAnswer[]);
        }
      } catch (err) {
        if (live) setSubmitError(err instanceof Error ? err.message : String(err));
      } finally {
        if (live) setRestored(true);
      }
    })();
    return () => { live = false; };
  }, [player?.id, room?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the per-round / best-streak summary when the quiz completes.
  // Primary source: quiz_answers table (authoritative, persisted).
  // Fallback: roundAnswers local state covers the last round when its DB
  // inserts failed the timing constraint (e.g., slow network + auto-submit
  // right at the 15s mark) — so the Round 3 bar never disappears.
  useEffect(() => {
    if (phase !== 'complete' || !player || !room || completionSummary) return;
    const capturedRoundAnswers = roundAnswers;
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

        const processAnswer = (r: number, isCorrect: boolean, pointsAwarded: number | null, responseSecs: number | null) => {
          if (!byRound[r]) byRound[r] = { round: r, correct: 0, total: 0, points: 0 };
          byRound[r].total += 1;
          if (isCorrect) {
            byRound[r].correct += 1;
            byRound[r].points += pointsAwarded ?? 0;
            totalCorrect += 1;
            currentStreak += 1;
            if (currentStreak > bestStreak) bestStreak = currentStreak;
            if (responseSecs != null && responseSecs > 0 && (fastestSeconds === null || responseSecs < fastestSeconds)) {
              fastestSeconds = responseSecs;
            }
          } else {
            currentStreak = 0;
          }
        };

        for (const a of data as Array<{ round_number: number; is_correct: boolean; points_awarded: number | null; response_seconds: number | null }>) {
          processAnswer(a.round_number, a.is_correct, a.points_awarded, a.response_seconds);
        }

        // If the last round is absent from DB (timing constraint failure on slow network),
        // fall back to local roundAnswers which always has the most-recently-played round.
        if (!byRound[MAX_ROUNDS] && capturedRoundAnswers.length > 0 && capturedRoundAnswers[0]?.round_number === MAX_ROUNDS) {
          for (const a of capturedRoundAnswers) {
            processAnswer(a.round_number, a.is_correct ?? false, a.points_awarded, a.response_seconds);
          }
        }

        const rounds = Object.values(byRound).sort((a, b) => a.round - b.round);

        setCompletionSummary({
          rounds,
          bestStreak,
          totalCorrect,
          totalAnswered: data.length + (byRound[MAX_ROUNDS] && !data.some((a: { round_number: number }) => a.round_number === MAX_ROUNDS) ? (byRound[MAX_ROUNDS]?.total ?? 0) : 0),
          fastestSeconds,
        });
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, player, room, completionSummary]);

  // The countdown follows the server's deadline. It is recomputed from the
  // clock (not decremented), so a hidden tab or a minimised app comes back
  // showing the real time left.
  const [countdown, setCountdown] = useState(TIMER_SECONDS);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopCountdown = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);
  useEffect(() => {
    if (phase !== 'playing' || !serve) return;
    const update = () => setCountdown(secondsLeft(serve.deadlineMs));
    update();
    tickRef.current = setInterval(update, 250);
    const onVisible = () => { if (document.visibilityState === 'visible' && tickRef.current) update(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopCountdown();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, serve, stopCountdown]);

  // Ask the server for the next question of this round.
  const serveNext = useCallback(async () => {
    if (!room) return;
    setSubmitError(null);
    setBusy(true);
    try {
      const s = await quizNext(room.id, roundNumber);
      setVerdictIndex(null);
      setAnswerChip(null);
      pendingRef.current = null;
      setServe(s);
      setQuestionIndex(s.position - 1);
      setResuming(false);
      setPhase('playing');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to load the question');
    } finally {
      setBusy(false);
    }
  }, [room, roundNumber]);

  // Start (or resume) the round. A fresh round shows its intro first and is
  // served after it, so the first question's clock does not run during it.
  const handleStartRound = useCallback(() => {
    if (!room || !player || busy) return;
    if (questionIndex === 0 && !resuming) {
      setRoundAnswers([]);
      setRoundStartStandings(players.map((p) => ({ id: p.id, total: p.total_points ?? 0 })));
      setPhase('intro');
      return;
    }
    void serveNext();
  }, [room, player, players, busy, questionIndex, resuming, serveNext]);

  const handleIntroDismiss = useCallback(() => { void serveNext(); }, [serveNext]);

  // The pick (or the timeout) goes to the server, which answers with the
  // verdict and the correct option; the card then reveals.
  const handlePick = useCallback(async (original: number | null) => {
    if (!serve || !player) return;
    stopCountdown();
    let recorded: QuizAnswer;
    try {
      const v = await quizAnswer(serve.serveId, original);
      recorded = {
        id: v.answerId ?? `served-${serve.serveId}`,
        room_id: room?.id ?? '',
        player_id: player.id,
        round_number: roundNumber,
        question_id: serve.question.id,
        answer_index: v.timedOut ? null : original,
        is_correct: v.isCorrect,
        question_opened_at: new Date(serve.deadlineMs - serve.timerMs).toISOString(),
        answered_at: new Date().toISOString(),
        response_seconds: v.responseSeconds,
        points_awarded: v.points,
      };
      setVerdictIndex(v.correctIndex);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit answer');
      recorded = {
        id: `local-${Date.now()}`, room_id: room?.id ?? '', player_id: player.id, round_number: roundNumber,
        question_id: serve.question.id, answer_index: null, is_correct: false,
        question_opened_at: new Date().toISOString(), answered_at: new Date().toISOString(),
        response_seconds: null, points_awarded: 0,
      };
      setVerdictIndex(-1);
    }
    pendingRef.current = recorded;
    setAnswerChip(quizChipView(quizAnswerChip(recorded), t, i18n.language ?? 'el'));
  }, [serve, player, room, roundNumber, stopCountdown, t, i18n.language]);

  // After the reveal: next question, or the round's results.
  const handleAnswer = useCallback(() => {
    const recorded = pendingRef.current;
    if (!recorded || !serve) return;
    pendingRef.current = null;
    setRoundAnswers((prev) => [...prev, recorded]);
    setAnswerChip(null);
    if (serve.position < QUESTIONS_PER_ROUND) {
      void serveNext();
    } else {
      setServe(null);
      setPhase('results');
    }
  }, [serve, serveNext]);

  // Handle continue from results
  const handleContinue = useCallback(() => {
    if (roundNumber >= MAX_ROUNDS) {
      setPhase('complete');
    } else {
      setRoundNumber((prev) => prev + 1);
      setQuestionIndex(0);
      setResuming(false);
      setPhase('waiting');
    }
  }, [roundNumber]);

  // Loading state — also covers the restoration window so a player who
  // already finished all 3 rounds doesn't see a "Start Round 1" flash
  // before the DB query confirms phase = 'complete'.
  if (!room || !player || !restored) {
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
            className="flex flex-col flex-1 max-w-3xl w-full mx-auto px-3 sm:px-5 lg:px-6 pb-6 gap-5"
          >
            {/* Round indicator pill */}
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-euro-purple/15 border border-euro-purple/40 px-4 py-1.5 text-xs sm:text-sm font-bold tracking-[0.16em] text-euro-purple-light">
                <span className="w-1.5 h-1.5 rounded-full bg-euro-pink animate-pulse" aria-hidden />
                {t('quiz.roundIndicator', { current: roundNumber, max: MAX_ROUNDS })}
              </span>
            </div>

            {/* Main waiting card */}
            <Card className="py-7 sm:py-9 px-4 sm:px-6">
              {/* Glowing music note icon with sparkle */}
              <div className="flex justify-center">
                <div className="relative">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 12, delay: 0.05 }}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-euro-pink to-euro-purple flex items-center justify-center shadow-[0_0_40px_rgba(236,72,153,0.55)]"
                  >
                    <Music className="w-9 h-9 sm:w-11 sm:h-11 text-white" strokeWidth={2.4} />
                  </motion.div>
                  <Sparkles
                    className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 text-white/90"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </div>
              </div>

              {/* Title + subtitle */}
              <div className="mt-5 text-center">
                <h2 className="glow-text text-3xl sm:text-4xl font-extrabold">
                  {t('quiz.title')}
                </h2>
                <p className="text-white/65 text-sm sm:text-base mt-2 max-w-md mx-auto">
                  {t('quiz.warmup')}
                </p>
              </div>

              {/* 3 stat tiles: questions / per question / pace */}
              <div className="mt-5 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-xl bg-white/[0.04] border border-white/8 px-2 sm:px-3 py-3">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide text-white/55">
                    <ListChecks className="w-3.5 h-3.5 text-euro-purple-light" strokeWidth={2.4} />
                    <span className="uppercase">{t('quiz.statQuestionsLabel')}</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-white mt-1 tabular-nums">
                    {QUESTIONS_PER_ROUND}
                  </p>
                </div>
                <div className="rounded-xl bg-white/[0.04] border border-white/8 px-2 sm:px-3 py-3">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide text-white/55">
                    <Clock className="w-3.5 h-3.5 text-euro-cyan" strokeWidth={2.4} />
                    <span className="uppercase">{t('quiz.statPerQuestionLabel')}</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-white mt-1 tabular-nums">
                    {TIMER_SECONDS}s
                  </p>
                </div>
                <div className="rounded-xl bg-white/[0.04] border border-white/8 px-2 sm:px-3 py-3">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide text-white/55">
                    <Activity className="w-3.5 h-3.5 text-euro-gold" strokeWidth={2.4} />
                    <span className="uppercase">{t('quiz.statPaceLabel')}</span>
                  </div>
                  <p className="text-base sm:text-lg font-extrabold text-white mt-1 truncate">
                    {t('quiz.paceYours')}
                  </p>
                </div>
              </div>

              {/* Primary CTA */}
              <div className="mt-6 sm:mt-7">
                {resuming && (
                  <p className="mb-3 text-center text-sm sm:text-base font-semibold text-white/80" data-testid="quiz-resume">
                    {t('quiz.resumeAt', { round: roundNumber, num: questionIndex + 1, max: QUESTIONS_PER_ROUND })}
                  </p>
                )}
                <Button size="lg" fullWidth onClick={handleStartRound} disabled={busy}>
                  <Sparkles className="w-4 h-4" strokeWidth={2.2} />
                  {resuming ? t('quiz.resumeStart') : t('quiz.startRound', { num: roundNumber })}
                </Button>
              </div>

              {/* Tip footer */}
              <p className="mt-3 text-center text-xs sm:text-sm text-white/45">
                {t('quiz.tipFooter')}
              </p>
            </Card>

            {/* Round dots indicator */}
            <div className="flex justify-center gap-2 mt-1">
              {Array.from({ length: MAX_ROUNDS }).map((_, i) => {
                const dotRound = i + 1;
                const isActive = dotRound === roundNumber;
                const isComplete = dotRound < roundNumber;
                return (
                  <span
                    key={i}
                    className={clsx(
                      'rounded-full transition-all',
                      isActive ? 'w-3 h-3 bg-euro-pink shadow-[0_0_8px_rgba(236,72,153,0.6)]'
                        : isComplete ? 'w-2 h-2 bg-euro-green/80'
                        : 'w-2 h-2 bg-white/15',
                    )}
                    aria-hidden
                  />
                );
              })}
            </div>
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
        {phase === 'playing' && serve && (
          <motion.div
            key={`playing-${questionIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1"
          >
            <QuestionCard
              question={serve.question}
              questionIndex={questionIndex}
              totalQuestions={QUESTIONS_PER_ROUND}
              onAnswer={handleAnswer}
              onSelect={stopCountdown}
              onPick={handlePick}
              correctIndex={verdictIndex}
              timeRemaining={countdown}
              roundNumber={roundNumber}
              history={roundAnswers.map((a) => !!a.is_correct)}
              chip={answerChip}
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
              questions={[]}
              onContinue={handleContinue}
              isLastRound={roundNumber >= MAX_ROUNDS}
              standingsBefore={roundStartStandings}
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
              initial={playIn ? { opacity: 0, scale: 0.97 } : false}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col flex-1 gap-5 sm:gap-6 max-w-3xl w-full mx-auto px-3 sm:px-5 lg:px-6 pb-6"
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
                    initial={playIn ? { scale: 0.92, opacity: 0 } : false}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.05, duration: 0.25, ease: 'easeOut' }}
                  >
                    {(completionSummary
                      ? completionSummary.rounds.reduce((sum, r) => sum + r.points, 0)
                      : player.quiz_points
                    ).toLocaleString()}
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
                          initial={playIn ? { opacity: 0, x: -10 } : false}
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
                              initial={playIn ? { width: 0 } : false}
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
        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-4 p-3 rounded-xl bg-euro-red/20 border border-euro-red/30 text-euro-red text-sm text-center"
          >
            {submitError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

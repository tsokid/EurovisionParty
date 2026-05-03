// src/components/winners/SuddenDeathPanel.tsx
//
// Champion-only sudden-death tiebreak.
//
// Flow:
//   1. Host clicks "Start Sudden Death" → server picks 3 random quiz
//      questions and inserts a 3-row match into sudden_death_rounds.
//   2. All players see the current round's question. Tied players
//      submit; non-tied players watch.
//   3. Each round has 15 s. After it closes the correct answer is
//      revealed for ~2 s, then the next question appears.
//   4. After Round 3, the host's client calls resolve_sudden_death_match
//      which scopes to tied players, picks the best (correct count,
//      then speed), updates `winners`, and calls onResolved so the
//      WinnersScreen re-fetches and shows the new single champion.
//
// Realtime: subscribes to sudden_death_rounds and sudden_death_answers
// for the live match (added to supabase_realtime in migration 049).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { supabase } from '../../lib/supabase';
import { useGameStore } from '../../stores/gameStore';
import { avatarGradient, avatarInitial } from '../../lib/avatarUtils';
// Question bank is shipped as static JSON, not a Postgres table — same
// source the regular Quiz tab uses, so SD inherits the same 500-Q pool.
import { QUESTIONS, QUESTIONS_BY_ID } from '../../lib/questions';

const REVEAL_MS = 2000;     // how long to show the correct answer
// Per-round duration is owned by migration 031 (15 s baked into closes_at).
// We just read closes_at and run a local clock against it.

interface RoundRow {
  id: string;
  match_id: string;
  question_id: number;
  question_index: number;
  opened_at: string;
  closes_at: string;
  status: string;
  winner_player_id: string | null;
}

interface AnswerRow {
  round_id: string;
  player_id: string;
  answer_index: number;
  is_correct: boolean;
  response_ms: number | null;
}

interface Props {
  roomId: string;
  isHost: boolean;
  /** Player IDs currently tied at the top — the only ones whose
   *  answers count toward the SD winner. */
  tiedPlayerIds: string[];
  /** Map id → display name for the tied players (UI only). */
  tiedPlayerNames: Record<string, string>;
  onResolved: () => void;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

export default function SuddenDeathPanel({
  roomId, isHost, tiedPlayerIds, tiedPlayerNames, onResolved,
}: Props) {
  const { t } = useTranslation();
  const { player } = useGameStore();
  const myId = player?.id ?? null;
  const amTied = !!myId && tiedPlayerIds.includes(myId);

  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [answers, setAnswers]   = useState<AnswerRow[]>([]);
  // Question lookup is derived from the static bank — the only DB call
  // we do for questions is via question_id stored on each round row.
  const questions = QUESTIONS_BY_ID;
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [now, setNow]           = useState(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveFiredRef = useRef(false);

  // Local "I clicked answer X for round Y" state — separate from the
  // server-confirmed answers list so the UI feels instant.
  const [localPicks, setLocalPicks] = useState<Record<string, number>>({});

  const matchId = rounds[0]?.match_id ?? null;

  // ── Load existing match + subscribe ────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Find the latest champion SD match for this room.
      const { data: latestMatch } = await supabase
        .from('sudden_death_rounds')
        .select('match_id')
        .eq('room_id', roomId)
        .eq('category', 'champion')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const mid = latestMatch?.match_id as string | undefined;
      if (!mid) { if (mounted) setRounds([]); return; }

      const { data } = await supabase
        .from('sudden_death_rounds')
        .select('*')
        .eq('match_id', mid)
        .order('question_index', { ascending: true });
      if (!mounted) return;
      setRounds((data ?? []) as RoundRow[]);
    })();

    const ch = supabase
      .channel(`sd_rounds:${roomId}:champion`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sudden_death_rounds', filter: `room_id=eq.${roomId}` },
        () => {
          // Easiest: just refetch the latest match.
          supabase
            .from('sudden_death_rounds')
            .select('match_id')
            .eq('room_id', roomId)
            .eq('category', 'champion')
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(async ({ data: m }) => {
              const mid2 = m?.match_id as string | undefined;
              if (!mid2) { setRounds([]); return; }
              const { data } = await supabase
                .from('sudden_death_rounds')
                .select('*')
                .eq('match_id', mid2)
                .order('question_index', { ascending: true });
              setRounds((data ?? []) as RoundRow[]);
            });
        }).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [roomId]);

  // ── Subscribe to answers for this match ────────────────────────────────
  useEffect(() => {
    if (!matchId) return;
    let mounted = true;
    const roundIds = rounds.map(r => r.id);
    if (roundIds.length === 0) return;
    supabase
      .from('sudden_death_answers')
      .select('round_id, player_id, answer_index, is_correct, response_ms')
      .in('round_id', roundIds)
      .then(({ data }) => { if (mounted) setAnswers((data ?? []) as AnswerRow[]); });

    const ch = supabase
      .channel(`sd_answers:${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sudden_death_answers' },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as AnswerRow;
          if (!roundIds.includes(row.round_id)) return;
          setAnswers(prev => {
            const next = prev.filter(a => !(a.round_id === row.round_id && a.player_id === row.player_id));
            next.push(row);
            return next;
          });
        }).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [matchId, rounds]);

  // ── Heartbeat for time-based UI (timer + active round) ─────────────────
  useEffect(() => {
    if (rounds.length === 0) return;
    tickRef.current = setInterval(() => setNow(Date.now()), 250);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [rounds.length]);

  // ── Active round = first round whose closes_at + REVEAL is in the future ─
  const activeRound = useMemo(() => {
    for (const r of rounds) {
      if (now < new Date(r.closes_at).getTime() + REVEAL_MS) return r;
    }
    return null;
  }, [rounds, now]);

  const isAfterAllRounds = rounds.length > 0 && !activeRound;

  // ── Auto-fire resolve once all rounds + reveal time have passed ────────
  useEffect(() => {
    if (!isAfterAllRounds || resolveFiredRef.current) return;
    resolveFiredRef.current = true;
    void (async () => {
      try {
        await supabase.rpc('resolve_sudden_death_match', { p_match_id: matchId });
        onResolved();
      } catch (e) { setErr(errMsg(e)); }
    })();
  }, [isAfterAllRounds, matchId, onResolved]);

  // ── Host: open the match ───────────────────────────────────────────────
  // Pick 3 random IDs from the static question bank (no DB table for
  // questions in this project — they live in src/lib/questions.ts).
  const startMatch = async () => {
    setBusy(true); setErr(null);
    try {
      if (QUESTIONS.length < 3) throw new Error('Not enough questions in pool');
      const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
      const ids = shuffled.slice(0, 3).map((q) => q.id);
      const { error: openErr } = await supabase.rpc('open_sudden_death_match', {
        p_room_id: roomId, p_category: 'champion', p_question_ids: ids,
      });
      if (openErr) throw openErr;
      resolveFiredRef.current = false;
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  // ── Player: submit answer ──────────────────────────────────────────────
  const submitAnswer = async (round: RoundRow, idx: number) => {
    if (!myId || !amTied) return;
    if (localPicks[round.id] !== undefined) return; // already picked

    setLocalPicks(prev => ({ ...prev, [round.id]: idx }));
    const q = questions.get(round.question_id);
    if (!q) return;
    try {
      await supabase.rpc('submit_sudden_death_answer', {
        p_round_id: round.id,
        p_answer_index: idx,
        p_is_correct: idx === q.correct_index,
      });
    } catch (e) { setErr(errMsg(e)); }
  };

  // ── No match yet ───────────────────────────────────────────────────────
  if (rounds.length === 0) {
    return (
      <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/8 p-5 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-euro-pink/20 border border-euro-pink/40 px-3 py-1 text-xs font-bold text-euro-pink tracking-widest uppercase mb-3">
          {t('sd.headerLabel', { defaultValue: '⚔ Sudden Death' })}
        </div>
        <p className="text-base font-bold text-white">
          {t('sd.suddenDeathChosen', { defaultValue: 'The room voted to settle it.' })}
        </p>
        <p className="text-sm text-white/55 mt-1 max-w-sm mx-auto">
          {t('sd.intro', {
            defaultValue: '3 quick questions decide the Champion. Only the tied players answer; everyone else watches.',
          })}
        </p>
        {isHost ? (
          <button
            type="button"
            onClick={startMatch}
            disabled={busy}
            className="mt-4 px-5 py-2.5 rounded-full bg-euro-pink text-white font-bold text-sm disabled:opacity-50"
          >
            {busy ? t('sd.starting', { defaultValue: 'Starting…' })
                  : t('sd.startMatch', { defaultValue: '⚔ Start Sudden Death' })}
          </button>
        ) : (
          <p className="mt-3 text-xs text-white/40">
            {t('sd.waitingForHost', { defaultValue: 'Waiting for the host to start…' })}
          </p>
        )}
        {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
      </div>
    );
  }

  // ── Match in progress ──────────────────────────────────────────────────
  if (activeRound) {
    const q = questions.get(activeRound.question_id);
    const closesAt = new Date(activeRound.closes_at).getTime();
    const remainingMs = Math.max(0, closesAt - now);
    const isReveal = remainingMs === 0;
    const remainingSec = Math.ceil(remainingMs / 1000);
    const myPick = localPicks[activeRound.id] ?? null;
    const submittedCount = answers.filter(a => a.round_id === activeRound.id).length;
    const tiedCount = tiedPlayerIds.length || 1;
    const options: string[] = q?.options ?? [];

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeRound.id + (isReveal ? '-reveal' : '-q')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-2xl border border-euro-pink/30 bg-[#1a0a2e]/80 p-4 sm:p-5"
        >
          {/* Header strip */}
          <div className="flex items-center justify-between mb-4 gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-euro-pink/20 border border-euro-pink/40 px-2.5 py-1 text-[11px] font-bold text-euro-pink tracking-widest uppercase">
              ⚔ {t('sd.round', { defaultValue: 'Round' })} {activeRound.question_index + 1}/3
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/45 tabular-nums">
                {submittedCount}/{tiedCount} {t('sd.answered', { defaultValue: 'answered' })}
              </span>
              <div className={clsx(
                'flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center font-extrabold tabular-nums',
                isReveal
                  ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                  : 'bg-[#0d0620] border-white/15 text-white',
              )}>
                {isReveal ? '✓' : remainingSec}
              </div>
            </div>
          </div>

          {/* Question */}
          {q ? (
            <p className="text-base sm:text-lg font-bold text-white mb-4">{q.question}</p>
          ) : (
            <p className="text-sm text-white/40 mb-4">{t('sd.loadingQuestion', { defaultValue: 'Loading question…' })}</p>
          )}

          {/* Answer grid */}
          {q && (
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt, idx) => {
                const isCorrect = idx === q.correct_index;
                const isMine    = myPick === idx;
                const showCorrect = isReveal && isCorrect;
                const showWrong   = isReveal && isMine && !isCorrect;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => submitAnswer(activeRound, idx)}
                    disabled={!amTied || myPick !== null || isReveal}
                    className={clsx(
                      'rounded-xl border px-3 py-3 text-sm font-medium text-left transition-all disabled:cursor-not-allowed',
                      showCorrect
                        ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-100'
                        : showWrong
                          ? 'border-red-500/70 bg-red-500/15 text-red-200'
                          : isMine
                            ? 'border-euro-purple/60 bg-euro-purple/25 text-white'
                            : 'border-white/15 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white',
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {!amTied && (
            <p className="text-[11px] text-white/40 text-center mt-3">
              {t('sd.spectator', { defaultValue: 'You are watching — only the tied players answer.' })}
            </p>
          )}

          {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Match resolved (winner pulled from `winners` by parent refetch) ────
  return (
    <div className="rounded-2xl border border-euro-gold/40 bg-euro-gold/10 p-5 text-center">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-euro-gold/20 border border-euro-gold/50 px-3 py-1 text-xs font-bold text-euro-gold tracking-widest uppercase mb-3">
        ⚔ {t('sd.resolved', { defaultValue: 'Sudden Death Decided' })}
      </div>
      <p className="text-base font-bold text-white">
        {t('sd.resolving', { defaultValue: 'Crowning the Champion…' })}
      </p>
      {tiedPlayerNames && Object.keys(tiedPlayerNames).length > 0 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          {Object.entries(tiedPlayerNames).slice(0, 4).map(([id, name], i) => (
            <div key={id} className="flex items-center gap-2 bg-white/[0.06] rounded-full pl-1 pr-3 py-1">
              <div className={clsx(
                'w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-xs',
                avatarGradient(i),
              )}>
                {avatarInitial(name)}
              </div>
              <span className="text-xs font-semibold text-white">{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

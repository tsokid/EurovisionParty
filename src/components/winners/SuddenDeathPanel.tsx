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
import { onLive, roomTopic } from '../../lib/liveChannel';
import { callWhenDue, resolverDelayMs } from '../../lib/callWhenDue';
import { useGameStore } from '../../stores/gameStore';
import { Avatar } from '../stage';
// Question bank is shipped as static JSON, not a Postgres table — same
// source the regular Quiz tab uses, so SD inherits the same 500-Q pool.
import { suddenDeathQuestion } from '../../lib/servedQuestions';
import { getLocalizedQuestion } from '../../lib/questionLocale';
import type { QuizQuestion } from '../../lib/types';

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
  // Each round's question comes from the server (099): its text while the
  // round is open, and its correct option only once the round has closed.
  const [served, setServed] = useState<Record<string, { question: QuizQuestion; correctIndex: number | null }>>({});
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

    const off = onLive(roomTopic(roomId), 'sudden_death_rounds', () => {
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
        });
    return () => { mounted = false; off(); };
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

    const off = onLive<AnswerRow>(roomTopic(roomId), 'sudden_death_answers', (change) => {
          if (change.eventType === 'DELETE') return;
          const row = change.new;
          if (!roundIds.includes(row.round_id)) return;
          setAnswers(prev => {
            const next = prev.filter(a => !(a.round_id === row.round_id && a.player_id === row.player_id));
            next.push(row);
            return next;
          });
        });
    return () => { mounted = false; off(); };
  }, [matchId, rounds, roomId]);

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
  const activeId = activeRound?.id ?? null;
  const activeClosed = activeRound ? now >= new Date(activeRound.closes_at).getTime() : false;
  const haveActive = activeId ? served[activeId] : undefined;
  const needFetch = !!activeId && (!haveActive || (activeClosed && haveActive.correctIndex == null));
  useEffect(() => {
    if (!activeId || !needFetch) return;
    let live = true;
    suddenDeathQuestion(activeId)
      .then((r) => { if (live) setServed((prev) => ({ ...prev, [activeId]: r })); })
      .catch((e) => { if (live) setErr(errMsg(e)); });
    return () => { live = false; };
  }, [activeId, needFetch]);

  // ── Resolve once all rounds + reveal time have passed ──────────────────
  // The host's phone resolves at once; the others wait for the result to be
  // pushed (the rounds turn 'completed') and resolve themselves only if it
  // has not come by resolverDelayMs (F12).
  useEffect(() => {
    if (!isAfterAllRounds || resolveFiredRef.current) return;
    if (rounds.length > 0 && rounds.every((r) => r.status === 'completed')) {
      resolveFiredRef.current = true;
      onResolved();
      return;
    }
    const timer = setTimeout(() => {
      if (resolveFiredRef.current) return;
      resolveFiredRef.current = true;
      void (async () => {
        try {
          const { error } = await callWhenDue(() => supabase.rpc('resolve_sudden_death_match', { p_match_id: matchId }));
          if (error) throw error;
          onResolved();
        } catch (e) { setErr(errMsg(e)); }
      })();
    }, resolverDelayMs(isHost));
    return () => clearTimeout(timer);
  }, [isAfterAllRounds, matchId, onResolved, isHost, rounds]);

  // ── Host: open the match ───────────────────────────────────────────────
  // The server draws the three questions, unseen by every tied player (099).
  const startMatch = async () => {
    setBusy(true); setErr(null);
    try {
      const { error: openErr } = await supabase.rpc('open_sudden_death_match', {
        p_room_id: roomId, p_category: 'champion', p_question_ids: [],
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
    if (!served[round.id]) return;
    try {
      // The server scores it (097); p_is_correct is ignored.
      await supabase.rpc('submit_sudden_death_answer', {
        p_round_id: round.id,
        p_answer_index: idx,
        p_is_correct: false,
      });
    } catch (e) { setErr(errMsg(e)); }
  };

  // ── No match yet ───────────────────────────────────────────────────────
  if (rounds.length === 0) {
    return (
      <div className="tv-panel c">
        <span className="chip tv-chip pink">{t('sd.headerLabel')}</span>
        <p className="tv-panel-t">{t('sd.suddenDeathChosen')}</p>
        <p className="t-small">{t('sd.intro')}</p>
        {isHost ? (
          <button type="button" onClick={startMatch} disabled={busy} className="btn btn-primary btn-block">
            {busy ? t('sd.starting') : t('sd.startMatch')}
          </button>
        ) : (
          <p className="t-meta">{t('sd.waitingForHost')}</p>
        )}
        {err && <p className="pk-error" role="alert">{err}</p>}
      </div>
    );
  }

  // ── Match in progress ──────────────────────────────────────────────────
  if (activeRound) {
    const sq = served[activeRound.id];
    const q = sq ? getLocalizedQuestion(sq.question) : null;
    const correctIdx = sq?.correctIndex ?? null;
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
          className="tv-panel"
        >
          <div className="tv-head">
            <span className="chip tv-chip pink">{t('sd.round')} {activeRound.question_index + 1}/3</span>
            <span className="t-meta num">{submittedCount}/{tiedCount} {t('sd.answered')}</span>
            <span className={clsx('num tv-count', isReveal && 'ok')}>{isReveal ? '✓' : remainingSec}</span>
          </div>
          {q ? <p className="tv-panel-t">{q.question}</p> : <p className="t-meta">{t('sd.loadingQuestion')}</p>}
          {q && (
            <div className="tv-ans">
              {options.map((opt, idx) => {
                const isCorrect = correctIdx != null && idx === correctIdx;
                const isMine    = myPick === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => submitAnswer(activeRound, idx)}
                    disabled={!amTied || myPick !== null || isReveal}
                    className={clsx('tv-a', isReveal && isCorrect && 'ok', isReveal && isMine && !isCorrect && 'bad', isMine && 'mine')}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
          {!amTied && <p className="t-meta tv-foot">{t('sd.spectator')}</p>}
          {err && <p className="pk-error" role="alert">{err}</p>}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Match resolved (winner pulled from `winners` by parent refetch) ────
  return (
    <div className="tv-panel c">
      <span className="chip chip-gold tv-chip">{t('sd.resolved')}</span>
      <p className="tv-panel-t">{t('sd.resolving')}</p>
      {tiedPlayerNames && Object.keys(tiedPlayerNames).length > 0 && (
        <div className="tv-names">
          {Object.entries(tiedPlayerNames).slice(0, 4).map(([id, name]) => (
            <span key={id} className="tv-name"><Avatar name={name} size="sm" />{name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

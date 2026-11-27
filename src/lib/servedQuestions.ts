// The server serves every question (migration 099): the browser never holds
// the answer key. A served question comes without its correct option; the
// verdict (right or wrong, the correct option, the points) comes back only
// with the answer. The countdown follows the server's deadline, corrected
// for the gap between the server clock and this device's clock.
import { supabase } from './supabase';
import type { QuizQuestion } from './types';

export interface PublicQuestion {
  id: number;
  question: string;
  question_el: string;
  options: string[];
  options_el: string[];
  difficulty: string;
}

export interface Serve {
  serveId: string;
  position: number;
  round?: number;
  question: QuizQuestion;
  /** Deadline on this device's clock (ms since epoch). */
  deadlineMs: number;
  timerMs: number;
}

export interface Verdict {
  isCorrect: boolean;
  timedOut: boolean;
  /** The correct option, as an index into the server's (unshuffled) options. */
  correctIndex: number;
  points: number;
  responseSeconds: number | null;
  answerId?: string;
}

export interface QuizState {
  round: number;
  /** Next question of the round, 1..10. */
  position: number;
  answered: number;
  done: boolean;
  open: { serveId: string; round: number; position: number; remainingMs: number } | null;
}

/** A served question in the shape the question card renders. It has no answer: correct_index is -1. */
export function toQuizQuestion(q: PublicQuestion): QuizQuestion {
  return {
    id: q.id,
    question: q.question,
    question_el: q.question_el,
    options: q.options,
    options_el: q.options_el,
    correct_index: -1,
    category: '',
    difficulty: (q.difficulty as QuizQuestion['difficulty']) ?? 'medium',
  };
}

/** Seconds left until a device-clock deadline (never below 0). */
export function secondsLeft(deadlineMs: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadlineMs - now) / 1000));
}

interface RawServe {
  serve_id: string;
  position: number;
  round?: number;
  question: PublicQuestion;
  remaining_ms: number;
  timer_ms: number;
}

/** The deadline on this device's clock, from the time the server says is left. */
function toServe(raw: RawServe, receivedAt: number): Serve {
  return {
    serveId: raw.serve_id,
    position: raw.position,
    round: raw.round,
    question: toQuizQuestion(raw.question),
    deadlineMs: receivedAt + Math.max(0, raw.remaining_ms),
    timerMs: raw.timer_ms,
  };
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ── Quiz ────────────────────────────────────────────────────────────────
export async function quizState(roomId: string): Promise<QuizState> {
  const s = await call<{
    round: number; position: number; answered: number; done: boolean;
    open: { serve_id: string; round: number; position: number; remaining_ms: number } | null;
  }>('quiz_state', { p_room_id: roomId });
  return {
    round: s.round,
    position: s.position,
    answered: s.answered,
    done: s.done,
    open: s.open ? { serveId: s.open.serve_id, round: s.open.round, position: s.open.position, remainingMs: s.open.remaining_ms } : null,
  };
}

export async function quizNext(roomId: string, round: number): Promise<Serve> {
  const raw = await call<RawServe>('quiz_next', { p_room_id: roomId, p_round: round });
  return toServe(raw, Date.now());
}

/** answerIndex: the server's (unshuffled) option index, or null when the time ran out. */
export async function quizAnswer(serveId: string, answerIndex: number | null): Promise<Verdict> {
  const v = await call<{
    id?: string; is_correct: boolean; timed_out: boolean; correct_index: number;
    points_awarded: number; response_seconds: number | null;
  }>('quiz_answer', { p_serve_id: serveId, p_answer_index: answerIndex });
  return {
    isCorrect: v.is_correct, timedOut: v.timed_out, correctIndex: v.correct_index,
    points: v.points_awarded, responseSeconds: v.response_seconds, answerId: v.id,
  };
}

// ── Duels ───────────────────────────────────────────────────────────────
export type DuelStep = { finished: true } | ({ finished: false } & Serve);

export async function duelNext(duelId: string): Promise<DuelStep> {
  const raw = await call<{ finished: boolean } & Partial<RawServe>>('duel_next', { p_duel_id: duelId });
  if (raw.finished) return { finished: true };
  return { finished: false, ...toServe(raw as RawServe, Date.now()) };
}

export async function duelAnswer(serveId: string, answerIndex: number | null): Promise<Verdict & { responseMs: number }> {
  const v = await call<{ is_correct: boolean; timed_out: boolean; correct_index: number; points: number; response_ms: number }>(
    'duel_answer', { p_serve_id: serveId, p_answer_index: answerIndex });
  return {
    isCorrect: v.is_correct, timedOut: v.timed_out, correctIndex: v.correct_index,
    points: v.points, responseSeconds: v.response_ms / 1000, responseMs: v.response_ms,
  };
}

// ── Sudden death ────────────────────────────────────────────────────────
/** The round's question; correctIndex is known only once the round has closed. */
export async function suddenDeathQuestion(roundId: string): Promise<{ question: QuizQuestion; correctIndex: number | null }> {
  const q = await call<PublicQuestion & { correct_index: number | null }>('sudden_death_question', { p_round_id: roundId });
  return { question: toQuizQuestion(q), correctIndex: q.correct_index ?? null };
}

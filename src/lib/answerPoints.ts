// Presentation helpers for the "+N · reason" chips on quiz and duel answers.
// Nothing here decides points: quiz points come from the server row that
// submit_quiz_answer returns, duel points from DuelAnswer.points that
// calcDuelPoints wrote. These helpers only describe and format them.
import type { Duel, DuelAnswer, QuizAnswer } from './types';

export type AnswerKind = 'correct' | 'wrong' | 'timeout';

export interface QuizChip {
  /** points_awarded from the server, unchanged. */
  points: number;
  kind: AnswerKind;
  /** response_seconds from the server (NUMERIC(5,2)), or null if unknown. */
  seconds: number | null;
}

/** Describe a quiz answer row for its chip. Points are the server's. */
export function quizAnswerChip(
  a: Pick<QuizAnswer, 'points_awarded' | 'is_correct' | 'response_seconds' | 'answer_index'>,
): QuizChip {
  const timeout = a.answer_index == null || a.answer_index < 0;
  return {
    points: a.points_awarded ?? 0,
    kind: a.is_correct ? 'correct' : timeout ? 'timeout' : 'wrong',
    seconds: a.response_seconds ?? null,
  };
}

/**
 * Seconds with one decimal and the locale's separator ("2,1″" in Greek).
 *
 * - 'ceil' for the quiz: the tiers are "≤ 3″" and "≤ 7″", and rounding up to
 *   the tenth keeps the shown value on the same side of the threshold as the
 *   real one (3.04 → "3,1″" earns 8, never a confusing "3,0″").
 * - 'floor' for duels: points use floor(seconds), so 2.96 shows "2,9″" next
 *   to "12−2".
 */
export function formatSeconds(seconds: number, lang: string, mode: 'ceil' | 'floor' = 'ceil'): string {
  const tenths = mode === 'ceil' ? Math.ceil(seconds * 10 - 1e-9) : Math.floor(seconds * 10 + 1e-9);
  const v = (Math.max(0, tenths) / 10).toFixed(1);
  return `${lang.startsWith('el') ? v.replace('.', ',') : v}″`;
}

export interface DuelChip {
  /** DuelAnswer.points (calcDuelPoints), unchanged. */
  points: number;
  kind: AnswerKind;
  /** floor(responseMs / 1000): the "s" in "12 − s", as calcDuelPoints uses it. */
  secondsTaken: number;
  /** responseMs / 1000, for the time label. */
  seconds: number;
}

/**
 * Describe one duel answer. `isCorrect` comes from comparing the stored
 * answerIndex with the question (the play screen knows it at answer time;
 * history uses the question bank, see duelAnswerCorrect).
 */
export function duelAnswerChip(a: Pick<DuelAnswer, 'points' | 'responseMs' | 'answerIndex'>, isCorrect: boolean): DuelChip {
  return {
    points: a.points,
    kind: a.answerIndex < 0 ? 'timeout' : isCorrect ? 'correct' : 'wrong',
    secondsTaken: Math.floor(a.responseMs / 1000),
    seconds: a.responseMs / 1000,
  };
}

/** The base of the duel rule "12 − seconds" (calcDuelPoints). */
export const DUEL_MAX_POINTS = 12;

export interface DuelRewardPreview {
  /** apply_duel_decision refuses a steal of 0 ("Opponent has no points to steal"). */
  canSteal: boolean;
  /** LEAST(winner_score, GREATEST(0, loser.total_points)). */
  steal: number;
  /** winner_score * 2. */
  double: number;
}

/**
 * What the two reward cards offer, mirroring apply_duel_decision (migration
 * 008) exactly as the previous DuelResultCard did. After the choice the
 * screens show duels.points_transferred, the server's own number.
 */
export function duelRewardPreview(winnerScore: number, loserTotalPoints: number): DuelRewardPreview {
  const steal = Math.min(winnerScore, Math.max(0, loserTotalPoints));
  return { canSteal: steal > 0, steal, double: winnerScore * 2 };
}

export type DuelOutcome = 'win' | 'lose' | 'tie' | 'open';

/**
 * Outcome from one side. A tie (status 'tie', migration 028) has no winner,
 * no loser and no reward chooser.
 */
export function duelOutcome(duel: Pick<Duel, 'status' | 'winner_id' | 'loser_id'>, playerId: string | null | undefined): DuelOutcome {
  if (duel.status === 'tie') return 'tie';
  if (duel.status !== 'completed' || !duel.winner_id) return 'open';
  if (duel.winner_id === playerId) return 'win';
  if (duel.loser_id === playerId) return 'lose';
  return 'open';
}

/** The winner still has to choose «Κλέψε» or «Διπλασίασε». */
export function needsRewardChoice(
  duel: Pick<Duel, 'status' | 'winner_id' | 'loser_id' | 'winner_decision'>,
  playerId: string | null | undefined,
): boolean {
  return duelOutcome(duel, playerId) === 'win' && !duel.winner_decision;
}

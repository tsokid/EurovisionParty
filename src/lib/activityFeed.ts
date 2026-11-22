// Activity feed (motion map #10, approved as «Νέο»): built ONLY from point
// events the database already stores. Nothing here is inferred or invented.
//
//   trivia      quiz_answers rows with points_awarded > 0 (answered_at).
//               RLS (051) lets a player read only their own answers (the
//               host reads all), so the hook asks for the viewer's own rows.
//   duel        duels rows with a winner_decision (decision_made_at):
//               steal  → winner +points_transferred, loser −points_transferred
//               double → winner +points_transferred (= 2 × duel score)
//               This is exactly what apply_duel_decision (008) writes to
//               duel_points. Every room member can read every duel.
//   prediction  predictions rows with scored_at and total_points > 0.
//               Own row only (RLS), like trivia.
//
// Not included, because no stored per-event source exists: other players'
// individual trivia answers (RLS), and Intel spending (intel_reveals is a
// purchase log, not a point event the owner listed).

export type FeedKind = 'trivia' | 'duel' | 'prediction';

export interface FeedEvent {
  id: string;
  kind: FeedKind;
  /** Who gained the points. */
  playerId: string;
  points: number;
  /** ISO timestamp of the stored event. */
  at: string;
  /** Duels: how the winner used the win. */
  decision?: 'steal' | 'double';
  /** Duels (steal): who lost `points`. */
  otherId?: string | null;
}

export interface FeedDuelRow {
  id: string;
  winner_id: string | null;
  loser_id: string | null;
  winner_decision: string | null;
  points_transferred: number | null;
  decision_made_at: string | null;
  completed_at?: string | null;
}
export interface FeedAnswerRow { id: string; player_id: string; points_awarded: number | null; answered_at: string | null }
export interface FeedPredictionRow { id: string; player_id: string; total_points: number | null; scored_at: string | null }

export interface FeedSources {
  duels?: readonly FeedDuelRow[];
  quizAnswers?: readonly FeedAnswerRow[];
  predictions?: readonly FeedPredictionRow[];
}

export const FEED_LIMIT = 30;

export function buildActivityFeed(src: FeedSources, limit = FEED_LIMIT): FeedEvent[] {
  const out: FeedEvent[] = [];
  for (const d of src.duels ?? []) {
    const dec = d.winner_decision;
    const at = d.decision_made_at ?? d.completed_at ?? null;
    const pts = d.points_transferred ?? 0;
    if ((dec !== 'steal' && dec !== 'double') || !d.winner_id || pts <= 0 || !at) continue;
    out.push({ id: `duel:${d.id}`, kind: 'duel', playerId: d.winner_id, points: pts, at, decision: dec, otherId: dec === 'steal' ? d.loser_id : null });
  }
  for (const a of src.quizAnswers ?? []) {
    const pts = a.points_awarded ?? 0;
    if (pts <= 0 || !a.answered_at) continue;
    out.push({ id: `quiz:${a.id}`, kind: 'trivia', playerId: a.player_id, points: pts, at: a.answered_at });
  }
  for (const p of src.predictions ?? []) {
    const pts = p.total_points ?? 0;
    if (pts <= 0 || !p.scored_at) continue;
    out.push({ id: `pred:${p.id}`, kind: 'prediction', playerId: p.player_id, points: pts, at: p.scored_at });
  }
  out.sort((x, y) => Date.parse(y.at) - Date.parse(x.at) || (x.id < y.id ? -1 : 1));
  return out.slice(0, limit);
}

/** «τώρα», «4΄», «2ω» — relative to `now` (ms). */
export function feedAge(at: string, now: number): { unit: 'now' | 'min' | 'hour'; n: number } {
  const s = Math.max(0, (now - Date.parse(at)) / 1000);
  if (s < 60) return { unit: 'now', n: 0 };
  if (s < 3600) return { unit: 'min', n: Math.floor(s / 60) };
  return { unit: 'hour', n: Math.floor(s / 3600) };
}

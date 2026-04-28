/**
 * Fetch all question IDs a player has already seen in this room
 * (quiz answers + duels they participated in).
 *
 * Used to enforce the rule: a player is never asked the same question twice.
 */
import { supabase } from './supabase';

export async function fetchSeenQuestionIds(
  playerId: string,
  roomId: string,
): Promise<number[]> {
  const seen = new Set<number>();

  // 1. Quiz answers
  const { data: quizAnswers } = await supabase
    .from('quiz_answers')
    .select('question_id')
    .eq('player_id', playerId)
    .eq('room_id', roomId);

  for (const a of quizAnswers ?? []) seen.add(a.question_id);

  // 2. Duels the player was involved in (question_ids is an array column)
  const { data: duels } = await supabase
    .from('duels')
    .select('question_ids, question_id')
    .eq('room_id', roomId)
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`)
    .not('status', 'eq', 'pending')   // only count duels that actually ran
    .not('status', 'eq', 'declined');

  for (const d of duels ?? []) {
    if (Array.isArray(d.question_ids)) {
      for (const id of d.question_ids) seen.add(id);
    } else if (d.question_id) {
      seen.add(d.question_id);
    }
  }

  return Array.from(seen);
}

/**
 * Fetch seen question IDs for TWO players and return the union.
 * Used when creating a duel — exclude questions either player has seen.
 */
export async function fetchSeenQuestionIdsForDuel(
  challengerId: string,
  challengedId: string,
  roomId: string,
): Promise<number[]> {
  const [a, b] = await Promise.all([
    fetchSeenQuestionIds(challengerId, roomId),
    fetchSeenQuestionIds(challengedId, roomId),
  ]);
  return Array.from(new Set([...a, ...b]));
}

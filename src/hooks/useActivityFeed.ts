import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { buildActivityFeed, type FeedAnswerRow, type FeedDuelRow, type FeedEvent, type FeedPredictionRow } from '../lib/activityFeed';

/**
 * The room's point events (src/lib/activityFeed.ts). Re-reads when
 * `refreshKey` changes — the leaderboard passes a signature of every
 * player's total, so a new point event (which always moves a total) brings
 * its row in without another realtime channel.
 */
export function useActivityFeed(roomId: string | null | undefined, myPlayerId: string | null | undefined, refreshKey: string): FeedEvent[] {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const load = async () => {
      const [duelsR, answersR, predR] = await Promise.all([
        supabase
          .from('duels')
          .select('id, winner_id, loser_id, winner_decision, points_transferred, decision_made_at, completed_at')
          .eq('room_id', roomId)
          .not('winner_decision', 'is', null),
        myPlayerId
          ? supabase.from('quiz_answers').select('id, player_id, points_awarded, answered_at').eq('room_id', roomId).eq('player_id', myPlayerId)
          : Promise.resolve({ data: [] as FeedAnswerRow[], error: null }),
        myPlayerId
          ? supabase.from('predictions').select('id, player_id, total_points, scored_at').eq('room_id', roomId).eq('player_id', myPlayerId)
          : Promise.resolve({ data: [] as FeedPredictionRow[], error: null }),
      ]);
      if (cancelled) return;
      setEvents(buildActivityFeed({
        duels: (duelsR.error ? [] : duelsR.data ?? []) as FeedDuelRow[],
        quizAnswers: (answersR.error ? [] : answersR.data ?? []) as FeedAnswerRow[],
        predictions: (predR.error ? [] : predR.data ?? []) as FeedPredictionRow[],
      }));
    };
    if (timer.current) clearTimeout(timer.current);
    // Debounced: a duel decision moves two totals in two realtime updates.
    timer.current = setTimeout(() => { void load().catch(() => { /* keep the last list */ }); }, 300);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [roomId, myPlayerId, refreshKey]);

  return events;
}

import { useEffect, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import type { Player } from '../lib/types';
import { onLive, roomTopic } from '../lib/liveChannel';
import { onResync } from '../lib/resync';

/**
 * Several screens use this hook at once (room page, board, winners). They
 * share one refetch per room per burst, so a join refetches once, not once
 * per screen.
 */
const pendingFetch = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleFetch(roomId: string, fetch: () => void, ms: number) {
  if (pendingFetch.has(roomId)) return;
  pendingFetch.set(roomId, setTimeout(() => { pendingFetch.delete(roomId); fetch(); }, ms));
}

interface UseLeaderboardReturn {
  players: Player[];
  isLoading: boolean;
  refetchPlayers: () => Promise<void>;
}

export function useLeaderboard(roomId: string | null | undefined): UseLeaderboardReturn {
  const { players, setPlayers } = useGameStore();
  const [isLoading, setIsLoading] = useState(false);

  const fetchPlayers = useCallback(async () => {
    if (!roomId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .order('total_points', { ascending: false });

      if (error) throw error;
      setPlayers((data ?? []) as Player[]);
    } catch (err) {
      console.error('[useLeaderboard] fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, setPlayers]);

  useEffect(() => {
    if (!roomId) return;

    // Screens that mount together (room page, board) share one first read.
    scheduleFetch(roomId, () => { void fetchPlayers(); }, 0);

    // Scores, joins and leaves arrive as a server push on the room's private
    // channel (105). A catch-up refetch runs after the phone was away.
    const offLive = onLive<Player>(roomTopic(roomId), 'players', (change) => {
      const current = useGameStore.getState().players;
      if (change.eventType === 'REFRESH') {
        // Finalize scored the whole room at once (108). Every phone of every
        // room gets this together, so spread the rereads over 3 s.
        scheduleFetch(roomId, () => { void fetchPlayers(); }, Math.floor(Math.random() * 3_000));
      } else if (change.eventType === 'UPDATE' && change.new.is_active && current.some((p) => p.id === change.new.id)) {
        // Incremental update: replace the changed player in-place
        setPlayers(current.map((p) => (p.id === change.new.id ? change.new : p)));
      } else {
        // A join, a leave or a return: refetch (debounced)
        scheduleFetch(roomId, () => { void fetchPlayers(); }, 500);
      }
    });
    const offResync = onResync(() => scheduleFetch(roomId, () => { void fetchPlayers(); }, 0));

    return () => {
      offLive();
      offResync();
    };
  }, [roomId, fetchPlayers, setPlayers]);

  return { players, isLoading, refetchPlayers: fetchPlayers };
}

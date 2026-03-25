import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import type { Player } from '../lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseLeaderboardReturn {
  players: Player[];
  isLoading: boolean;
}

export function useLeaderboard(roomId: string | null | undefined): UseLeaderboardReturn {
  const { players, setPlayers } = useGameStore();
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced fetch — prevents hammering when multiple rapid updates arrive
  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPlayers();
    }, 500);
  }, [fetchPlayers]);

  useEffect(() => {
    if (!roomId) return;

    fetchPlayers();

    const channel = supabase
      .channel(`leaderboard:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            // Incremental update: replace the changed player in-place
            const updated = payload.new as Player;
            setPlayers(
              useGameStore.getState().players.map((p) =>
                p.id === updated.id ? updated : p
              )
            );
          } else {
            // INSERT or DELETE: refetch (debounced)
            debouncedFetch();
          }
        }
      )
      .subscribe((status, err) => {
        if (err) console.error('[useLeaderboard] Realtime error:', status, err);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [roomId, fetchPlayers, debouncedFetch, setPlayers]);

  return { players, isLoading };
}

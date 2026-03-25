import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { getRoomSession } from './useRoom';
import type { Room, Player } from '../lib/types';

export type RejoinStatus =
  | 'loading'
  | 'ready'       // store already had room+player
  | 'rejoined'    // successfully restored from DB
  | 'no-auth'     // no anonymous session
  | 'no-room'     // room code doesn't exist
  | 'not-member'; // user has no player record in this room

export function useRejoin(roomCode: string | undefined) {
  const [status, setStatus] = useState<RejoinStatus>('loading');
  const attempted = useRef(false);
  const { room, player, setRoom, setPlayer } = useGameStore();

  useEffect(() => {
    // Already have state — nothing to do
    if (room && player) {
      setStatus('ready');
      return;
    }

    // Don't attempt twice
    if (attempted.current) return;
    if (!roomCode) {
      setStatus('no-room');
      return;
    }

    attempted.current = true;

    async function tryRejoin() {
      try {
        // 1. Look up room by code
        const { data: roomData, error: roomErr } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', roomCode!.toUpperCase())
          .single();

        if (roomErr || !roomData) {
          setStatus('no-room');
          return;
        }

        // 2. Try auth-based lookup first
        const { data: { user } } = await supabase.auth.getUser();
        let playerData: Player | null = null;

        if (user) {
          const { data } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomData.id)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

          playerData = data as Player | null;
        }

        // 3. Fallback: localStorage session (supports multi-room + lost auth)
        if (!playerData) {
          const saved = getRoomSession(roomCode!);
          if (saved?.playerId) {
            const { data } = await supabase
              .from('players')
              .select('*')
              .eq('id', saved.playerId)
              .eq('room_id', roomData.id)
              .eq('is_active', true)
              .maybeSingle();

            playerData = data as Player | null;

            // Link current auth user to this player if auth changed
            if (playerData && user && playerData.user_id !== user.id) {
              await supabase
                .from('players')
                .update({ user_id: user.id })
                .eq('id', playerData.id);
              playerData.user_id = user.id;
            }
          }
        }

        if (!playerData) {
          setStatus('not-member');
          return;
        }

        // 4. Hydrate store
        setRoom(roomData as Room);
        setPlayer(playerData);

        // 5. Update last_seen_at
        await supabase
          .from('players')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', playerData.id);

        setStatus('rejoined');
      } catch (err) {
        console.error('Rejoin failed:', err);
        setStatus('not-member');
      }
    }

    tryRejoin();
  }, [roomCode, room, player, setRoom, setPlayer]);

  return { status };
}

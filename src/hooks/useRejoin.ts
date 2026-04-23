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
  | 'not-member'  // user has no player record in this room
  | 'expired';    // player exited and 2h grace period has passed

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function twoHoursAgoISO(): string {
  return new Date(Date.now() - TWO_HOURS_MS).toISOString();
}

export function useRejoin(roomCode: string | undefined) {
  const [status, setStatus] = useState<RejoinStatus>('loading');
  const attempted = useRef(false);
  const { room, player, setRoom, setPlayer } = useGameStore();

  useEffect(() => {
    if (room && player) {
      setStatus('ready');
      return;
    }

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

        const cutoff = twoHoursAgoISO();

        // 2. Try auth-based lookup first
        const { data: { user } } = await supabase.auth.getUser();
        let playerData: Player | null = null;
        let statusColumnExists = true;

        if (user) {
          const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomData.id)
            .eq('user_id', user.id)
            .or(`status.in.(active,away),and(status.eq.exited,left_at.gt.${cutoff})`)
            .maybeSingle();

          if (error?.message?.includes('status')) {
            // Migration not yet applied — fall back to is_active
            statusColumnExists = false;
            const { data: fb } = await supabase
              .from('players')
              .select('*')
              .eq('room_id', roomData.id)
              .eq('user_id', user.id)
              .eq('is_active', true)
              .maybeSingle();
            playerData = fb as Player | null;
          } else {
            playerData = data as Player | null;
          }
        }

        // 3. Fallback: localStorage session
        if (!playerData) {
          const saved = getRoomSession(roomCode!);
          if (saved?.playerId) {
            let fbData: Player | null = null;

            if (statusColumnExists) {
              const { data, error } = await supabase
                .from('players')
                .select('*')
                .eq('id', saved.playerId)
                .eq('room_id', roomData.id)
                .or(`status.in.(active,away),and(status.eq.exited,left_at.gt.${cutoff})`)
                .maybeSingle();

              if (error?.message?.includes('status')) {
                statusColumnExists = false;
              } else {
                fbData = data as Player | null;
              }
            }

            if (!fbData) {
              // status column missing — use is_active
              const { data } = await supabase
                .from('players')
                .select('*')
                .eq('id', saved.playerId)
                .eq('room_id', roomData.id)
                .eq('is_active', true)
                .maybeSingle();
              fbData = data as Player | null;
            }

            playerData = fbData;

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
          // Check if they existed but grace period expired
          if (user) {
            const { data: expired } = await supabase
              .from('players')
              .select('id, status, left_at')
              .eq('room_id', roomData.id)
              .eq('user_id', user.id)
              .eq('status', 'exited')
              .maybeSingle();

            if (expired) {
              setStatus('expired');
              return;
            }
          }

          setStatus('not-member');
          return;
        }

        // 4. Restore player to active
        const restorePayload: Record<string, unknown> = {
          is_active: true,
          last_seen_at: new Date().toISOString(),
        };
        if (statusColumnExists) {
          restorePayload.status = 'active';
          restorePayload.left_at = null;
        }
        await supabase
          .from('players')
          .update(restorePayload)
          .eq('id', playerData.id);

        if (statusColumnExists) {
          playerData.status = 'active';
          playerData.left_at = null;
        }

        // 5. Hydrate store
        setRoom(roomData as Room);
        setPlayer(playerData);

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

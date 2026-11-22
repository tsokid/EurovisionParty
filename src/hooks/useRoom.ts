import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { generateRoomCode } from '../lib/roomCode';
import type { Room } from '../lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** joinRoom's error for a wrong room password (the join form keys off it). */
export const WRONG_PASSWORD_ERROR = 'Wrong password. Try again.';

// --- localStorage helpers for multi-room rejoin ---
const STORAGE_KEY = 'europarty_rooms';

interface RoomSession {
  playerId: string;
  roomId: string;
  password?: string;
}

export function saveRoomSession(roomCode: string, playerId: string, roomId: string, password?: string) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const session: RoomSession = { playerId, roomId };
    if (password) session.password = password;
    existing[roomCode.toUpperCase()] = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

export function getRoomSession(roomCode: string): RoomSession | null {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return existing[roomCode.toUpperCase()] || null;
  } catch {
    return null;
  }
}

/** Clean up stale localStorage entries (keep only last 10) */
export function cleanupStaleSessions() {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const keys = Object.keys(existing);
    if (keys.length > 10) {
      // Keep only last 10 entries
      const toKeep = keys.slice(-10);
      const cleaned: Record<string, RoomSession> = {};
      for (const k of toKeep) cleaned[k] = existing[k];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
  } catch { /* ignore */ }
}

/** Stage identity given at create/join (Task 4). */
export interface PlayerIdentity {
  /** Secret real name, stored in player_secrets (never in players). */
  realName: string;
  /** players.avatar_id */
  avatarId: string;
}

/**
 * The player row exists but its real name could not be stored. The caller
 * shows an error and calls retryRealName(); the room code is where to go
 * once that succeeds.
 */
export class SecretSaveError extends Error {
  readonly roomCode: string;
  constructor(roomCode: string, cause?: unknown) {
    super('Could not save the real name', { cause });
    this.name = 'SecretSaveError';
    this.roomCode = roomCode;
  }
}

const SECRET_ATTEMPTS = 3;

/**
 * Stores the player's real name in player_secrets, retrying transient
 * failures. Idempotent: an existing secret is kept (ON CONFLICT DO NOTHING),
 * so a retry after a lost response, or a rejoin through the form, never
 * fails or overwrites. Writes only; it never reads the table back.
 */
export async function saveRealName(playerId: string, realName: string, attempts = SECRET_ATTEMPTS, delayMs = 400): Promise<void> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    const { error } = await supabase
      .from('player_secrets')
      .upsert({ player_id: playerId, real_name: realName }, { onConflict: 'player_id', ignoreDuplicates: true });
    if (!error) return;
    lastErr = error;
    if (i < attempts - 1 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
  }
  throw lastErr ?? new Error('player_secrets insert failed');
}

interface UseRoomReturn {
  room: Room | null;
  createRoom: (hostName: string, emoji: string, password: string, identity?: PlayerIdentity) => Promise<string>;
  joinRoom: (code: string, name: string, emoji: string, password: string, identity?: PlayerIdentity) => Promise<Room>;
  /** Retries the real-name save after a SecretSaveError; resolves with the room code. */
  retryRealName: () => Promise<string>;
  advancePhase: (roomId: string) => Promise<void>;
  leaveRoom: (mode?: 'away' | 'exit') => Promise<void>;
  refetchRoom: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useRoom(): UseRoomReturn {
  const { room, setRoom, setPlayer, setRoomPassword, setLoading, setError, isLoading, error } =
    useGameStore();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRoomIdRef = useRef<string | null>(null);
  // Real name still to be stored after a SecretSaveError.
  const pendingSecretRef = useRef<{ playerId: string; realName: string; roomCode: string } | null>(null);

  /** Saves the real name; on failure keeps it pending and throws SecretSaveError. */
  const storeSecret = useCallback(async (playerId: string, realName: string, roomCode: string) => {
    pendingSecretRef.current = { playerId, realName, roomCode };
    try {
      await saveRealName(playerId, realName);
      pendingSecretRef.current = null;
    } catch (err) {
      throw new SecretSaveError(roomCode, err);
    }
  }, []);

  // --- Realtime subscription to room row for phase changes ---
  const subscribeToRoom = useCallback(
    (roomId: string) => {
      // Avoid duplicate subscriptions (use ref, not state, to avoid stale closures)
      if (subscribedRoomIdRef.current === roomId) return;

      // Tear down previous channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel(`room:${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`,
          },
          (payload) => {
            const updated = payload.new as Room;
            setRoom(updated);
          }
        )
        .subscribe((status, err) => {
          if (err) console.error('[useRoom] Realtime error:', status, err);

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Debounce: only show the banner if the error persists for 3s.
            // This prevents flashing on transient blips or slow initial connect.
            const debounceTimer = setTimeout(() => {
              // Only raise the flag if still in an error state (not yet SUBSCRIBED)
              if (!useGameStore.getState().isReconnecting) {
                useGameStore.getState().setIsReconnecting(true);
              }
              // Safety valve: auto-clear after 10s in case SUBSCRIBED never fires
              setTimeout(() => {
                if (useGameStore.getState().isReconnecting) {
                  useGameStore.getState().setIsReconnecting(false);
                }
              }, 10_000);
            }, 3_000);
            // Store timer id on the channel so SUBSCRIBED can cancel it
            (channel as any)._reconnectDebounce = debounceTimer;
          }

          if (status === 'SUBSCRIBED') {
            // Cancel pending debounce — connection recovered before banner showed
            if ((channel as any)._reconnectDebounce) {
              clearTimeout((channel as any)._reconnectDebounce);
              (channel as any)._reconnectDebounce = null;
            }
            useGameStore.getState().setIsReconnecting(false);
          }
        });

      channelRef.current = channel;
      subscribedRoomIdRef.current = roomId;
    },
    [setRoom]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Auto-subscribe when room is in store but no subscription exists (supports rejoin)
  useEffect(() => {
    if (room && !subscribedRoomIdRef.current) {
      subscribeToRoom(room.id);
    }
  }, [room, subscribeToRoom]);

  // --- Create room ---
  const createRoom = useCallback(
    async (hostName: string, emoji: string, password: string, identity?: PlayerIdentity): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Retry up to 3 times if room code collides
        let code = '';
        let roomData: unknown = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          code = generateRoomCode();
          const { data, error: roomErr } = await supabase
            .rpc('create_room_with_password', {
              p_code: code,
              p_host_name: hostName,
              p_password: password,
            })
            .single();

          if (!roomErr) {
            roomData = data;
            break;
          }
          // If it's a unique constraint violation, retry with new code
          if (roomErr.message?.includes('duplicate') || roomErr.message?.includes('unique')) {
            continue;
          }
          throw roomErr;
        }
        if (!roomData) throw new Error('Failed to generate unique room code');
        const typedRoom = roomData as unknown as Room;

        // Insert player (creator) — mark as host
        const { data: playerData, error: playerErr } = await supabase
          .from('players')
          .insert({
            room_id: typedRoom.id,
            user_id: user.id,
            name: hostName,
            avatar_emoji: emoji,
            ...(identity ? { avatar_id: identity.avatarId } : {}),
            is_host: true,
          })
          .select()
          .single();

        if (playerErr) throw playerErr;

        setRoom(typedRoom);
        setPlayer(playerData);
        setRoomPassword(password);
        subscribeToRoom(typedRoom.id as string);

        // Save session to localStorage for rejoin support
        saveRoomSession(code, playerData.id, typedRoom.id, password || undefined);

        // Real name right after the player row; the room is already usable,
        // so a failure here is retried on its own (retryRealName).
        if (identity) await storeSecret(playerData.id, identity.realName, code);

        return code;
      } catch (err: unknown) {
        if (err instanceof SecretSaveError) {
          setError(null); // the caller shows the localized retry message
          throw err;
        }
        let message = err instanceof Error ? err.message : ((err as any)?.message ?? 'Failed to create room');
        // Map server errors to friendly messages
        if (message.includes('Rate limit')) message = 'Too many rooms created. Please wait an hour.';
        if (message.includes('already taken')) message = 'That name is taken in this room. Choose another.';
        if (message.includes('Room is full')) message = 'Room is full. No more players can join.';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setRoom, setPlayer, setRoomPassword, setLoading, setError, subscribeToRoom, storeSecret]
  );

  // --- Join room ---
  const joinRoom = useCallback(
    async (code: string, name: string, emoji: string, password: string, identity?: PlayerIdentity): Promise<Room> => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Verify room code + password via RPC
        const { data: roomData, error: roomErr } = await supabase
          .rpc('verify_room_password', {
            p_code: code.toUpperCase(),
            p_password: password,
          })
          .single();

        if (roomErr) {
          // Map Postgres exceptions to user-friendly messages
          const msg = roomErr.message || '';
          if (msg.includes('Incorrect password')) throw new Error(WRONG_PASSWORD_ERROR);
          if (msg.includes('Room not found')) throw new Error('Room not found. Check the code.');
          throw roomErr;
        }
        if (!roomData) throw new Error('Room not found');
        const typedRoomData = roomData as unknown as Room;

        // Check if user already has an active player in this room (prevents double-join)
        // Capacity check is handled server-side in verify_room_password (SECURITY DEFINER)
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', typedRoomData.id)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        let playerData;
        if (existingPlayer) {
          // Already in the room — rejoin with existing player
          playerData = existingPlayer;
        } else {
          // Insert new player
          const { data: newPlayer, error: playerErr } = await supabase
            .from('players')
            .insert({
              room_id: typedRoomData.id,
              user_id: user.id,
              name,
              avatar_emoji: emoji,
              ...(identity ? { avatar_id: identity.avatarId } : {}),
            })
            .select()
            .single();

          if (playerErr) throw playerErr;
          playerData = newPlayer;
        }

        setRoom(typedRoomData);
        setPlayer(playerData);
        setRoomPassword(password);
        subscribeToRoom(typedRoomData.id);

        // Save session to localStorage for rejoin support
        saveRoomSession(typedRoomData.code, playerData.id, typedRoomData.id, password || undefined);

        // Also for an existing player row: fills a missing secret, keeps an existing one.
        if (identity) await storeSecret(playerData.id, identity.realName, typedRoomData.code);

        return typedRoomData;
      } catch (err: unknown) {
        if (err instanceof SecretSaveError) {
          setError(null);
          throw err;
        }
        let message = err instanceof Error ? err.message : ((err as any)?.message ?? 'Failed to join room');
        // Map server errors to friendly messages
        if (message.includes('already taken')) message = 'That name is taken in this room. Choose another.';
        if (message.includes('Room is full') || message.includes('max')) message = 'Room is full. No more players can join.';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setRoom, setPlayer, setRoomPassword, setLoading, setError, subscribeToRoom, storeSecret]
  );

  const retryRealName = useCallback(async (): Promise<string> => {
    const pending = pendingSecretRef.current;
    if (!pending) throw new Error('No real name to save');
    setLoading(true);
    try {
      await storeSecret(pending.playerId, pending.realName, pending.roomCode);
      return pending.roomCode;
    } finally {
      setLoading(false);
    }
  }, [setLoading, storeSecret]);

  // --- Advance phase (host-only via RPC) ---
  const advancePhase = useCallback(
    async (roomId: string): Promise<void> => {
      setError(null);
      try {
        const { player: currentPlayer } = useGameStore.getState();
        if (!currentPlayer) throw new Error('Not in a room');

        const { error: rpcErr } = await supabase.rpc('advance_room_phase', {
          p_room_id: roomId,
          p_player_id: currentPlayer.id,
        });

        if (rpcErr) {
          const msg = rpcErr.message || '';
          if (msg.includes('Only the host')) throw new Error('Only the host can advance the phase.');
          if (msg.includes('final phase')) throw new Error('Already at the final phase.');
          throw rpcErr;
        }

        // Immediately refetch room so host transitions without waiting for Realtime
        const { data: updatedRoom } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();
        if (updatedRoom) useGameStore.getState().setRoom(updatedRoom as Room);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to advance phase';
        setError(message);
        throw err;
      }
    },
    [setError]
  );

  // --- Leave room ---
  const leaveRoom = useCallback(
    async (mode: 'away' | 'exit' = 'away'): Promise<void> => {
      const { room: currentRoom, player: currentPlayer, reset } = useGameStore.getState();
      if (!currentRoom || !currentPlayer) return;

      try {
        // Try writing new status columns; fall back to is_active if migration not yet applied
        const leavePayload: Record<string, unknown> = {
          is_active: mode === 'away',
        };
        const { error: statusErr } = await supabase
          .from('players')
          .update({
            ...leavePayload,
            status: mode === 'away' ? 'away' : 'exited',
            left_at: mode === 'exit' ? new Date().toISOString() : null,
          })
          .eq('id', currentPlayer.id);

        if (statusErr?.message?.includes('status')) {
          // Migration not applied — fall back
          await supabase.from('players').update(leavePayload).eq('id', currentPlayer.id);
        }

        // Keep localStorage entry so YourRoomsPanel can show the room with AWAY/ENDED badge

        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        subscribedRoomIdRef.current = null;

        reset();
      } catch (err) {
        console.error('[useRoom] leaveRoom failed:', err);
      }
    },
    []
  );

  const refetchRoom = useCallback(async (): Promise<void> => {
    const { room: currentRoom } = useGameStore.getState();
    if (!currentRoom) return;
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', currentRoom.id)
      .single();
    if (data) setRoom(data as Room);
  }, [setRoom]);

  return { room, createRoom, joinRoom, retryRealName, advancePhase, leaveRoom, refetchRoom, isLoading, error };
}

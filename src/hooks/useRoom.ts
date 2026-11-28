import { ROOM_COLUMNS } from '../lib/roomColumns';
import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ensureUser } from '../lib/ensureUser';
import { useGameStore } from '../stores/gameStore';
import { generateRoomCode } from '../lib/roomCode';
import type { Player, Room } from '../lib/types';
import { onLive, onLiveStatus, roomTopic } from '../lib/liveChannel';

/** joinRoom's error for a wrong room password (the join form keys off it). */
export const WRONG_PASSWORD_ERROR = 'Wrong password. Try again.';
/** joinRoom's error after too many failed attempts (095 join_room). */
export const TOO_MANY_ATTEMPTS_ERROR = 'Too many attempts. Wait a few minutes and try again.';

/** Known room errors (English, as thrown) → i18n keys, so the join form shows them in the reader's language. */
export const ROOM_ERROR_KEYS: Record<string, string> = {
  [WRONG_PASSWORD_ERROR]: 'errors.wrongPassword',
  [TOO_MANY_ATTEMPTS_ERROR]: 'errors.tooManyAttempts',
  'Room not found. Check the code.': 'errors.roomNotFound',
  'Room is full. No more players can join.': 'errors.roomFull',
  'That name is taken in this room. Choose another.': 'errors.nameTaken',
  'Failed to join room': 'errors.failedJoinRoom',
  'Failed to create room': 'errors.failedCreateRoom',
};

// --- localStorage helpers for multi-room rejoin ---
const STORAGE_KEY = 'europarty_rooms';

interface RoomSession {
  playerId: string;
  roomId: string;
}

/**
 * Remembers the room on this device for a rejoin (by the player's own id).
 * The room password is never stored (security pack 2d): a plain password in
 * localStorage outlives the party and is readable by anything on the page.
 */
export function saveRoomSession(roomCode: string, playerId: string, roomId: string) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    existing[roomCode.toUpperCase()] = { playerId, roomId } satisfies RoomSession;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

/** Removes passwords that older versions stored with the room sessions. */
export function dropStoredPasswords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || !raw.includes('"password"')) return;
    const existing = JSON.parse(raw) as Record<string, RoomSession & { password?: string }>;
    for (const k of Object.keys(existing)) delete existing[k].password;
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
  dropStoredPasswords();
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
  const channelRef = useRef<(() => void) | null>(null);
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

      // Tear down the previous room's listeners
      channelRef.current?.();

      // Phase changes arrive as a server push on the room's private channel
      // (105). The reconnect banner follows that channel's status.
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const offRoom = onLive<Room>(roomTopic(roomId), 'rooms', (change) => {
        if (change.eventType === 'UPDATE') setRoom(change.new);
      });
      const offStatus = onLiveStatus(roomTopic(roomId), (status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (debounceTimer) return;
          // Debounce: only show the banner if the error persists for 3s.
          debounceTimer = setTimeout(() => {
            debounceTimer = null;
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
        }
        if (status === 'SUBSCRIBED') {
          if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
          useGameStore.getState().setIsReconnecting(false);
        }
      });
      channelRef.current = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        offRoom();
        offStatus();
      };
      subscribedRoomIdRef.current = roomId;
    },
    [setRoom]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      channelRef.current?.();
      channelRef.current = null;
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
        // The anonymous account is made here, not on page load.
        const user = await ensureUser();

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
        saveRoomSession(code, playerData.id, typedRoom.id);

        // Real name right after the player row; the room is already usable,
        // so a failure here is retried on its own (retryRealName).
        if (identity) await storeSecret(playerData.id, identity.realName, code);

        return code;
      } catch (err: unknown) {
        if (err instanceof SecretSaveError) {
          setError(null); // the caller shows the localized retry message
          throw err;
        }
        let message = err instanceof Error ? err.message : ((err as { message?: string } | null)?.message ?? 'Failed to create room');
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
        // The anonymous account is made here, not on page load.
        await ensureUser();

        // One server call (095): password, capacity, attempt limit and the
        // player row are all decided on the server. A returning player gets
        // their own row back. The room comes back without its password hash.
        const { data: joined, error: joinErr } = await supabase.rpc('join_room', {
          p_code: code.toUpperCase(),
          p_password: password,
          p_name: name,
          p_emoji: emoji,
          p_avatar_id: identity?.avatarId ?? null,
        });
        if (joinErr) throw joinErr;

        const result = joined as { error?: string; room?: Room; player?: Player } | null;
        switch (result?.error) {
          case undefined: break;
          case 'wrong_password': throw new Error(WRONG_PASSWORD_ERROR);
          case 'room_not_found': throw new Error('Room not found. Check the code.');
          case 'room_full': throw new Error('Room is full. No more players can join.');
          case 'name_taken': throw new Error('That name is taken in this room. Choose another.');
          case 'too_many_attempts': throw new Error(TOO_MANY_ATTEMPTS_ERROR);
          default: throw new Error('Failed to join room');
        }
        if (!result?.room || !result.player) throw new Error('Failed to join room');
        const typedRoomData = result.room;
        const playerData = result.player;

        setRoom(typedRoomData);
        setPlayer(playerData);
        setRoomPassword(password);
        subscribeToRoom(typedRoomData.id);

        // Save session to localStorage for rejoin support
        saveRoomSession(typedRoomData.code, playerData.id, typedRoomData.id);

        // Also for an existing player row: fills a missing secret, keeps an existing one.
        if (identity) await storeSecret(playerData.id, identity.realName, typedRoomData.code);

        return typedRoomData;
      } catch (err: unknown) {
        if (err instanceof SecretSaveError) {
          setError(null);
          throw err;
        }
        let message = err instanceof Error ? err.message : ((err as { message?: string } | null)?.message ?? 'Failed to join room');
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
          .select(ROOM_COLUMNS)
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

        // Keep localStorage entry so the home rooms list can show the room with AWAY/ENDED badge

        channelRef.current?.();
        channelRef.current = null;
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
      .select(ROOM_COLUMNS)
      .eq('id', currentRoom.id)
      .single();
    if (data) setRoom(data as Room);
  }, [setRoom]);

  return { room, createRoom, joinRoom, retryRealName, advancePhase, leaveRoom, refetchRoom, isLoading, error };
}

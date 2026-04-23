import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { generateRoomCode } from '../lib/roomCode';
import type { Room } from '../lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// --- localStorage helpers for multi-room rejoin ---
const STORAGE_KEY = 'europarty_rooms';

interface RoomSession {
  playerId: string;
  roomId: string;
}

export function saveRoomSession(roomCode: string, playerId: string, roomId: string) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    existing[roomCode.toUpperCase()] = { playerId, roomId };
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

interface UseRoomReturn {
  room: Room | null;
  createRoom: (hostName: string, emoji: string, password: string) => Promise<string>;
  joinRoom: (code: string, name: string, emoji: string, password: string) => Promise<Room>;
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
    async (hostName: string, emoji: string, password: string): Promise<string> => {
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

        return code;
      } catch (err: unknown) {
        let message = err instanceof Error ? err.message : 'Failed to create room';
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
    [setRoom, setPlayer, setRoomPassword, setLoading, setError, subscribeToRoom]
  );

  // --- Join room ---
  const joinRoom = useCallback(
    async (code: string, name: string, emoji: string, password: string): Promise<Room> => {
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
          if (msg.includes('Incorrect password')) throw new Error('Wrong password. Try again.');
          if (msg.includes('Room not found')) throw new Error('Room not found. Check the code.');
          throw roomErr;
        }
        if (!roomData) throw new Error('Room not found');
        const typedRoomData = roomData as unknown as Room;

        // Check max players
        const { count } = await supabase
          .from('players')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', typedRoomData.id)
          .eq('is_active', true);
        if (count !== null && count >= (typedRoomData.max_players ?? 20)) {
          throw new Error('Room is full');
        }

        // Check if user already has an active player in this room (prevents double-join)
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
        saveRoomSession(typedRoomData.code, playerData.id, typedRoomData.id);

        return typedRoomData;
      } catch (err: unknown) {
        let message = err instanceof Error ? err.message : 'Failed to join room';
        // Map server errors to friendly messages
        if (message.includes('already taken')) message = 'That name is taken in this room. Choose another.';
        if (message.includes('Room is full') || message.includes('max')) message = 'Room is full. No more players can join.';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setRoom, setPlayer, setRoomPassword, setLoading, setError, subscribeToRoom]
  );

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

  return { room, createRoom, joinRoom, advancePhase, leaveRoom, refetchRoom, isLoading, error };
}

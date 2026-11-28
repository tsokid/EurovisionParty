import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'europarty_rooms';

export type RoomBadge = 'LIVE' | 'AWAY' | 'ENDED';

export interface RoomEntry {
  playerId: string;
  roomId: string;
  roomCode: string;
  hostName: string;
  totalPoints: number;
  status: 'active' | 'away' | 'exited';
  leftAt: string | null;
  phase: string;
  isHost: boolean;
  /** When this player joined the room (ISO). Newest first within a group. */
  joinedAt: string | null;
  /** The room's last activity (ISO); folds idle rooms under «Παλιά δωμάτια». */
  lastActivityAt: string | null;
}

/** A player row with its room, as the home page's room list reads it. */
interface PlayerRoomRow {
  id: string;
  status?: RoomEntry['status'];
  left_at?: string | null;
  is_active?: boolean;
  joined_at: string | null;
  total_points: number;
  is_host: boolean | null;
  rooms: { id: string; code: string; phase: string; host_name: string; last_activity_at: string | null } | null;
}
type WithRoom = PlayerRoomRow & { rooms: NonNullable<PlayerRoomRow['rooms']> };
const hasRoom = (p: PlayerRoomRow): p is WithRoom => p.rooms !== null;

export function getBadge(entry: RoomEntry): RoomBadge {
  if (entry.phase === 'finished') return 'ENDED';
  if (entry.status === 'active') return 'LIVE';
  return 'AWAY';
}

export function removeFromStorage(roomCode: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete stored[roomCode.toUpperCase()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

/** Rooms idle this long fold under «Παλιά δωμάτια» on the home page. */
export const OLD_AFTER_DAYS = 30;

/**
 * Old = ended, or no activity for OLD_AFTER_DAYS. The schema has no
 * 'finished' phase today, so idleness is what separates last month's party
 * from tonight's (all rooms carry the same contest year between contests).
 */
export function isOldRoom(entry: RoomEntry, now = Date.now()): boolean {
  if (getBadge(entry) === 'ENDED') return true;
  if (!entry.lastActivityAt) return false;
  return now - Date.parse(entry.lastActivityAt) > OLD_AFTER_DAYS * 86_400_000;
}

const ORDER: Record<RoomBadge, number> = { LIVE: 0, AWAY: 1, ENDED: 2 };

const joinedMs = (r: RoomEntry) => (r.joinedAt ? Date.parse(r.joinedAt) : 0);

/** Live, then away, then ended; newest joined first inside each group. */
export function sortRooms(entries: RoomEntry[]): RoomEntry[] {
  return [...entries].sort((a, b) =>
    ORDER[getBadge(a)] - ORDER[getBadge(b)]
    || joinedMs(b) - joinedMs(a));
}

interface CacheState {
  rooms: RoomEntry[];
  loaded: boolean;
  loading: boolean;
}

const cache: CacheState = { rooms: [], loaded: false, loading: false };
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

async function loadOnce(force = false): Promise<void> {
  if (cache.loading) return;
  if (cache.loaded && !force) return;
  cache.loading = true;

  let stored: Record<string, { playerId: string }>;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    cache.loading = false;
    cache.loaded = true;
    notify();
    return;
  }

  const playerIds = Object.values(stored).map((v) => v.playerId);
  if (!playerIds.length) {
    cache.rooms = [];
    cache.loading = false;
    cache.loaded = true;
    notify();
    return;
  }

  const { data, error } = await supabase
    .from('players')
    .select('id, status, left_at, joined_at, total_points, is_host, rooms!inner(id, code, phase, host_name, last_activity_at)')
    .in('id', playerIds);

  if (error) {
    console.error('[useUserRooms] query failed:', error.message);
    const { data: fallback, error: fbErr } = await supabase
      .from('players')
      .select('id, is_active, joined_at, total_points, is_host, rooms!inner(id, code, phase, host_name, last_activity_at)')
      .in('id', playerIds);
    if (fbErr) {
      console.error('[useUserRooms] fallback failed:', fbErr.message);
      cache.loading = false;
      cache.loaded = true;
      notify();
      return;
    }
    if (!fallback?.length) {
      cache.rooms = [];
      cache.loading = false;
      cache.loaded = true;
      notify();
      return;
    }
    const fallbackEntries: RoomEntry[] = (fallback as unknown as PlayerRoomRow[])
      .filter(hasRoom)
      .map((p) => ({
        playerId: p.id,
        roomId: p.rooms.id,
        roomCode: p.rooms.code,
        hostName: p.rooms.host_name,
        totalPoints: p.total_points,
        status: p.is_active ? 'active' : 'exited',
        leftAt: null,
        phase: p.rooms.phase,
        isHost: p.is_host ?? false,
        joinedAt: p.joined_at ?? null,
        lastActivityAt: p.rooms.last_activity_at ?? null,
      }));
    cache.rooms = sortRooms(fallbackEntries);
    cache.loading = false;
    cache.loaded = true;
    notify();
    return;
  }

  if (!data?.length) {
    cache.rooms = [];
    cache.loading = false;
    cache.loaded = true;
    notify();
    return;
  }

  const entries: RoomEntry[] = (data as unknown as PlayerRoomRow[])
    .filter(hasRoom)
    .map((p) => ({
      playerId: p.id,
      roomId: p.rooms.id,
      roomCode: p.rooms.code,
      hostName: p.rooms.host_name,
      totalPoints: p.total_points,
      status: p.status ?? 'active',
      leftAt: p.left_at ?? null,
      phase: p.rooms.phase,
      isHost: p.is_host ?? false,
      joinedAt: p.joined_at ?? null,
      lastActivityAt: p.rooms.last_activity_at ?? null,
    }));

  cache.rooms = sortRooms(entries);
  cache.loading = false;
  cache.loaded = true;
  notify();
}

export function useUserRooms() {
  const [rooms, setRooms] = useState<RoomEntry[]>(cache.rooms);
  const [loaded, setLoaded] = useState<boolean>(cache.loaded);

  useEffect(() => {
    const sub = () => {
      setRooms([...cache.rooms]);
      setLoaded(cache.loaded);
    };
    subscribers.add(sub);
    loadOnce();
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  const updateRooms = useCallback((updater: (prev: RoomEntry[]) => RoomEntry[]) => {
    cache.rooms = updater(cache.rooms);
    notify();
  }, []);

  const refresh = useCallback(() => loadOnce(true), []);

  /** Leave a room: the player row becomes 'exited' (the room stays listed). */
  const leave = useCallback(async (entry: RoomEntry) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('players')
      .update({ is_active: false, status: 'exited', left_at: now })
      .eq('id', entry.playerId);
    if (error?.message?.includes('status')) {
      await supabase.from('players').update({ is_active: false }).eq('id', entry.playerId);
    }
    updateRooms((prev) => sortRooms(prev.map((r) =>
      r.playerId === entry.playerId ? { ...r, status: 'exited', leftAt: now } : r)));
  }, [updateRooms]);

  /** Delete a room the player hosts, and forget it in this browser. */
  const remove = useCallback(async (entry: RoomEntry) => {
    // 097: a host deletes their own room through the server (the table
    // itself only lets admins delete).
    const { error } = await supabase.rpc('delete_room', { p_room_id: entry.roomId });
    if (error) {
      console.error('[useUserRooms] delete failed:', error.message);
      return;
    }
    removeFromStorage(entry.roomCode);
    updateRooms((prev) => prev.filter((r) => r.roomId !== entry.roomId));
  }, [updateRooms]);

  return { rooms, loaded, updateRooms, refresh, leave, remove };
}

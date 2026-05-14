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
}

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

const ORDER: Record<RoomBadge, number> = { LIVE: 0, AWAY: 1, ENDED: 2 };

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
    .select('id, status, left_at, total_points, is_host, rooms!inner(id, code, phase, host_name)')
    .in('id', playerIds);

  if (error) {
    console.error('[useUserRooms] query failed:', error.message);
    const { data: fallback, error: fbErr } = await supabase
      .from('players')
      .select('id, is_active, total_points, is_host, rooms!inner(id, code, phase, host_name)')
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
    const fallbackEntries: RoomEntry[] = (fallback as any[])
      .filter((p) => p.rooms)
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
      }));
    fallbackEntries.sort((a, b) => ORDER[getBadge(a)] - ORDER[getBadge(b)]);
    cache.rooms = fallbackEntries;
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

  const entries: RoomEntry[] = (data as any[])
    .filter((p) => p.rooms)
    .map((p) => ({
      playerId: p.id,
      roomId: p.rooms.id,
      roomCode: p.rooms.code,
      hostName: p.rooms.host_name,
      totalPoints: p.total_points,
      status: p.status,
      leftAt: p.left_at,
      phase: p.rooms.phase,
      isHost: p.is_host ?? false,
    }));

  entries.sort((a, b) => ORDER[getBadge(a)] - ORDER[getBadge(b)]);
  cache.rooms = entries;
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

  return { rooms, loaded, updateRooms, refresh };
}

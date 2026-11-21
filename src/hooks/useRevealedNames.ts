import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';

export interface RevealedNames {
  /** playerId → real name. Empty until the room phase is 'final'. */
  names: Record<string, string>;
  /** The current player's own real name (always readable by its owner). */
  myRealName: string | null;
  /** True once the end-of-game fetch has completed. */
  revealed: boolean;
}

/**
 * Real names for "Ποιος ήταν ποιος;". Secrecy is enforced by RLS
 * (082_player_identity.sql): before 'final' other players' rows are not
 * readable at all, so this hook only asks once the room is 'final', and
 * then exactly once per room (no realtime: player_secrets is not published).
 *
 * Real names never enter the zustand store or any players query: the ids
 * come from a separate `players.select('id')` and the names from
 * player_secrets alone.
 */
export function useRevealedNames(roomId: string | null | undefined): RevealedNames {
  const phase = useGameStore((s) => (s.room && s.room.id === roomId ? s.room.phase : null));
  const myPlayerId = useGameStore((s) => (s.player && s.player.room_id === roomId ? s.player.id : null));
  const isFinal = phase === 'final';

  const [names, setNames] = useState<{ roomId: string; map: Record<string, string> } | null>(null);
  const fetchedRoomRef = useRef<string | null>(null);
  const [mine, setMine] = useState<{ playerId: string; name: string | null } | null>(null);

  // Own real name: readable by its owner at any phase.
  useEffect(() => {
    if (!myPlayerId) return;
    let cancelled = false;
    void supabase
      .from('player_secrets')
      .select('real_name')
      .eq('player_id', myPlayerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMine({ playerId: myPlayerId, name: (data as { real_name?: string } | null)?.real_name ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [myPlayerId]);

  // Everyone's, once, when the game has ended.
  useEffect(() => {
    if (!roomId || !isFinal || fetchedRoomRef.current === roomId) return;
    let cancelled = false;
    (async () => {
      const { data: rows, error: idsErr } = await supabase.from('players').select('id').eq('room_id', roomId);
      if (cancelled || idsErr || !rows) return;
      const ids = (rows as { id: string }[]).map((r) => r.id);
      if (ids.length === 0) {
        fetchedRoomRef.current = roomId;
        setNames({ roomId, map: {} });
        return;
      }
      const { data, error } = await supabase.from('player_secrets').select('player_id, real_name').in('player_id', ids);
      if (cancelled || error || !data) return;
      const map: Record<string, string> = {};
      for (const r of data as { player_id: string; real_name: string }[]) map[r.player_id] = r.real_name;
      fetchedRoomRef.current = roomId;
      setNames({ roomId, map });
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, isFinal]);

  const ready = isFinal && names?.roomId === roomId;
  return {
    names: ready ? names!.map : EMPTY,
    myRealName: mine && mine.playerId === myPlayerId ? mine.name : null,
    revealed: ready,
  };
}

const EMPTY: Record<string, string> = Object.freeze({}) as Record<string, string>;

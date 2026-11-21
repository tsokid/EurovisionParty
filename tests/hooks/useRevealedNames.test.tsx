import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// A tiny in-memory supabase: records every query (table, columns, filters).
const state = vi.hoisted(() => ({
  calls: [] as { table: string; select?: string; filters: unknown[][] }[],
  tables: {} as Record<string, Record<string, unknown>[]>,
}));

vi.mock('../../src/lib/supabase', () => {
  function query(table: string) {
    const call: { table: string; select?: string; filters: unknown[][] } = { table, filters: [] };
    state.calls.push(call);
    let rows = () => state.tables[table] ?? [];
    const chain = {
      select(cols: string) {
        call.select = cols;
        return chain;
      },
      eq(col: string, v: unknown) {
        call.filters.push(['eq', col, v]);
        const prev = rows;
        rows = () => prev().filter((r) => r[col] === v);
        return chain;
      },
      in(col: string, vs: unknown[]) {
        call.filters.push(['in', col, vs]);
        const prev = rows;
        rows = () => prev().filter((r) => vs.includes(r[col]));
        return chain;
      },
      maybeSingle() {
        return Promise.resolve({ data: rows()[0] ?? null, error: null });
      },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        return Promise.resolve({ data: rows(), error: null }).then(res, rej);
      },
    };
    return chain;
  }
  return { supabase: { from: (t: string) => query(t) } };
});

import { useRevealedNames } from '../../src/hooks/useRevealedNames';
import { useGameStore } from '../../src/stores/gameStore';
import type { Player, Room } from '../../src/lib/types';

const ROOM = 'room-1';
const room = (phase: Room['phase']) => ({ id: ROOM, code: 'ABCD', phase }) as Room;
const me = { id: 'p-me', room_id: ROOM, name: 'Πούλια' } as Player;
const tick = () => new Promise((r) => setTimeout(r, 10));

describe('useRevealedNames', () => {
  beforeEach(() => {
    state.calls = [];
    state.tables = {
      players: [{ id: 'p-me', room_id: ROOM }, { id: 'p-2', room_id: ROOM }, { id: 'p-x', room_id: 'other' }],
      player_secrets: [
        { player_id: 'p-me', real_name: 'Νίκη' },
        { player_id: 'p-2', real_name: 'Άλεξ' },
        { player_id: 'p-x', real_name: 'Ξένο' },
      ],
    };
    useGameStore.getState().reset();
    useGameStore.getState().setRoom(room('voting_live'));
    useGameStore.getState().setPlayer(me);
  });

  it('returns {} before final and only reads the own secret', async () => {
    const { result } = renderHook(() => useRevealedNames(ROOM));
    await waitFor(() => expect(result.current.myRealName).toBe('Νίκη'));
    expect(result.current.names).toEqual({});
    expect(result.current.revealed).toBe(false);
    const secretCalls = state.calls.filter((c) => c.table === 'player_secrets');
    expect(secretCalls).toHaveLength(1);
    expect(secretCalls[0].filters).toEqual([['eq', 'player_id', 'p-me']]);
    expect(state.calls.some((c) => c.table === 'players')).toBe(false);
  });

  it('fetches the room real names once when the phase becomes final', async () => {
    const { result, rerender } = renderHook(() => useRevealedNames(ROOM));
    await waitFor(() => expect(result.current.myRealName).toBe('Νίκη'));
    act(() => useGameStore.getState().setRoom(room('final')));
    await waitFor(() => expect(result.current.revealed).toBe(true));
    expect(result.current.names).toEqual({ 'p-me': 'Νίκη', 'p-2': 'Άλεξ' });

    // Ids come from players.select('id') alone: real names are never joined to players.*
    const playersCalls = state.calls.filter((c) => c.table === 'players');
    expect(playersCalls).toHaveLength(1);
    expect(playersCalls[0].select).toBe('id');
    expect(playersCalls[0].filters).toEqual([['eq', 'room_id', ROOM]]);
    const reveal = state.calls.filter((c) => c.table === 'player_secrets' && c.filters[0]?.[0] === 'in');
    expect(reveal).toHaveLength(1);
    expect(reveal[0].select).toBe('player_id, real_name');

    // Once: re-renders and later store updates do not refetch (no realtime either).
    rerender();
    act(() => useGameStore.getState().setRoom({ ...room('final') }));
    await tick();
    expect(state.calls.filter((c) => c.table === 'players')).toHaveLength(1);
  });

  it('never puts real names in the game store', async () => {
    useGameStore.getState().setRoom(room('final'));
    const { result } = renderHook(() => useRevealedNames(ROOM));
    await waitFor(() => expect(result.current.revealed).toBe(true));
    expect(JSON.stringify(useGameStore.getState())).not.toMatch(/Άλεξ|Νίκη/);
  });

  it('ignores a store room that is not this room', async () => {
    useGameStore.getState().setRoom({ ...room('final'), id: 'another' });
    const { result } = renderHook(() => useRevealedNames(ROOM));
    await tick();
    expect(result.current.names).toEqual({});
    expect(state.calls.some((c) => c.table === 'players')).toBe(false);
  });
});

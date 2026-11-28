// Rejoin (28 Nov 2026): the session is read from the phone, not asked of the
// auth server (F7), and a saved player that belongs to another account is
// never taken over (the database refuses the user_id change anyway).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { ROOM, OTHER_PLAYER, updates, getUser } = vi.hoisted(() => ({
  ROOM: { id: 'r1', code: 'K3PW7X', phase: 'lobby' },
  OTHER_PLAYER: { id: 'p-other', room_id: 'r1', user_id: 'someone-else', status: 'active' },
  updates: [] as unknown[],
  getUser: vi.fn(),
}));

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'or', 'order']) c[m] = () => c;
  c.single = async () => result;
  c.maybeSingle = async () => result;
  return c;
}

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'rooms') return chain({ data: ROOM, error: null });
      return {
        ...chain({ data: null, error: null }),
        select: () => {
          // by user: nothing; by saved id: the other account's row
          const c: Record<string, unknown> = {};
          let byId = false;
          c.eq = (col: string) => { if (col === 'id') byId = true; return c; };
          c.or = () => c;
          c.maybeSingle = async () => ({ data: byId ? { ...OTHER_PLAYER } : null, error: null });
          return c;
        },
        update: (v: unknown) => { updates.push(v); return { eq: async () => ({ error: null }) }; },
      };
    },
    auth: {
      getUser,
      getSession: async () => ({ data: { session: { user: { id: 'me' } } } }),
    },
  },
}));

import { useRejoin } from '../../src/hooks/useRejoin';
import { useGameStore } from '../../src/stores/gameStore';

describe('useRejoin with a saved session', () => {
  beforeEach(() => {
    updates.length = 0;
    useGameStore.getState().reset();
    localStorage.setItem('europarty_rooms', JSON.stringify({ K3PW7X: { playerId: 'p-other', roomId: 'r1' } }));
  });

  it('never asks the auth server and never takes over another account\'s player', async () => {
    const { result } = renderHook(() => useRejoin('K3PW7X'));
    await waitFor(() => expect(result.current.status).not.toBe('loading'));
    expect(result.current.status).toBe('not-member');
    expect(getUser).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(useGameStore.getState().player).toBeNull();
  });
});

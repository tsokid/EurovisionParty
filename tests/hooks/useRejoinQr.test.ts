// A QR scan opens /room/CODE on a phone that is not in the room yet. Since
// rooms are readable only by their host and members (migration 051), that
// phone cannot see the room row: it must still go to the join form with the
// code filled in (not-member), not to the home page (23 Nov 2026).
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { code: 'PGRST116', message: '0 rows' } }) }) }),
    }),
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}));

import { useRejoin } from '../../src/hooks/useRejoin';
import { useGameStore } from '../../src/stores/gameStore';

describe('useRejoin for a phone outside the room', () => {
  it('a room it cannot see sends it to the join form, not home', async () => {
    useGameStore.getState().reset();
    const { result } = renderHook(() => useRejoin('K3PW7X'));
    await waitFor(() => expect(result.current.status).not.toBe('loading'));
    expect(result.current.status).toBe('not-member');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  queries: 0,
  responses: [] as Array<{ data: unknown; error: unknown }>,
  listener: null as null | ((event: string, session: unknown) => void),
  signOut: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../src/lib/supabase', () => {
  const session = { user: { id: 'u1', email: 'tsokid@gmail.com' } };
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        onAuthStateChange: vi.fn((cb: (e: string, s: unknown) => void) => {
          h.listener = cb;
          return { data: { subscription: { unsubscribe: () => {} } } };
        }),
        signOut: h.signOut,
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => {
        h.queries += 1;
        return Promise.resolve(h.responses.shift() ?? { data: { user_id: 'u1' }, error: null });
      } }) }) }),
    },
  };
});

import { useAdminAuth } from '../../src/admin/useAdminAuth';

describe('useAdminAuth', () => {
  beforeEach(() => { h.queries = 0; h.responses = []; h.signOut.mockClear(); });

  it('marks allowlisted user as admin', async () => {
    const { result } = renderHook(() => useAdminAuth());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.isAdmin).toBe(true);
  });

  it('coming back to the tab (a sign-in event for the same user) does not check again', async () => {
    const { result } = renderHook(() => useAdminAuth());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    const before = h.queries;
    await act(async () => {
      h.listener?.('SIGNED_IN', { user: { id: 'u1', email: 'tsokid@gmail.com' } });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(h.queries).toBe(before);
    expect(result.current.status).toBe('authenticated');
  });

  it('a network error is retried and never signs the admin out', async () => {
    h.responses = [{ data: null, error: { message: 'Failed to fetch' } }];
    const { result } = renderHook(() => useAdminAuth());
    await waitFor(() => expect(result.current.status).toBe('authenticated'), { timeout: 3000 });
    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.queries).toBe(2);
  });

  it('a user who is not on the list is refused', async () => {
    h.responses = [{ data: null, error: null }];
    const { result } = renderHook(() => useAdminAuth());
    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(h.signOut).toHaveBeenCalled();
  });
});

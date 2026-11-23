// The CMS hung on «Φόρτωση…» after a token refresh (23 Nov 2026): supabase-js
// awaits the onAuthStateChange callbacks while it holds its auth lock, and
// useAdminAuth's callback called supabase.auth.getSession(), which waits for
// that same lock. Every later request (each one reads the session for its
// token) then waited forever. The callback must not call into supabase.auth
// before it returns; it uses the session it is given and defers the rest.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

type Cb = (event: string, session: unknown) => void | Promise<void>;
const h = vi.hoisted(() => ({
  cb: null as Cb | null,
  insideCallback: false,
  calledInside: [] as string[],
  getSession: vi.fn(),
  signOut: vi.fn(),
  isAdmin: true,
}));

vi.mock('../../src/lib/supabase', () => {
  const guard = (name: string, fn: (...a: unknown[]) => unknown) => (...a: unknown[]) => {
    if (h.insideCallback) h.calledInside.push(name);
    return fn(...a);
  };
  return {
    supabase: {
      auth: {
        getSession: guard('getSession', (...a) => h.getSession(...a)),
        signOut: guard('signOut', (...a) => h.signOut(...a)),
        onAuthStateChange: (cb: Cb) => {
          h.cb = cb;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.isAdmin ? { user_id: 'u1' } : null }) }) }),
      }),
    },
  };
});

import { useAdminAuth } from '../../src/admin/useAdminAuth';

const session = (email: string) => ({ user: { id: 'u1', email } });

/** Like supabase-js: the callback runs, and is awaited, inside the auth lock. */
async function emit(event: string, s: unknown) {
  h.insideCallback = true;
  try {
    await h.cb!(event, s);
  } finally {
    h.insideCallback = false;
  }
}

beforeEach(() => {
  h.cb = null;
  h.calledInside = [];
  h.isAdmin = true;
  h.getSession.mockReset();
  h.getSession.mockResolvedValue({ data: { session: session('a@x.test') } });
  h.signOut.mockReset();
  h.signOut.mockResolvedValue({ error: null });
});

describe('useAdminAuth and the supabase auth lock', () => {
  it('a TOKEN_REFRESHED callback calls nothing on supabase.auth while it runs', async () => {
    const { result } = renderHook(() => useAdminAuth());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    await act(async () => { await emit('TOKEN_REFRESHED', session('a@x.test')); });
    expect(h.calledInside).toEqual([]);
    expect(result.current.status).toBe('authenticated');
  });

  it('uses the session the event carries: a SIGNED_OUT event signs the admin out without asking again', async () => {
    const { result } = renderHook(() => useAdminAuth());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    const calls = h.getSession.mock.calls.length;
    await act(async () => { await emit('SIGNED_OUT', null); });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(h.calledInside).toEqual([]);
    expect(h.getSession.mock.calls.length).toBe(calls);
  });

  it('a non-admin signed in through the event is denied, with the sign-out outside the callback', async () => {
    const { result } = renderHook(() => useAdminAuth());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    h.isAdmin = false;
    await act(async () => { await emit('SIGNED_IN', session('b@x.test')); });
    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(h.calledInside).toEqual([]);
    expect(h.signOut).toHaveBeenCalled();
  });
});

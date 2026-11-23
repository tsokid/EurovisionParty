// A visit creates no account (speed plan, 23 Nov 2026): every home visitor,
// crawlers included, used to get an anonymous Supabase user (2,102 users for
// 7 players) and one more network round trip on the home page. The account
// is made only when someone creates or joins a room.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  session: null as unknown,
  signIn: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: h.session } }),
      signInAnonymously: (...a: unknown[]) => h.signIn(...a),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

import { useAuth } from '../../src/hooks/useAuth';
import { ensureUser } from '../../src/lib/ensureUser';

beforeEach(() => {
  h.session = null;
  h.signIn.mockReset();
  h.signIn.mockImplementation(async () => {
    h.session = { user: { id: 'anon-1' } };
    return { data: { session: h.session, user: { id: 'anon-1' } }, error: null };
  });
});

describe('anonymous account only on create/join', () => {
  it('opening the site does not sign anyone in', async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(h.signIn).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('a returning player keeps the existing session', async () => {
    h.session = { user: { id: 'u-9' } };
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.userId).toBe('u-9'));
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it('ensureUser signs in once when there is no session, then reuses it', async () => {
    expect((await ensureUser()).id).toBe('anon-1');
    expect((await ensureUser()).id).toBe('anon-1');
    expect(h.signIn).toHaveBeenCalledTimes(1);
  });

  it('ensureUser surfaces a failed sign-in', async () => {
    h.signIn.mockResolvedValueOnce({ data: { session: null, user: null }, error: { message: 'down' } });
    await expect(ensureUser()).rejects.toMatchObject({ message: 'down' });
  });
});

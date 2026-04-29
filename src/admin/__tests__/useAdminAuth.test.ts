import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../lib/supabase', () => {
  const session = { user: { id: 'u1', email: 'tsokid@gmail.com' } };
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
        signOut: vi.fn().mockResolvedValue({}),
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { user_id: 'u1' } }) }) }) }),
    },
  };
});

import { useAdminAuth } from '../useAdminAuth';

describe('useAdminAuth', () => {
  it('marks allowlisted user as admin', async () => {
    const { result } = renderHook(() => useAdminAuth());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.isAdmin).toBe(true);
  });
});

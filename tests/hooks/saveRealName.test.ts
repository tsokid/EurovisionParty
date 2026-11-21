import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  results: [] as { error: unknown }[],
  calls: [] as { table: string; row: unknown; opts: unknown }[],
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: (row: unknown, opts: unknown) => {
        state.calls.push({ table, row, opts });
        return Promise.resolve(state.results.shift() ?? { error: null });
      },
    }),
  },
}));

import { saveRealName, SecretSaveError } from '../../src/hooks/useRoom';

describe('saveRealName', () => {
  beforeEach(() => {
    state.results = [];
    state.calls = [];
  });

  it('writes player_secrets only, idempotently (keeps an existing secret)', async () => {
    await saveRealName('p1', 'Νίκη', 3, 0);
    expect(state.calls).toEqual([
      { table: 'player_secrets', row: { player_id: 'p1', real_name: 'Νίκη' }, opts: { onConflict: 'player_id', ignoreDuplicates: true } },
    ]);
  });

  it('retries a transient failure', async () => {
    state.results = [{ error: { message: 'network' } }, { error: null }];
    await saveRealName('p1', 'Νίκη', 3, 0);
    expect(state.calls).toHaveLength(2);
  });

  it('throws after the last attempt instead of failing silently', async () => {
    state.results = [{ error: { message: 'a' } }, { error: { message: 'b' } }, { error: { message: 'c' } }];
    await expect(saveRealName('p1', 'Νίκη', 3, 0)).rejects.toMatchObject({ message: 'c' });
    expect(state.calls).toHaveLength(3);
  });

  it('SecretSaveError carries the room code to resume to', () => {
    const e = new SecretSaveError('ABCD');
    expect(e).toBeInstanceOf(Error);
    expect(e.roomCode).toBe('ABCD');
  });
});

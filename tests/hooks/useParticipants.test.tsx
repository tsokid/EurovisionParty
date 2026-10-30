import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const state = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => {
      state.from(...a);
      return {
        select: (...s: unknown[]) => {
          state.select(...s);
          const chain = {
            eq: (...e: unknown[]) => {
              state.eq(...e);
              return chain;
            },
            order: (...o: unknown[]) => {
              state.order(...o);
              return Promise.resolve(state.result);
            },
          };
          return chain;
        },
      };
    },
  },
}));

import { useParticipants } from '../../src/hooks/useParticipants';

describe('useParticipants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps view rows to Country with Greek names', async () => {
    state.result = {
      error: null,
      data: [
        { iso: 'GR', name_en: 'Greece', name_el: 'Ελλάδα', artist: 'A', song: 'S', final_running_order: 7 },
        { iso: 'AT', name_en: 'Austria', name_el: 'Αυστρία', artist: null, song: null, final_running_order: null },
      ],
    };
    const { result } = renderHook(() => useParticipants());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(state.from).toHaveBeenCalledWith('current_participants');
    expect(state.select).toHaveBeenCalledWith('iso, name_en, name_el, artist, song, final_running_order');
    expect(state.order).toHaveBeenCalledWith('name_en');
    expect(result.current.source).toBe('db');
    expect(result.current.participants).toHaveLength(2);
    const gr = result.current.byId.get('GR')!;
    expect(gr).toMatchObject({ id: 'GR', name: 'Greece', name_el: 'Ελλάδα', artist: 'A', song: 'S', runningOrder: 7 });
    const at = result.current.byId.get('AT')!;
    expect(at.runningOrder).toBeUndefined();
    expect(at.artist).toBe('');
  });

  it('falls back to COUNTRIES_2026 when the view is empty', async () => {
    state.result = { data: [], error: null };
    const { result } = renderHook(() => useParticipants());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.source).toBe('hardcoded');
    expect(result.current.participants).toHaveLength(35);
  });

  it('falls back to COUNTRIES_2026 on error', async () => {
    state.result = { data: null, error: { message: 'boom' } };
    const { result } = renderHook(() => useParticipants());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.source).toBe('hardcoded');
    expect(result.current.participants).toHaveLength(35);
  });

  describe('with a room year', () => {
    it("reads that year's finalists from entries_with_names", async () => {
      state.result = {
        error: null,
        data: [{ iso: 'AT', name_en: 'Austria', name_el: 'Αυστρία', artist: 'JJ', song: 'Wasted Love', final_running_order: 9 }],
      };
      const { result } = renderHook(() => useParticipants(2025));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(state.from).toHaveBeenCalledWith('entries_with_names');
      expect(state.from).not.toHaveBeenCalledWith('current_participants');
      expect(state.select).toHaveBeenCalledWith('iso, name_en, name_el, artist, song, final_running_order');
      expect(state.eq.mock.calls).toEqual([['year', 2025], ['in_final', true]]);
      expect(state.order).toHaveBeenCalledWith('name_en');
      expect(result.current.source).toBe('db');
      expect(result.current.participants.map((c) => c.id)).toEqual(['AT']);
    });

    it('falls back to COUNTRIES_2026 only for 2026', async () => {
      state.result = { data: [], error: null };
      const { result } = renderHook(() => useParticipants(2026));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.source).toBe('hardcoded');
      expect(result.current.participants).toHaveLength(35);
    });

    it('returns an empty lineup for another year with no rows', async () => {
      state.result = { data: [], error: null };
      const { result } = renderHook(() => useParticipants(2027));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.source).toBe('db');
      expect(result.current.participants).toEqual([]);
    });

    it('returns an empty lineup for another year on error', async () => {
      state.result = { data: null, error: { message: 'boom' } };
      const { result } = renderHook(() => useParticipants(2027));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.source).toBe('db');
      expect(result.current.participants).toEqual([]);
    });
  });
});

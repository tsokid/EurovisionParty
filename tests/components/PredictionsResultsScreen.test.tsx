import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  calls: [] as { table: string; cols?: string; not?: unknown[]; order?: unknown[] }[],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

vi.mock('../../src/stores/gameStore', () => ({
  useGameStore: () => ({ player: { id: 'p1' }, room: { id: 'r1' } }),
}));

vi.mock('../../src/lib/supabase', () => {
  const rows = [
    { iso: 'SE', name_en: 'Sweden', artist: 'Aa', song: 'Ss', final_place: 1, total_points: 500, jury_points: 300, televote_points: 200 },
    { iso: 'FI', name_en: 'Finland', artist: 'Bb', song: 'Tt', final_place: 2, total_points: 400, jury_points: 150, televote_points: 250 },
  ];
  return {
    supabase: {
      from: (table: string) => {
        const call: (typeof h.calls)[number] = { table };
        h.calls.push(call);
        const chain = {
          select: (cols: string) => { call.cols = cols; return chain; },
          not: (...a: unknown[]) => { call.not = a; return chain; },
          order: (...a: unknown[]) => { call.order = a; return Promise.resolve({ data: rows, error: null }); },
          eq: () => chain,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        };
        return chain;
      },
    },
  };
});

import PredictionsResultsScreen from '../../src/components/results/PredictionsResultsScreen';

describe('PredictionsResultsScreen', () => {
  beforeEach(() => { h.calls.length = 0; });

  it('orders by final_place from current_entries and shows names', async () => {
    render(<PredictionsResultsScreen />);
    await waitFor(() => expect(screen.getByText('Sweden')).toBeTruthy());
    expect(screen.getByText('Finland')).toBeTruthy();

    const entries = h.calls.filter((c) => c.table === 'current_entries');
    expect(entries).toHaveLength(1);
    expect(entries[0].cols).toBe('iso, name_en, artist, song, final_place, total_points, jury_points, televote_points');
    expect(entries[0].not).toEqual(['final_place', 'is', null]);
    expect(entries[0].order).toEqual(['final_place', { ascending: true }]);
    expect(h.calls.some((c) => c.table.startsWith('eurovision_2026_'))).toBe(false);
  });
});

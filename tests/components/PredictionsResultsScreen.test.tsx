import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  calls: [] as { table: string; cols?: string; not?: unknown[]; order?: unknown[]; eq: unknown[][] }[],
  pred: null as null | Record<string, unknown>,
  rows: [] as Record<string, unknown>[],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../src/stores/gameStore', () => ({
  useGameStore: () => ({ player: { id: 'p1' }, room: { id: 'r1', year: 2025 } }),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const call: (typeof h.calls)[number] = { table, eq: [] };
      h.calls.push(call);
      const chain = {
        select: (cols: string) => { call.cols = cols; return chain; },
        not: (...a: unknown[]) => { call.not = a; return chain; },
        order: (...a: unknown[]) => { call.order = a; return Promise.resolve({ data: h.rows, error: null }); },
        eq: (...a: unknown[]) => { call.eq.push(a); return chain; },
        maybeSingle: () => Promise.resolve({ data: h.pred, error: null }),
      };
      return chain;
    },
  },
}));

import PredictionsResultsScreen from '../../src/components/results/PredictionsResultsScreen';

const lineup = (n: number) => Array.from({ length: n }, (_, i) => ({
  iso: `C${String(i + 1).padStart(2, '0')}`, name_en: `Country ${i + 1}`, name_el: `Χώρα ${i + 1}`,
  artist: 'A', song: 'S', final_place: i + 1, total_points: 300 - i, jury_points: 0, televote_points: 0,
}));

describe('PredictionsResultsScreen', () => {
  beforeEach(() => { h.calls.length = 0; h.pred = null; h.rows = lineup(2); });

  it("reads the room year's placed finalists from entries_with_names, ordered by final_place", async () => {
    render(<PredictionsResultsScreen />);
    await waitFor(() => expect(screen.getByText('predBreakdown.noPrediction')).toBeTruthy());

    expect(h.calls.some((c) => c.table === 'current_entries')).toBe(false);
    const entries = h.calls.filter((c) => c.table === 'entries_with_names');
    expect(entries).toHaveLength(1);
    expect(entries[0].cols).toBe('iso, name_en, name_el, artist, song, final_place, total_points, jury_points, televote_points');
    // The room's year (2025), not the live year; grand finalists only.
    expect(entries[0].eq).toEqual([['year', 2025], ['in_final', true]]);
    expect(entries[0].not).toEqual(['final_place', 'is', null]);
    expect(entries[0].order).toEqual(['final_place', { ascending: true }]);
    expect(h.calls.some((c) => c.table.startsWith('eurovision_2026_'))).toBe(false);
  });

  it('shows the 10-pick breakdown with points chips and no official-ranking panel', async () => {
    h.rows = lineup(26);
    h.pred = {
      top5: ['C01', 'C03', 'C02', 'C07', 'C05'],
      worst5: ['C26', 'C24', 'C20', 'C25', 'C16'],
      top5_points: 140, worst5_points: 90,
    };
    const { container } = render(<PredictionsResultsScreen />);
    await waitFor(() => expect(container.querySelectorAll('.bd-row')).toHaveLength(10));

    // No row for a country nobody picked (the old 1..N panel is gone).
    expect(screen.queryByText('Country 10')).toBeNull();
    expect(screen.queryByText('predResults.col.jury')).toBeNull();

    const top = screen.getByRole('region', { name: /pick\.top5/ });
    const topRows = within(top).getAllByRole('listitem');
    expect(topRows[0]).toHaveTextContent('+50');
    expect(topRows[0]).toHaveTextContent('predBreakdown.exact');
    expect(topRows[0].querySelector('.chip')).toHaveClass('chip-gold');
    expect(topRows[1]).toHaveTextContent('+20');
    expect(topRows[1].querySelector('.chip')).toHaveClass('chip-pink');
    expect(topRows[3]).toHaveTextContent('predBreakdown.miss');

    // Worst 5 for 26 finalists: places 22..26, last row = worst5[0] = 26th, exact.
    const worst = screen.getByRole('region', { name: /pick\.worst5/ });
    const nums = within(worst).getAllByRole('listitem').map((li) => li.querySelector('.bd-n')?.textContent);
    expect(nums).toEqual(['22', '23', '24', '25', '26']);
    expect(within(worst).getAllByRole('listitem')[4]).toHaveTextContent('+50');
    expect(worst).toHaveTextContent('"from":22,"to":26,"count":26');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('"hits":7');
    expect(screen.getByText(/predBreakdown\.points\{"points":230\}/)).toBeTruthy();
  });

  it('worst-5 places follow a 25-finalist year (21..25)', async () => {
    h.rows = lineup(25);
    h.pred = { top5: ['C01', 'C02', 'C03', 'C04', 'C05'], worst5: ['C25', 'C24', 'C23', 'C22', 'C21'], top5_points: 250, worst5_points: 250 };
    render(<PredictionsResultsScreen />);
    const worst = await screen.findByRole('region', { name: /pick\.worst5/ });
    const nums = within(worst).getAllByRole('listitem').map((li) => li.querySelector('.bd-n')?.textContent);
    expect(nums).toEqual(['21', '22', '23', '24', '25']);
    expect(within(worst).getAllByText('+50')).toHaveLength(5);
  });
});

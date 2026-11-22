import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '../../src/i18n';
import type { Country } from '../../src/lib/types';

const h = vi.hoisted(() => ({
  phase: 'predictions_open' as string,
  n: 26,
  saved: null as null | Record<string, unknown>,
  upserts: [] as { payload: unknown; opts: unknown }[],
}));

vi.mock('../../src/stores/gameStore', () => ({
  useGameStore: () => ({ player: { id: 'p1' }, room: { id: 'r1', year: 2026, phase: h.phase } }),
}));

vi.mock('../../src/hooks/useParticipants', () => ({
  useParticipants: () => {
    const participants: Country[] = Array.from({ length: h.n }, (_, i) => ({
      id: `C${String(i + 1).padStart(2, '0')}`,
      name: `Country ${String(i + 1).padStart(2, '0')}`,
      name_el: `Χώρα ${String(i + 1).padStart(2, '0')}`,
      flag: '', artist: `Artist ${i + 1}`, song: `Song ${i + 1}`, runningOrder: h.n - i,
    }));
    return { participants, byId: new Map(participants.map((c) => [c.id, c])), loading: false, source: 'db' };
  },
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => Promise.resolve({ data: h.saved, error: null }),
        upsert: (payload: unknown, opts: unknown) => { h.upserts.push({ payload, opts }); return Promise.resolve({ error: null }); },
      };
      return chain;
    },
  },
}));

import PredictionsScreen from '../../src/components/predictions/PredictionsScreen';

beforeAll(async () => { await i18n.changeLanguage('el'); });
beforeEach(() => { h.phase = 'predictions_open'; h.n = 26; h.saved = null; h.upserts.length = 0; });

const country = (n: number) => `Χώρα ${String(n).padStart(2, '0')}`;
const tap = (n: number) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${country(n)}\\.`) }));
const panel = (list: 'top' | 'worst') => document.querySelector<HTMLElement>(`.pk-panel[data-list="${list}"]`)!;
const slotNums = (list: 'top' | 'worst') =>
  [...panel(list).querySelectorAll('.pk-slot-n')].map((e) => e.textContent);

describe('PredictionsScreen (tap-to-assign)', () => {
  it.each([[26, ['22', '23', '24', '25', '26']], [25, ['21', '22', '23', '24', '25']], [24, ['20', '21', '22', '23', '24']]])(
    '%i finalists → Worst 5 slots %j', async (n, places) => {
      h.n = n;
      render(<PredictionsScreen />);
      await screen.findByRole('heading', { level: 1, name: 'Top 5 και Worst 5 του τελικού' });
      expect(slotNums('top')).toEqual(['1', '2', '3', '4', '5']);
      expect(slotNums('worst')).toEqual(places);
      expect(panel('worst')).toHaveTextContent(`${n} φιναλίστ φέτος, άρα Worst 5 = ${places[0]}η–${places[4]}η`);
    },
  );

  it('fewer than 10 finalists keeps the scoring overlap (8 → 4..8)', async () => {
    h.n = 8;
    render(<PredictionsScreen />);
    await screen.findByRole('heading', { level: 1 });
    expect(slotNums('worst')).toEqual(['4', '5', '6', '7', '8']);
  });

  it('tap 10, clear one, reorder, submit: same upsert payload shape as before', async () => {
    render(<PredictionsScreen />);
    await screen.findByRole('heading', { level: 1 });
    const submit = screen.getByRole('button', { name: 'Υποβολή προβλέψεων' });
    expect(submit).toBeDisabled();

    for (const n of [1, 2, 3, 4, 5]) tap(n);
    // Top 5 full → the next tap goes to Worst 5, top row on screen (22nd).
    expect(screen.getByRole('button', { name: /^Worst 5/, pressed: true })).toBeTruthy();
    for (const n of [26, 25, 24, 23, 22]) tap(n);
    expect(screen.getByRole('img', { name: '10 από 10 θέσεις' })).toBeTruthy();
    expect(submit).toBeEnabled();

    // Pool tag shows the dynamic place.
    expect(screen.getByRole('button', { name: `${country(26)}, Worst · 22η. Πάτα για αφαίρεση` })).toBeTruthy();

    // Clear Top 5 #2 by tapping its slot, then refill it.
    fireEvent.click(within(panel('top')).getByRole('button', { name: `Top 5, θέση 2: ${country(2)}. Πάτα για να αδειάσει` }));
    expect(submit).toBeDisabled();
    expect(within(panel('top')).getByRole('button', { name: 'Top 5, θέση 2: κενή' })).toBeTruthy();
    tap(6);
    // Reorder: Χώρα 06 (now 2nd) one place up.
    fireEvent.click(within(panel('top')).getByRole('button', { name: `Μία θέση πάνω: ${country(6)}` }));

    fireEvent.click(submit);
    await waitFor(() => expect(h.upserts).toHaveLength(1));
    const { payload, opts } = h.upserts[0] as { payload: Record<string, unknown>; opts: unknown };
    expect(opts).toEqual({ onConflict: 'room_id,player_id' });
    expect(payload).toMatchObject({
      room_id: 'r1', player_id: 'p1', is_locked: false,
      top5: ['C06', 'C01', 'C03', 'C04', 'C05'],
      // Storage order unchanged: worst5[0] = last place (26th) … worst5[4] = 22nd.
      worst5: ['C22', 'C23', 'C24', 'C25', 'C26'],
    });
    expect(typeof payload.submitted_at).toBe('string');
    // After a save: the submitted summary, still editable while open.
    expect(await screen.findByRole('heading', { name: 'Οι προβλέψεις υποβλήθηκαν' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Αλλαγή προβλέψεων' })).toBeTruthy();
  }, 20_000); // many sequential taps; slow under the full parallel suite

  it('a saved prediction loads into its slots (worst5[0] shown as last place)', async () => {
    h.saved = { top5: ['C01', 'C02', 'C03', 'C04', 'C05'], worst5: ['C26', 'C25', 'C24', 'C23', 'C22'], top5_points: null, worst5_points: null, scored_at: null };
    render(<PredictionsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Αλλαγή προβλέψεων' }));
    const rows = [...panel('worst').querySelectorAll('.pk-slot')].map((li) => li.textContent);
    expect(rows[0]).toContain('22');
    expect(rows[0]).toContain(country(22));
    expect(rows[4]).toContain('26');
    expect(rows[4]).toContain(country(26));
    expect(screen.getByRole('button', { name: 'Ενημέρωση προβλέψεων' })).toBeEnabled();
  });

  it('not editable outside predictions_open: sealed picks, no picker', async () => {
    h.phase = 'voting_live';
    h.saved = { top5: ['C01', 'C02', 'C03', 'C04', 'C05'], worst5: ['C26', 'C25', 'C24', 'C23', 'C22'], top5_points: null, worst5_points: null, scored_at: null };
    render(<PredictionsScreen />);
    expect(await screen.findByRole('heading', { name: 'Σφραγίστηκαν οι προβλέψεις' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Υποβολή|Ενημέρωση|Αλλαγή/ })).toBeNull();
    expect(document.querySelector('.pk-stamp')).toHaveTextContent('σφραγίστηκε');
  });

  it('closed with nothing submitted: the closed message only', async () => {
    h.phase = 'pre_night';
    render(<PredictionsScreen />);
    expect(await screen.findByRole('heading', { name: 'Οι προβλέψεις δεν είναι ανοιχτές' })).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

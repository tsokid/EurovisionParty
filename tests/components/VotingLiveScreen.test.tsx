import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import i18n from '../../src/i18n';
import type { Country } from '../../src/lib/types';

const h = vi.hoisted(() => ({ saved: null as null | Record<string, unknown>, n: 25 }));

vi.mock('../../src/stores/gameStore', () => ({
  useGameStore: () => ({ player: { id: 'p1' }, room: { id: `r-${Math.random()}`, year: 2026, phase: 'voting_live' } }),
}));
vi.mock('../../src/hooks/useParticipants', () => ({
  useParticipants: () => {
    const participants: Country[] = Array.from({ length: h.n }, (_, i) => ({
      id: `C${String(i + 1).padStart(2, '0')}`, name: `Country ${i + 1}`, name_el: `Χώρα ${i + 1}`, flag: '',
    }));
    return { participants, byId: new Map(participants.map((c) => [c.id, c])), loading: false, source: 'db' };
  },
}));
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: () => Promise.resolve({ data: h.saved, error: null }) };
      return chain;
    },
  },
}));

import VotingLiveScreen from '../../src/components/results/VotingLiveScreen';

beforeAll(async () => { await i18n.changeLanguage('el'); });
beforeEach(() => { h.saved = null; h.n = 25; });

describe('VotingLiveScreen', () => {
  it("shows the voting-live state and the player's locked picks with flags", async () => {
    h.saved = { top5: ['C01', 'C02', 'C03', 'C04', 'C05'], worst5: ['C25', 'C24', 'C23', 'C22', 'C21'] };
    render(<VotingLiveScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Η Eurovision ψηφίζει' })).toBeTruthy();
    const worst = await screen.findByRole('region', { name: 'Worst 5' });
    const rows = within(worst).getAllByRole('listitem');
    expect(rows.map((r) => r.querySelector('.pk-sum-n')?.textContent)).toEqual(['21', '22', '23', '24', '25']);
    expect(rows[4]).toHaveTextContent('Χώρα 25');
    expect(rows[0].querySelector('img.flag, span.flag')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Top 5' })).getAllByRole('listitem')[0]).toHaveTextContent('Χώρα 1');
    expect(worst).toHaveTextContent('θέσεις 21–25 (25 φιναλίστ)');
  });

  it('no invented live data: no provisional scores, juries or televote', async () => {
    h.saved = { top5: ['C01', 'C02', 'C03', 'C04', 'C05'], worst5: ['C25', 'C24', 'C23', 'C22', 'C21'] };
    const { container } = render(<VotingLiveScreen />);
    await screen.findByRole('region', { name: 'Top 5' });
    expect(container.textContent).not.toMatch(/κριτ|televote|τηλεψ|προσωριν|πόντοι χώρας/i);
  });

  it('nothing submitted: says so instead of empty lists', async () => {
    render(<VotingLiveScreen />);
    expect(await screen.findByText('Δεν υποβλήθηκαν προβλέψεις πριν κλειδώσουν.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Top 5' })).toBeNull();
  });

  it('predictions, voting and breakdown copy is gender-neutral', () => {
    const el = i18n.getResourceBundle('el', 'translation') as Record<string, Record<string, string>>;
    const strings = [el.pick, el.voting, el.predBreakdown].flatMap((o) => Object.values(o)).join(' \n ');
    // No player is addressed in the third person, and no adjective agrees
    // with the player (έτοιμος/έτοιμη…). Articles and «αυτή τη φάση» belong to things.
    expect(strings).not.toMatch(/(?<!\p{L})(αυτός|αυτόν|ποιος|ποιον|μόνος|μόνη|έτοιμος|έτοιμη|σίγουρος|σίγουρη)(?!\p{L})/iu);
  });
});

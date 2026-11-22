import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({ rpc: vi.fn(), gamePhase: 'pre_night' as string }));

vi.mock('../../src/lib/supabase', () => {
  const rooms = [{ phase: 'pre_night' }, { phase: 'pre_night' }, { phase: 'lobby' }];
  return {
    supabase: {
      from: (table: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () =>
          table === 'rooms' ? Promise.resolve({ data: rooms, error: null }) : chain;
        chain.maybeSingle = () => Promise.resolve({ data: { game_phase: h.gamePhase }, error: null });
        return chain;
      },
      rpc: (name: string, args: unknown) => {
        h.rpc(name, args);
        return Promise.resolve({ data: 2, error: null });
      },
    },
  };
});

import { GamePhaseCard } from '../../src/admin/modules/parser/GamePhaseCard';

describe('GamePhaseCard', () => {
  beforeEach(() => {
    h.rpc.mockClear();
    h.gamePhase = 'pre_night';
  });

  it('opens predictions for its year after a confirm', async () => {
    render(<GamePhaseCard year={2026} pollMs={60_000} />);
    await screen.findByText('Πριν τις προβλέψεις');
    expect(await screen.findByText(/Αναμονή: 1 · Πριν τις προβλέψεις: 2./)).toBeTruthy();
    expect((screen.getByText('Κλείσιμο προβλέψεων') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByText('Άνοιγμα προβλέψεων'));
    expect(h.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Ναι'));

    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('set_game_phase', { p_year: 2026, p_phase: 'predictions_open' }),
    );
    expect(await screen.findByText(/Μετακινήθηκαν 2 δωμάτια/)).toBeTruthy();
  });

  it('closes predictions once they are open', async () => {
    h.gamePhase = 'predictions_open';
    render(<GamePhaseCard year={2027} pollMs={60_000} />);
    await screen.findByText('Προβλέψεις ανοιχτές');
    expect((screen.getByText('Άνοιγμα προβλέψεων') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByText('Κλείσιμο προβλέψεων'));
    fireEvent.click(screen.getByText('Ναι'));

    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('set_game_phase', { p_year: 2027, p_phase: 'voting_live' }),
    );
  });
});

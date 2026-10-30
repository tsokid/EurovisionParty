import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../src/lib/supabase', () => {
  const chain = {
    select: () => chain,
    order: () => Promise.resolve({ data: [], error: null }),
  };
  return {
    supabase: {
      from: () => chain,
      rpc: (name: string, args?: unknown) => {
        h.rpc(name, args);
        if (name === 'live_contest_year') return Promise.resolve({ data: 2027, error: null });
        return Promise.resolve({ data: null, error: null });
      },
    },
  };
});

import { ManualRankingCard } from '../../src/admin/modules/parser/ManualRankingCard';

describe('ManualRankingCard', () => {
  // Reset/finalize are only rendered when override is on (which needs a job),
  // so with no job the reachable year-dependent callback is the override toggle.
  it('uses the live contest year (2027) for RPCs when there is no job', async () => {
    render(<ManualRankingCard onRefresh={() => {}} />);
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('live_contest_year', undefined));
    // let the resolved year propagate into state
    await new Promise((r) => setTimeout(r, 0));

    fireEvent.click(screen.getByText('OFF'));

    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('set_manual_override', { p_year: 2027, p_active: true }),
    );
  });
});

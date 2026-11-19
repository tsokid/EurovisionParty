import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../src/lib/supabase', () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
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
import type { ParseJob } from '../../src/admin/modules/parser/useParserState';

describe('ManualRankingCard', () => {
  // The card acts on the parser page's year (the job's year), the same year
  // as Finalize and the parse cards, never on live_contest_year().
  it("uses the job's year for RPCs", async () => {
    h.rpc.mockClear();
    const job = { kind: 'results', year: 2025, status: 'idle', manual_override: false } as ParseJob;
    render(<ManualRankingCard job={job} onRefresh={() => {}} />);

    fireEvent.click(screen.getByText('OFF'));

    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('set_manual_override', { p_year: 2025, p_active: true }),
    );
    expect(h.rpc).not.toHaveBeenCalledWith('live_contest_year', undefined);
  });
});

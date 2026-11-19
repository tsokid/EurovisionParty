import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// parse_jobs has 2027 (newest contest, created but not played) and 2026
// (the game year). The parser page must open on the game year.
vi.mock('../../src/lib/supabase', () => {
  const jobs = [
    { kind: 'participants', year: 2027, status: 'done', manual_override: false },
    { kind: 'results', year: 2027, status: 'idle', manual_override: false },
    { kind: 'participants', year: 2026, status: 'done', manual_override: false },
    { kind: 'results', year: 2026, status: 'finalized', manual_override: false },
  ];
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => Object.assign(Promise.resolve({ data: jobs, error: null }), chain);
  chain.limit = () => Promise.resolve({ data: [], error: null });
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  return {
    supabase: {
      from: () => chain,
      rpc: (name: string) =>
        Promise.resolve({ data: name === 'live_contest_year' ? 2026 : null, error: null }),
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  };
});

import EurovisionParser from '../../src/admin/modules/EurovisionParser';

describe('EurovisionParser year', () => {
  it('opens on the game year, not the newest parse_jobs year', async () => {
    render(<EurovisionParser />);
    const picker = await screen.findByLabelText('Contest year');
    await waitFor(() => expect((picker as HTMLSelectElement).value).toBe('2026'));
    expect(screen.getByRole('option', { name: '2027' })).toBeTruthy();
  });
});

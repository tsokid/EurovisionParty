import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { ParseJob } from '../../src/admin/modules/parser/useParserState';

const h = vi.hoisted(() => ({ rpc: vi.fn(), result: { data: 3 as unknown, error: null as unknown } }));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args?: unknown) => {
      h.rpc(name, args);
      return Promise.resolve(h.result);
    },
  },
}));

import { FinalizeCard } from '../../src/admin/modules/parser/FinalizeCard';

const job = (status: ParseJob['status']): ParseJob =>
  ({ kind: 'results', year: 2027, status, manual_override: false }) as ParseJob;

describe('FinalizeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.result = { data: 3, error: null };
  });

  it('explains the contest finalize for the job year', () => {
    render(<FinalizeCard job={job('done')} onRefresh={() => {}} />);
    expect(screen.getByText('Finalize 2027: locks results, scores all rooms of 2027, computes winners.')).toBeTruthy();
  });

  it('calls finalize_contest (not finalize_results) and reports rooms with winners', async () => {
    const onRefresh = vi.fn();
    render(<FinalizeCard job={job('done')} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finalize 2027' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, finalize 2027' }));

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('finalize_contest', { p_year: 2027 }));
    expect(h.rpc).not.toHaveBeenCalledWith('finalize_results', expect.anything());
    await waitFor(() => expect(screen.getByText(/Rooms of 2027 with winners computed:/)).toBeTruthy());
    expect(screen.getByText('3')).toBeTruthy();
    expect(onRefresh).toHaveBeenCalled();
  });

  it('shows the RPC error', async () => {
    h.result = { data: null, error: { message: 'contest 2027 has no results; finalize refused' } };
    render(<FinalizeCard job={job('done')} onRefresh={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finalize 2027' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, finalize 2027' }));
    await waitFor(() => expect(screen.getByText(/has no results; finalize refused/)).toBeTruthy());
  });
});

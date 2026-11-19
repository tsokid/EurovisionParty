import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { ParseJob } from '../../src/admin/modules/parser/useParserState';

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
  from: vi.fn(),
  result: { data: 3 as unknown, error: null as unknown },
  stage: 'current' as string | null,
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args?: unknown) => {
      h.rpc(name, args);
      return Promise.resolve(h.result);
    },
    from: (name: string) => {
      h.from(name);
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => Promise.resolve({ data: h.stage ? { stage: h.stage } : null, error: null }),
      };
      return chain;
    },
    functions: { invoke: (name: string, opts: unknown) => h.invoke(name, opts) },
  },
}));

import { FinalizeCard } from '../../src/admin/modules/parser/FinalizeCard';
import { __resetPublishGuardForTests } from '../../src/admin/modules/contests/publish';

const job = (status: ParseJob['status']): ParseJob =>
  ({ kind: 'results', year: 2027, status, manual_override: false }) as ParseJob;

describe('FinalizeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.result = { data: 3, error: null };
    h.stage = 'current';
    h.invoke.mockResolvedValue({ data: { status: 'ok', run_id: 1, sha: 'abc1234ffff', files_changed: 2 }, error: null });
  });
  afterEach(() => __resetPublishGuardForTests());

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

  it('never publishes: Finalize changes only the game (081)', async () => {
    render(<FinalizeCard job={job('done')} onRefresh={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finalize 2027' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, finalize 2027' }));
    await waitFor(() => expect(screen.getByText(/2027 finalized\./)).toBeTruthy());
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('offers Copy to public once finalized and calls copy_game_to_public after a confirm', async () => {
    h.result = { data: 25, error: null };
    render(<FinalizeCard job={job('done')} onRefresh={() => {}} />);
    expect(screen.queryByText('Copy 2027 results to public')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Finalize 2027' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, finalize 2027' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy 2027 results to public' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, copy' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('copy_game_to_public', { p_year: 2027 }));
    expect(await screen.findByText(/25 finalists copied\. Review them in Contests → Edit, then Publish\./)).toBeTruthy();
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('keeps Reset Finalized for a finalized job whose contest is still current', async () => {
    h.stage = 'current';
    render(<FinalizeCard job={job('finalized')} onRefresh={() => {}} />);
    expect(await screen.findByRole('button', { name: /Reset Finalized/ })).toBeTruthy();
    expect(h.from).toHaveBeenCalledWith('contests');
  });

  it('shows the RPC error', async () => {
    h.result = { data: null, error: { message: 'contest 2027 has no results; finalize refused' } };
    render(<FinalizeCard job={job('done')} onRefresh={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finalize 2027' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, finalize 2027' }));
    await waitFor(() => expect(screen.getByText(/has no results; finalize refused/)).toBeTruthy());
    expect(h.invoke).not.toHaveBeenCalled();
  });
});

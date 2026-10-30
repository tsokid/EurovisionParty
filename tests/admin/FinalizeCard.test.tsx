import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const job = (status: ParseJob['status']): ParseJob =>
  ({ kind: 'results', year: 2027, status, manual_override: false }) as ParseJob;

describe('FinalizeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.result = { data: 3, error: null };
    h.stage = 'current';
    h.invoke.mockResolvedValue({ data: { status: 'ok', run_id: 1, sha: 'abc1234ffff', files_changed: 2 }, error: null });
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

  it('publishes automatically after a successful finalize', async () => {
    render(<FinalizeCard job={job('done')} onRefresh={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finalize 2027' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, finalize 2027' }));
    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith('publish-content', { body: {} }));
    expect(await screen.findByText(/Published: 2 files changed/)).toBeTruthy();
  });

  it('a failed publish after finalize shows the error; the finalize stands', async () => {
    h.invoke.mockResolvedValue({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });
    render(<FinalizeCard job={job('done')} onRefresh={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finalize 2027' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, finalize 2027' }));
    expect(await screen.findByText('Publish failed: Failed to send a request to the Edge Function')).toBeTruthy();
    expect(screen.getByText(/2027 finalized\./)).toBeTruthy();
  });

  it.each(['finalized', 'archived'])('hides Reset Finalized once the contest is %s, and points to Edit + Republish', async (stage) => {
    h.stage = stage;
    render(<FinalizeCard job={job('finalized')} onRefresh={() => {}} />);
    expect(
      await screen.findByText('To correct results of 2027, edit its entries in Contests, then Publish.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reset Finalized/ })).toBeNull();
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

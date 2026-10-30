import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  rpcError: {} as Record<string, { message: string; code: string }>,
  summaries: [] as Row[],
  entries: [] as Row[],
  countries: [] as Row[],
}));

vi.mock('../../src/lib/supabase', () => {
  const table = (name: string) => {
    const rows = () => (name === 'contest_entries' ? h.entries : name === 'countries' ? h.countries : []);
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(ok, bad),
    };
    return chain;
  };
  return {
    supabase: {
      from: (name: string) => table(name),
      rpc: (name: string, args?: unknown) => {
        h.rpc(name, args);
        if (h.rpcError[name]) return Promise.resolve({ data: null, error: h.rpcError[name] });
        if (name === 'contest_summaries') return Promise.resolve({ data: h.summaries, error: null });
        if (name === 'contest_has_rooms') return Promise.resolve({ data: false, error: null });
        return Promise.resolve({ data: null, error: null });
      },
    },
  };
});

import Contests from '../../src/admin/modules/Contests';

const summary = (year: number, stage: string, entry_count: number): Row => ({
  year,
  city: `City${year}`,
  city_slug: `city${year}`,
  host_iso: null,
  stage,
  final_date: null,
  indexable: false,
  entry_count,
  finalist_count: 0,
});

const rowFor = async (year: number) => within((await screen.findByText(String(year))).closest('tr')!);

describe('Contests module', () => {
  beforeEach(() => {
    h.rpc.mockClear();
    h.rpcError = {};
    h.summaries = [summary(2027, 'upcoming', 5), summary(2026, 'finalized', 26), summary(2025, 'archived', 26)];
    h.entries = [];
    h.countries = [
      { iso: 'AT', name_en: 'Austria' },
      { iso: 'GR', name_en: 'Greece' },
    ];
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists contests newest first with stage badges and only legal buttons', async () => {
    render(<Contests />);
    const r27 = await rowFor(2027);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('td')?.textContent)).toEqual(['2027', '2026', '2025']);
    expect(r27.getByText('upcoming')).toBeTruthy();
    expect(r27.queryByRole('button', { name: 'Start' })).toBeNull(); // 2026 is live
    const r26 = await rowFor(2026);
    expect(r26.getByRole('button', { name: 'Archive' })).toBeTruthy();
    expect(r26.queryByRole('button', { name: 'Finalize' })).toBeNull();
  });

  it('Archive calls archive_contest only after confirm returns true, then reloads', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Contests />);
    const r26 = await rowFor(2026);

    fireEvent.click(r26.getByRole('button', { name: 'Archive' }));
    expect(confirm).toHaveBeenCalledWith(
      'Archive 2026: 2026 becomes archived and 2027 becomes the current contest. You can undo with Un-archive until a 2027 room is created.',
    );
    expect(h.rpc).not.toHaveBeenCalledWith('archive_contest', expect.anything());

    confirm.mockReturnValue(true);
    const before = h.rpc.mock.calls.filter(([n]) => n === 'contest_summaries').length;
    fireEvent.click(r26.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('archive_contest', { p_year: 2026 }));
    await waitFor(() =>
      expect(h.rpc.mock.calls.filter(([n]) => n === 'contest_summaries').length).toBe(before + 1),
    );
  });

  it('Un-archive is checked against rooms of Y+1', async () => {
    h.summaries = [summary(2027, 'current', 5), summary(2026, 'archived', 26)];
    render(<Contests />);
    const r26 = await rowFor(2026);
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('contest_has_rooms', { p_year: 2027 }));
    expect(await r26.findByRole('button', { name: 'Un-archive' })).toBeTruthy();
  });

  it('Create year sends the form to create_contest', async () => {
    render(<Contests />);
    await rowFor(2027);
    fireEvent.click(screen.getByRole('button', { name: 'Create year' }));
    const set = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    set('Year', '2028');
    set('City', 'Lisbon');
    set('Slug', 'lisbon');
    set('Host ISO', 'pt');
    set('Semi 1', '2028-05-09');
    set('Semi 2', '2028-05-11');
    set('Final', '2028-05-13');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('create_contest', {
        p_year: 2028,
        p_city: 'Lisbon',
        p_city_slug: 'lisbon',
        p_host_iso: 'PT',
        p_semi1: '2028-05-09',
        p_semi2: '2028-05-11',
        p_final: '2028-05-13',
      }),
    );
  });

  it('entries editor saves only the changed fields through upsert_contest_entry', async () => {
    h.entries = [
      {
        year: 2026, iso: 'GR', artist: 'A1', song: 'S1', semi: 1, semi_place: 2, qualified: true,
        in_final: true, final_running_order: 3, final_place: null, total_points: null,
      },
    ];
    render(<Contests />);
    const r26 = await rowFor(2026);
    fireEvent.click(r26.getByRole('button', { name: 'Entries' }));
    const artist = await screen.findByDisplayValue('A1');
    const entry = within(artist.closest('tr')!);
    expect(entry.getByText('Greece')).toBeTruthy();
    fireEvent.change(artist, { target: { value: 'New Artist' } });
    fireEvent.change(entry.getByLabelText('Final place GR'), { target: { value: '4' } });
    fireEvent.click(entry.getByLabelText('In final GR'));
    fireEvent.click(entry.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('upsert_contest_entry', {
        p_year: 2026,
        p_iso: 'GR',
        p_fields: { artist: 'New Artist', in_final: false, final_place: 4 },
      }),
    );
  });

  it('saving one row keeps unsaved edits of other rows', async () => {
    h.entries = [
      { year: 2026, iso: 'AT', artist: 'B1', song: 'S2', in_final: false },
      { year: 2026, iso: 'GR', artist: 'A1', song: 'S1', in_final: false },
    ];
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Entries' }));
    fireEvent.change(await screen.findByDisplayValue('A1'), { target: { value: 'A1 edited' } });
    fireEvent.change(screen.getByDisplayValue('B1'), { target: { value: 'B1 edited' } });
    fireEvent.click(within(screen.getByDisplayValue('A1 edited').closest('tr')!).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('upsert_contest_entry', {
        p_year: 2026,
        p_iso: 'GR',
        p_fields: { artist: 'A1 edited' },
      }),
    );
    await waitFor(() => expect(screen.getByDisplayValue('A1')).toBeTruthy()); // reloaded from the mock
    expect(screen.getByDisplayValue('B1 edited')).toBeTruthy();
  });

  it('entries editor adds a country and deletes after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.entries = [{ year: 2026, iso: 'GR', artist: 'A1', song: 'S1', in_final: false }];
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Entries' }));
    await screen.findByDisplayValue('A1');

    const pick = screen.getByLabelText('Add country');
    // countries already entered are not offered
    expect(within(pick).queryByText('Greece')).toBeNull();
    fireEvent.change(pick, { target: { value: 'AT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('upsert_contest_entry', { p_year: 2026, p_iso: 'AT', p_fields: {} }),
    );

    fireEvent.click(within(screen.getByDisplayValue('A1').closest('tr')!).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('delete_contest_entry', { p_year: 2026, p_iso: 'GR' }),
    );
  });

  it('archived years are read-only', async () => {
    h.entries = [{ year: 2025, iso: 'AT', artist: 'JJ', song: 'Wasted Love', in_final: true, final_place: 1 }];
    render(<Contests />);
    fireEvent.click((await rowFor(2025)).getByRole('button', { name: 'Entries' }));
    expect(await screen.findByText('Edit + Republish arrives with publishing (2b)')).toBeTruthy();
    expect(screen.getByText('JJ')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByLabelText('Add country')).toBeNull();
  });

  it('shows RPC errors through formatError', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.summaries = [summary(2026, 'current', 26)];
    h.rpcError = { finalize_contest: { message: 'contest 2026 has no results; finalize refused', code: 'P0001' } };
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Finalize' }));
    expect(await screen.findByText('contest 2026 has no results; finalize refused · (P0001)')).toBeTruthy();
  });
});

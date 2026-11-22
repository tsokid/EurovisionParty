import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  rpcError: {} as Record<string, { message: string; code: string }>,
  summaries: [] as Row[],
  entries: [] as Row[],
  countries: [] as Row[],
  invoke: vi.fn(),
  loads: 0,
}));

vi.mock('../../src/lib/supabase', () => {
  const table = (name: string) => {
    const rows = () => {
      if (name === 'contest_entries') h.loads += 1;
      return name === 'contest_entries' ? h.entries : name === 'countries' ? h.countries : [];
    };
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      maybeSingle: () =>
        Promise.resolve({
          data: { city: 'City', city_slug: 'city', host_iso: null, semi1_date: null, semi2_date: null, final_date: null, indexable: false },
          error: null,
        }),
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
      functions: { invoke: (name: string, opts: unknown) => h.invoke(name, opts) },
    },
  };
});

import Contests from '../../src/admin/modules/Contests';
import { __resetPublishGuardForTests } from '../../src/admin/modules/contests/publish';

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
    h.invoke.mockReset();
    h.invoke.mockResolvedValue({ data: { status: 'noop', run_id: 1, sha: null, files_changed: 0 }, error: null });
    h.loads = 0;
    h.rpcError = {};
    h.summaries = [summary(2027, 'upcoming', 5), summary(2026, 'finalized', 26), summary(2025, 'archived', 26)];
    h.entries = [];
    h.countries = [
      { iso: 'AT', name_en: 'Austria' },
      { iso: 'GR', name_en: 'Greece' },
    ];
  });
  afterEach(() => {
    vi.restoreAllMocks();
    __resetPublishGuardForTests();
  });

  it('lists contests newest first with stage badges and only legal buttons', async () => {
    render(<Contests />);
    const r27 = await rowFor(2027);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('td')?.textContent)).toEqual(['2027', '2026', '2025']);
    expect(r27.getByText('επερχόμενος')).toBeTruthy();
    expect(r27.queryByRole('button', { name: 'Έναρξη' })).toBeNull(); // 2026 is live
    const r26 = await rowFor(2026);
    expect(r26.getByRole('button', { name: 'Αρχειοθέτηση' })).toBeTruthy();
    expect(r26.queryByRole('button', { name: 'Ολοκλήρωση' })).toBeNull();
  });

  it('Archive calls archive_contest only after confirm returns true, then reloads', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Contests />);
    const r26 = await rowFor(2026);

    fireEvent.click(r26.getByRole('button', { name: 'Αρχειοθέτηση' }));
    expect(confirm).toHaveBeenCalledWith(
      'Αρχειοθέτηση 2026: το 2026 κλειδώνει και η σελίδα του πηγαίνει στους παλιούς διαγωνισμούς (η παλιά διεύθυνση του 2026 ανακατευθύνεται εκεί). Τα παιχνίδια και ο επόμενος διαγωνισμός δεν επηρεάζονται. Αναιρείται με «Επαναφορά από αρχείο» όσο δεν έχει ξεκινήσει άλλος διαγωνισμός.',
    );
    expect(h.rpc).not.toHaveBeenCalledWith('archive_contest', expect.anything());

    confirm.mockReturnValue(true);
    const before = h.rpc.mock.calls.filter(([n]) => n === 'contest_summaries').length;
    fireEvent.click(r26.getByRole('button', { name: 'Αρχειοθέτηση' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('archive_contest', { p_year: 2026 }));
    await waitFor(() =>
      expect(h.rpc.mock.calls.filter(([n]) => n === 'contest_summaries').length).toBe(before + 1),
    );
  });

  it('Un-archive is offered on the latest archived year while nothing is live', async () => {
    h.summaries = [summary(2027, 'upcoming', 0), summary(2026, 'archived', 26)];
    render(<Contests />);
    const r26 = await rowFor(2026);
    expect(await r26.findByRole('button', { name: 'Επαναφορά από αρχείο' })).toBeTruthy();
    expect(h.rpc).not.toHaveBeenCalledWith('contest_has_rooms', expect.anything());
  });

  it('Create year sends the form to create_contest', async () => {
    render(<Contests />);
    await rowFor(2027);
    fireEvent.click(screen.getByRole('button', { name: 'Νέα χρονιά' }));
    const set = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    set('Χρονιά', '2028');
    set('Πόλη', 'Lisbon');
    set('Slug', 'lisbon');
    set('ISO διοργανώτριας', 'pt');
    set('Ημιτελικός 1', '2028-05-09');
    set('Ημιτελικός 2', '2028-05-11');
    set('Τελικός', '2028-05-13');
    fireEvent.click(screen.getByRole('button', { name: 'Δημιουργία' }));
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
    fireEvent.click(r26.getByRole('button', { name: 'Επεξεργασία' }));
    const artist = await screen.findByDisplayValue('A1');
    const entry = within(artist.closest('tr')!);
    expect(entry.getByText('Greece')).toBeTruthy();
    fireEvent.change(artist, { target: { value: 'New Artist' } });
    fireEvent.change(entry.getByLabelText('Θέση τελικού GR'), { target: { value: '4' } });
    fireEvent.click(entry.getByLabelText('Στον τελικό GR'));
    fireEvent.click(entry.getByRole('button', { name: 'Αποθήκευση' }));
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
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Επεξεργασία' }));
    fireEvent.change(await screen.findByDisplayValue('A1'), { target: { value: 'A1 edited' } });
    fireEvent.change(screen.getByDisplayValue('B1'), { target: { value: 'B1 edited' } });
    fireEvent.click(within(screen.getByDisplayValue('A1 edited').closest('tr')!).getByRole('button', { name: 'Αποθήκευση' }));
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
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Επεξεργασία' }));
    await screen.findByDisplayValue('A1');

    const pick = screen.getByLabelText('Προσθήκη χώρας');
    // countries already entered are not offered
    expect(within(pick).queryByText('Greece')).toBeNull();
    fireEvent.change(pick, { target: { value: 'AT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Προσθήκη' }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('upsert_contest_entry', { p_year: 2026, p_iso: 'AT', p_fields: {} }),
    );

    fireEvent.click(within(screen.getByDisplayValue('A1').closest('tr')!).getByRole('button', { name: 'Διαγραφή' }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('delete_contest_entry', { p_year: 2026, p_iso: 'GR' }),
    );
  });

  it('archived years are editable, with a banner that edits go live after Publish', async () => {
    h.entries = [{ year: 2025, iso: 'AT', artist: 'JJ', song: 'Wasted Love', in_final: true, final_place: 1 }];
    render(<Contests />);
    fireEvent.click((await rowFor(2025)).getByRole('button', { name: 'Επεξεργασία' }));
    expect(await screen.findByText('Οι αλλαγές σε χρονιά του αρχείου φαίνονται στο site μετά τη «Δημοσίευση».')).toBeTruthy();
    const artist = await screen.findByDisplayValue('JJ');
    fireEvent.change(artist, { target: { value: 'JJ (AT)' } });
    fireEvent.click(within(artist.closest('tr')!).getByRole('button', { name: 'Αποθήκευση' }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('upsert_contest_entry', { p_year: 2025, p_iso: 'AT', p_fields: { artist: 'JJ (AT)' } }),
    );
    expect(screen.getByLabelText('Προσθήκη χώρας')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ανάγνωση ημιτελικών' })).toBeNull();
  });

  it('non-archived years show no archive banner', async () => {
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Επεξεργασία' }));
    await screen.findByText('Συμμετοχές 2026');
    expect(screen.queryByText('Οι αλλαγές σε χρονιά του αρχείου φαίνονται στο site μετά τη «Δημοσίευση».')).toBeNull();
  });

  it('the selected year shows its details form', async () => {
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Επεξεργασία' }));
    expect(await screen.findByText('Στοιχεία 2026')).toBeTruthy();
  });

  it('the publish bar sits at the top of the module', async () => {
    render(<Contests />);
    expect(await screen.findByRole('button', { name: 'Δημοσίευση' })).toBeTruthy();
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('unpublished_summary', undefined));
    expect(h.rpc).toHaveBeenCalledWith('last_publish_run', undefined);
  });

  it.each([
    ['Αρχειοθέτηση', 'archive_contest', [summary(2027, 'upcoming', 5), summary(2026, 'finalized', 26)], 2026],
    ['Ολοκλήρωση', 'finalize_contest', [summary(2026, 'current', 26)], 2026],
    ['Επαναφορά από αρχείο', 'unarchive_contest', [summary(2027, 'upcoming', 5), summary(2026, 'archived', 26)], 2026],
  ])('%s publishes automatically after it succeeds', async (label, rpc, rows, year) => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.summaries = rows as Row[];
    h.invoke.mockResolvedValue({ data: { status: 'ok', run_id: 2, sha: 'abc1234ffff', files_changed: 3 }, error: null });
    render(<Contests />);
    fireEvent.click(await (await rowFor(year)).findByRole('button', { name: label }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith(rpc, { p_year: year }));
    // Contests only (I3): CMS page drafts ship only from an explicit Publish click.
    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith('publish-content', { body: { cms: false } }));
    expect(await screen.findByText(/Δημοσιεύτηκε: άλλαξαν 3 αρχεία/)).toBeTruthy();
    const order = h.rpc.mock.invocationCallOrder[h.rpc.mock.calls.findIndex(([n]) => n === rpc)];
    expect(h.invoke.mock.invocationCallOrder[0]).toBeGreaterThan(order);
  });

  it('a failed auto-publish keeps the lifecycle change, shows the error and leaves Publish available', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => ({ status: 'error', run_id: 4, sha: null, files_changed: 0, error: 'GitHub 401: Bad credentials' }) },
      },
    });
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Αρχειοθέτηση' }));
    expect(await screen.findByText('Αρχειοθέτηση 2026: έγινε.')).toBeTruthy();
    expect(await screen.findByText('Η δημοσίευση απέτυχε: GitHub 401: Bad credentials')).toBeTruthy();
    expect(h.rpc).not.toHaveBeenCalledWith('unarchive_contest', expect.anything());
    expect((screen.getByRole('button', { name: 'Δημοσίευση' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('a busy auto-publish keeps the lifecycle change and asks to try again', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => ({ status: 'busy', run_id: null, sha: null, files_changed: 0, error: 'publish already running' }) },
      },
    });
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Αρχειοθέτηση' }));
    expect(await screen.findByText('Αρχειοθέτηση 2026: έγινε.')).toBeTruthy();
    expect(await screen.findByText('Τρέχει ήδη άλλη δημοσίευση· δοκίμασε ξανά σε ένα λεπτό.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Δημοσίευση' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Publish followed by Archive: the auto-publish runs after the earlier publish, so it covers the archive', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const resolvers: Array<(v: unknown) => void> = [];
    h.invoke.mockImplementation(() => new Promise((r) => { resolvers.push(r); }));
    render(<Contests />);
    const r26 = await rowFor(2026);
    fireEvent.click(screen.getByRole('button', { name: 'Δημοσίευση' }));
    fireEvent.click(r26.getByRole('button', { name: 'Αρχειοθέτηση' }));
    expect(await screen.findByText('Αρχειοθέτηση 2026: έγινε.')).toBeTruthy();
    expect(h.invoke).toHaveBeenCalledTimes(1); // no parallel run
    resolvers[0]({ data: { status: 'noop', run_id: 1, sha: null, files_changed: 0 }, error: null });
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
    const archiveOrder = h.rpc.mock.invocationCallOrder[h.rpc.mock.calls.findIndex(([n]) => n === 'archive_contest')];
    expect(h.invoke.mock.invocationCallOrder[1]).toBeGreaterThan(archiveOrder);
    resolvers[1]({ data: { status: 'ok', run_id: 2, sha: 'abc1234ffff', files_changed: 3 }, error: null });
    expect(await screen.findByText(/Δημοσιεύτηκε: άλλαξαν 3 αρχεία/)).toBeTruthy();
    expect(screen.queryByText('Τίποτα για δημοσίευση: το site είναι ήδη ενημερωμένο.')).toBeNull();
    expect(h.invoke).toHaveBeenCalledTimes(2);
  });

  it('a refused lifecycle action does not publish', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.rpcError = { archive_contest: { message: 'contest 2027 has no entries; archive refused', code: 'P0001' } };
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Αρχειοθέτηση' }));
    expect(await screen.findByText('contest 2027 has no entries; archive refused · (P0001)')).toBeTruthy();
    expect(h.invoke).not.toHaveBeenCalledWith('publish-content', expect.anything());
  });

  it('shows RPC errors through formatError', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.summaries = [summary(2026, 'current', 26)];
    h.rpcError = { finalize_contest: { message: 'contest 2026 has no results; finalize refused', code: 'P0001' } };
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Ολοκλήρωση' }));
    expect(await screen.findByText('contest 2026 has no results; finalize refused · (P0001)')).toBeTruthy();
  });
  it('Parse semifinals is offered for current and finalized years only', async () => {
    h.summaries = [summary(2027, 'upcoming', 5), summary(2026, 'finalized', 26), summary(2025, 'archived', 26)];
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Επεξεργασία' }));
    expect(await screen.findByRole('button', { name: 'Ανάγνωση ημιτελικών' })).toBeTruthy();
    fireEvent.click((await rowFor(2027)).getByRole('button', { name: 'Επεξεργασία' }));
    await screen.findByText('Συμμετοχές 2027');
    expect(screen.queryByRole('button', { name: 'Ανάγνωση ημιτελικών' })).toBeNull();
    fireEvent.click((await rowFor(2025)).getByRole('button', { name: 'Επεξεργασία' }));
    await screen.findByText('Συμμετοχές 2025');
    expect(screen.queryByRole('button', { name: 'Ανάγνωση ημιτελικών' })).toBeNull();
  });

  it('Parse semifinals invokes the edge function after confirm, then reloads', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    h.summaries = [summary(2026, 'current', 26)];
    h.invoke.mockResolvedValue({ data: { ok: true, rows: 31, sf1: 15, sf2: 16 }, error: null });
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Επεξεργασία' }));
    const button = await screen.findByRole('button', { name: 'Ανάγνωση ημιτελικών' });

    fireEvent.click(button); // cancelled
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(h.invoke).not.toHaveBeenCalled();

    await waitFor(() => expect(h.loads).toBeGreaterThan(0));
    const loadsBefore = h.loads;
    fireEvent.click(button);
    await waitFor(() =>
      expect(h.invoke).toHaveBeenCalledWith('eurovision-parse', { body: { action: 'semis', year: 2026 } }),
    );
    expect(await screen.findByText('Οι ημιτελικοί διαβάστηκαν: γράφτηκαν 31 συμμετοχές.')).toBeTruthy();
    await waitFor(() => expect(h.loads).toBeGreaterThan(loadsBefore));
    expect(screen.queryByLabelText('Επικόλληση HTML σελίδας για τον 1ο ημιτελικό')).toBeNull();
  });

  it('a failed fetch offers the paste boxes and resends with the pasted HTML', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.summaries = [summary(2026, 'finalized', 26)];
    h.invoke
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { json: async () => ({ ok: false, error: 'semi-final 1: http 403 from https://x/; paste the page HTML instead' }) },
        },
      })
      .mockResolvedValueOnce({ data: { ok: true, rows: 15, sf1: 15 }, error: null });
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Επεξεργασία' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ανάγνωση ημιτελικών' }));

    expect(await screen.findByText('semi-final 1: http 403 from https://x/; paste the page HTML instead')).toBeTruthy();
    expect(
      screen.getByText(
        'Άνοιξε τη σελίδα του ημιτελικού στο eurovision.com, πάτα Ctrl+U (κώδικας σελίδας), μετά Ctrl+A και Ctrl+C, και επικόλλησε εδώ.',
      ),
    ).toBeTruthy();
    const resend = screen.getByRole('button', { name: 'Ανάγνωση του HTML' }) as HTMLButtonElement;
    expect(resend.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Επικόλληση HTML σελίδας για τον 1ο ημιτελικό'), { target: { value: '<html>sf1</html>' } });
    expect(resend.disabled).toBe(false);
    fireEvent.click(resend);

    await waitFor(() =>
      expect(h.invoke).toHaveBeenLastCalledWith('eurovision-parse', {
        body: { action: 'semis', year: 2026, html_sf1: '<html>sf1</html>' },
      }),
    );
    expect(await screen.findByText('Οι ημιτελικοί διαβάστηκαν: γράφτηκαν 15 συμμετοχές.')).toBeTruthy();
    expect(screen.queryByLabelText('Επικόλληση HTML σελίδας για τον 1ο ημιτελικό')).toBeNull();
  });

  it('a semis error without a response body still shows through formatError', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.summaries = [summary(2026, 'current', 26)];
    h.invoke.mockResolvedValue({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Επεξεργασία' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ανάγνωση ημιτελικών' }));
    expect(await screen.findByText('Failed to send a request to the Edge Function')).toBeTruthy();
    expect(screen.getByLabelText('Επικόλληση HTML σελίδας για τον 2ο ημιτελικό')).toBeTruthy();
  });
  it('notes a semi-final 2 that is not available yet', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.summaries = [summary(2026, 'current', 26)];
    h.invoke.mockResolvedValue({ data: { ok: true, rows: 15, sf1: 15, sf2: 'not available' }, error: null });
    render(<Contests />);
    fireEvent.click((await rowFor(2026)).getByRole('button', { name: 'Επεξεργασία' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ανάγνωση ημιτελικών' }));
    expect(
      await screen.findByText('Οι ημιτελικοί διαβάστηκαν: γράφτηκαν 15 συμμετοχές. Ο 2ος ημιτελικός δεν είναι ακόμη διαθέσιμος.'),
    ).toBeTruthy();
  });
});

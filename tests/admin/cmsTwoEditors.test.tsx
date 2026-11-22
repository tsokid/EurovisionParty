// Two browsers on one document (CMS P3 definition of done, owner Q1 = A):
// two real editors (the footer editor) rendered side by side, each signed in
// as a different admin, sharing one in-memory server with cms_save's
// optimistic concurrency and one mocked realtime hub (presence + "saved"
// broadcasts). Presence chips show who is where; disjoint edits rebase with
// a toast; the same field opens the dialog in the second editor.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ToastHost } from '../../src/admin/ui/kit';
import { AdminUserContext, CmsRealtimeContext, createMemoryHub, type Me } from '../../src/admin/cms/docChannel';

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }));

const server = vi.hoisted(() => ({
  row: null as null | { data: unknown; updated_at: string },
  n: 0,
}));
vi.mock('../../src/admin/modules/pages/cmsApi', () => ({
  cmsGet: async () => (server.row ? { doc_id: 'site-footer', doc_type: 'site-footer', ...JSON.parse(JSON.stringify(server.row)) } : null),
  cmsList: async () => [],
  cmsSave: async (_id: string, _type: string, data: unknown, expected: string | null) => {
    if ((server.row?.updated_at ?? null) !== expected) throw new Error('document changed by someone else; reload');
    server.row = { data: JSON.parse(JSON.stringify(data)), updated_at: `2026-11-22T12:00:00.${String(++server.n).padStart(3, '0')}Z` };
    return server.row.updated_at;
  },
  cmsDiscard: async () => { server.row = null; },
  isConflict: (e: unknown) => String((e as Error).message).includes('changed by someone else'),
}));
vi.mock('../../src/admin/modules/contests/publish', () => ({
  usePublisher: () => ({ publish: vi.fn(), publishing: false, outcome: null, summary: { changed_years: [], changed_docs: [], since: null } }),
  outcomeText: () => '',
}));

import FooterEditor from '../../src/admin/modules/site/FooterEditor';

type Doc = { en: { columns: Array<{ links: Array<{ label: string }> }> }; el: { columns: Array<{ links: Array<{ label: string }> }> } };
const OWNER: Me = { userId: 'u-owner', email: 'owner@example.com', tab: 'tab-owner' };
const ELENA: Me = { userId: 'u-elena', email: 'elena@example.com', tab: 'tab-elena' };

function twoBrowsers() {
  const hub = createMemoryHub();
  const browser = (me: Me, id: string): ReactNode => (
    <div data-testid={id}>
      <AdminUserContext.Provider value={me}>
        <CmsRealtimeContext.Provider value={hub.factory}>
          <FooterEditor column="about" />
        </CmsRealtimeContext.Provider>
      </AdminUserContext.Provider>
    </div>
  );
  render(
    <MemoryRouter>
      <ToastHost>
        {browser(OWNER, 'owner')}
        {browser(ELENA, 'elena')}
      </ToastHost>
    </MemoryRouter>,
  );
  const inBrowser = (id: string) => within(screen.getByTestId(id));
  const en = (id: string) => inBrowser(id).getAllByRole('textbox', { name: 'Κείμενο · English' }) as HTMLInputElement[];
  const el = (id: string) => inBrowser(id).getAllByRole('textbox', { name: 'Κείμενο · Ελληνικά' }) as HTMLInputElement[];
  return { hub, inBrowser, en, el };
}

const saved = () => server.row?.data as Doc;

beforeEach(() => {
  server.row = null;
  server.n = 0;
  localStorage.clear();
});

describe('two editors on the footer', () => {
  it('each sees the other as a presence chip, with the field they are in', async () => {
    const b = twoBrowsers();
    await waitFor(() => expect(b.inBrowser('owner').getByTestId('presence').textContent).toMatch(/elena/));
    expect(b.inBrowser('elena').getByTestId('presence').textContent).toMatch(/owner/);
    act(() => { fireEvent.focus(b.el('elena')[0]); });
    await waitFor(() => expect(b.inBrowser('owner').getByTestId('presence').textContent).toMatch(/επεξεργάζεται: Κείμενο · Ελληνικά/));
  });

  it('disjoint fields: the second editor is rebased silently (toast), and both edits end up saved', async () => {
    const b = twoBrowsers();
    await waitFor(() => expect(b.inBrowser('owner').getByTestId('autosave-pill')).toBeTruthy());
    await waitFor(() => expect(b.inBrowser('elena').getByTestId('autosave-pill')).toBeTruthy());
    // Elena types in EL first (not saved yet); the owner changes EN and leaves the field.
    fireEvent.change(b.el('elena')[0], { target: { value: 'Τι είναι το Eurovision Games;' } });
    fireEvent.change(b.en('owner')[0], { target: { value: 'About us' } });
    fireEvent.focusOut(b.en('owner')[0]);
    await waitFor(() => expect(saved()?.en.columns[0].links[0].label).toBe('About us'));
    // Elena's editor merged it in, kept her own edit, and said so.
    await waitFor(() => expect(b.en('elena')[0].value).toBe('About us'));
    expect(b.el('elena')[0].value).toBe('Τι είναι το Eurovision Games;');
    expect(await screen.findByText('Νέες αλλαγές από owner: ενώθηκαν με τις δικές σας.')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.focusOut(b.el('elena')[0]);
    await waitFor(() => expect(saved()?.el.columns[0].links[0].label).toBe('Τι είναι το Eurovision Games;'));
    expect(saved().en.columns[0].links[0].label).toBe('About us');
    // And the owner caught up with Elena's save.
    await waitFor(() => expect(b.el('owner')[0].value).toBe('Τι είναι το Eurovision Games;'));
  });

  it('the same field: the second editor gets the dialog with both values, and their choice is saved', async () => {
    const b = twoBrowsers();
    await waitFor(() => expect(b.inBrowser('elena').getByTestId('autosave-pill')).toBeTruthy());
    fireEvent.change(b.en('elena')[0], { target: { value: 'About Eurovision Games' } });
    fireEvent.change(b.en('owner')[0], { target: { value: 'About us' } });
    fireEvent.focusOut(b.en('owner')[0]);
    const dialog = await screen.findByRole('alertdialog', { name: 'Το ίδιο πεδίο άλλαξε και από τις δύο πλευρές' });
    expect(within(dialog).getByText('About Eurovision Games')).toBeTruthy();
    expect(within(dialog).getByText('About us')).toBeTruthy();
    expect(within(dialog).getByText('Εκδοχή από owner')).toBeTruthy();
    expect(b.inBrowser('elena').getByTestId('autosave-pill').getAttribute('data-status')).toBe('conflict');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Κράτα τη δική μου' }));
    await waitFor(() => expect(saved()?.en.columns[0].links[0].label).toBe('About Eurovision Games'));
    await waitFor(() => expect(b.en('owner')[0].value).toBe('About Eurovision Games'));
  });
});

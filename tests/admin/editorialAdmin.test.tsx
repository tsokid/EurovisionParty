// CMS 3c Task 6, admin side: the editorial docs of the data pages in the
// Pages module (Contest years, Countries, Live hub; "Add editorial for …"),
// the preview of an editorial draft on its data page, and the Contests
// "Editorial: none / text / text + image" indicator with its link.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { bundledContent } from '../../src/lib/seo/contentData';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';

type Row = { doc_id: string; doc_type: string; updated_at: string; published: boolean };

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  list: [] as Array<{ doc_id: string; doc_type: string; updated_at: string; published: boolean }>,
  drafts: {} as Record<string, { doc_id: string; doc_type: string; data: unknown; updated_at: string }>,
  index: { editorial: [] as string[] } as unknown,
  published: {} as Record<string, unknown>,
  contest: null as Record<string, unknown> | null,
}));

const CONTESTS = [
  { year: 2005, city: 'Kyiv', city_slug: 'kyiv', host_iso: 'UA', stage: 'archived', final_date: null, indexable: false, entry_count: 39 },
  { year: 2004, city: 'Istanbul', city_slug: 'istanbul', host_iso: 'TR', stage: 'archived', final_date: null, indexable: false, entry_count: 36 },
  { year: 2026, city: 'Vienna', city_slug: 'vienna', host_iso: 'AT', stage: 'current', final_date: null, indexable: true, entry_count: 35 },
];
const COUNTRIES = [
  { iso: 'GR', name_en: 'Greece', slug: 'greece' },
  { iso: 'AD', name_en: 'Andorra', slug: 'andorra' },
];

vi.mock('../../src/lib/supabase', () => {
  const table = (name: string) => {
    const rows = () => (name === 'countries' ? COUNTRIES : name === 'contests' && h.contest ? [h.contest] : []);
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(ok, bad),
    };
    return chain;
  };
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      from: (name: string) => table(name),
      rpc: (name: string, args?: Record<string, unknown>) => {
        h.rpc(name, args);
        const ok = (data: unknown) => Promise.resolve({ data, error: null });
        switch (name) {
          case 'cms_list': return ok(h.list);
          case 'cms_get': return ok(h.drafts[String(args?.p_doc_id)] ?? null);
          case 'cms_save': return ok('2026-10-31T12:00:00.001+00:00');
          case 'contest_summaries': return ok(CONTESTS);
          case 'unpublished_summary': return ok({ changed_years: [], changed_docs: [], since: null });
          default: return ok(null);
        }
      },
      functions: { invoke: vi.fn() },
    },
  };
});

import Pages from '../../src/admin/modules/Pages';
import PreviewPane from '../../src/admin/modules/pages/PreviewPane';
import { ContestDetailsForm } from '../../src/admin/modules/contests/ContestDetailsForm';
import { AdminNavContext, type AdminNav } from '../../src/admin/adminNav';
import { __resetPublishedPagesForTests } from '../../src/admin/modules/pages/cmsApi';
import { __resetPublishGuardForTests } from '../../src/admin/modules/contests/publish';
import {
  editorialLevel, editorialTargets, editorialTitle, emptyEditorialDoc,
} from '../../src/admin/modules/pages/editorialPages';

vi.setConfig({ testTimeout: 15_000 });

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  h.rpc.mockClear();
  h.list = [];
  h.drafts = {};
  h.index = { editorial: [] };
  h.published = {};
  h.contest = null;
  __resetPublishedPagesForTests();
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/content/pages/index.json') return json(h.index);
    const m = /^\/content\/(.+)$/.exec(url);
    const path = m?.[1] ?? '';
    const page = /^pages\/([a-z0-9-]+)\.json$/.exec(path)?.[1];
    const body = page && page in h.published ? h.published[page] : bundledContent(path);
    return body === undefined ? new Response('not found', { status: 404 }) : json(body);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  __resetPublishGuardForTests();
});

const editorial = (extra: Record<string, unknown> = {}) => ({ intro: '', blocks: [], ...extra });
const IMG = { media: '/media/0123456789ab.webp', alt: 'Stage', width: 1600, height: 900 };

describe('editorialPages', () => {
  it('targets: every year (newest first), every country (by name), a hub per year not archived', () => {
    const t = editorialTargets({ contests: CONTESTS, countries: COUNTRIES });
    expect(t.map((x) => [x.docId, x.label, x.path])).toEqual([
      ['archive-2026', '2026 · Vienna', '/past-contests/eurovision-2026-vienna'],
      ['archive-2005', '2005 · Kyiv', '/past-contests/eurovision-2005-kyiv'],
      ['archive-2004', '2004 · Istanbul', '/past-contests/eurovision-2004-istanbul'],
      ['country-ad', 'Andorra', '/countries/andorra'],
      ['country-gr', 'Greece', '/countries/greece'],
      ['hub-2026', '2026 · Vienna', '/eurovision-2026'],
    ]);
    expect(editorialTitle('archive-2005', t)).toBe('Contest year 2005 · Kyiv');
    expect(editorialTitle('country-gr', t)).toBe('Country Greece');
    expect(editorialTitle('hub-2031', t)).toBe('Live hub hub-2031');
  });

  it('a new editorial doc (empty intro, no blocks, both locales) validates', () => {
    const doc = emptyEditorialDoc();
    expect(doc).toEqual({ en: { intro: '', blocks: [] }, el: { intro: '', blocks: [] } });
    expect(validateDocument('archive-editorial', doc).ok).toBe(true);
  });

  it('level: text is a non-empty intro or a block; image is a set image', () => {
    expect(editorialLevel(null)).toBe('none');
    expect(editorialLevel({ en: editorial(), el: editorial() })).toBe('none');
    expect(editorialLevel({ en: editorial({ intro: '  ' }), el: editorial() })).toBe('none');
    expect(editorialLevel({ en: editorial({ intro: 'Hi' }), el: editorial() })).toBe('text');
    expect(editorialLevel({ en: editorial({ blocks: [{ type: 'text', body: 'x' }] }), el: editorial() })).toBe('text');
    expect(editorialLevel({ en: editorial({ image: IMG }), el: editorial({ image: IMG }) })).toBe('image');
    expect(editorialLevel({ en: editorial({ intro: 'Hi', image: IMG }), el: editorial() })).toBe('text + image');
    expect(editorialLevel({ en: editorial({ intro: 'Hi', image: { ...IMG, media: '' } }), el: editorial() })).toBe('text');
  });
});

describe('Pages module: editorial groups', () => {
  it('shows Contest years, Countries and Live hub with the docs that exist (draft or published)', async () => {
    h.list = [{ doc_id: 'archive-2005', doc_type: 'archive-editorial', updated_at: '2026-10-30T09:15:00Z', published: false }] satisfies Row[];
    h.index = { editorial: ['hub-2026'] };
    render(<Pages />);
    const years = await screen.findByRole('table', { name: 'Contest years' });
    expect(within(years).getByRole('row', { name: /2005 · Kyiv/ })).toBeTruthy();
    expect(within(years).getByText('Draft (unpublished)')).toBeTruthy();
    const hub = screen.getByRole('table', { name: 'Live hub' });
    expect(within(hub).getByRole('row', { name: /2026 · Vienna/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Countries' })).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Countries' })).toBeNull();
    // The selects offer only the pages without a doc.
    const yearSelect = screen.getByRole('combobox', { name: 'Add editorial for a year' });
    expect([...yearSelect.querySelectorAll('option')].map((o) => o.value)).toEqual(['', 'archive-2026', 'archive-2004']);
    const countrySelect = screen.getByRole('combobox', { name: 'Add editorial for a country' });
    expect([...countrySelect.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Add editorial for …', 'Andorra', 'Greece']);
    expect(screen.queryByRole('combobox', { name: 'Add editorial for a live hub' })).toBeNull();
  });

  it('"Add editorial for …" saves a new draft from the empty value through cms_save, then opens it', async () => {
    render(<Pages />);
    const select = await screen.findByRole('combobox', { name: 'Add editorial for a country' });
    fireEvent.change(select, { target: { value: 'country-gr' } });
    h.drafts['country-gr'] = { doc_id: 'country-gr', doc_type: 'country-editorial', data: emptyEditorialDoc(), updated_at: '2026-10-31T12:00:00.001+00:00' };
    fireEvent.click(within(select.parentElement!).getByRole('button', { name: 'Add' }));
    await screen.findByRole('button', { name: 'Save draft' });
    expect(h.rpc.mock.calls.filter(([n]) => n === 'cms_save').map(([, a]) => a)).toEqual([{
      p_doc_id: 'country-gr',
      p_doc_type: 'country-editorial',
      p_data: { en: { intro: '', blocks: [] }, el: { intro: '', blocks: [] } },
      p_expected_updated_at: null,
    }]);
    expect(screen.getByRole('heading', { name: 'Country Greece' })).toBeTruthy();
  });

  it('a pending doc from another module opens its editor; one never saved nor published starts empty', async () => {
    const nav: AdminNav = { openDoc: vi.fn(), pendingDoc: 'archive-2004', clearPendingDoc: vi.fn() };
    render(<AdminNavContext.Provider value={nav}><Pages /></AdminNavContext.Provider>);
    expect(await screen.findByText('New: not saved yet')).toBeTruthy();
    expect(nav.clearPendingDoc).toHaveBeenCalled();
    expect(fetchSpy.mock.calls.map(([u]) => String(u))).not.toContain('/content/pages/archive-2004.json');
    expect(await screen.findByRole('heading', { name: 'Contest year 2004 · Istanbul' })).toBeTruthy();
  });

  it('the editor checks an editorial metaDescription against the published pages (I2)', async () => {
    const faq = bundledContent('pages/faq.json') as { en: { meta: { description: string } } };
    h.drafts['archive-2005'] = {
      doc_id: 'archive-2005', doc_type: 'archive-editorial', updated_at: '2026-10-30T09:15:00Z',
      data: { en: editorial({ intro: 'Hi', metaDescription: faq.en.meta.description }), el: editorial({ intro: 'Γεια' }) },
    };
    const nav: AdminNav = { openDoc: vi.fn(), pendingDoc: 'archive-2005', clearPendingDoc: vi.fn() };
    render(<AdminNavContext.Provider value={nav}><Pages /></AdminNavContext.Provider>);
    expect(await screen.findByText(/Same meta description as "faq"/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('PreviewPane: editorial on its data page', () => {
  function inAdmin(ui: React.ReactNode) {
    const router = createMemoryRouter([{ path: '/admin', element: <div>{ui}</div> }], { initialEntries: ['/admin'] });
    return render(<RouterProvider router={router} />);
  }

  it('renders the archive year page at its path with the draft intro', async () => {
    const doc = { en: editorial({ intro: 'Draft intro for Kyiv ZQX' }), el: editorial({ intro: 'Πρόχειρο ΖΘΞ' }) };
    inAdmin(<PreviewPane docId="archive-2005" doc={doc} path="/past-contests/eurovision-2005-kyiv" />);
    expect(await screen.findByText('Draft intro for Kyiv ZQX')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes('archive-2005'))).toBe(false);
  });

  it('renders the country page too, and says so when there is no path', async () => {
    const doc = { en: editorial({ intro: 'Greek draft ABC' }), el: editorial() };
    const { unmount } = inAdmin(<PreviewPane docId="country-gr" doc={doc} path="/countries/greece" />);
    expect(await screen.findByText('Greek draft ABC')).toBeInTheDocument();
    unmount();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    inAdmin(<PreviewPane docId="country-gr" doc={doc} />);
    expect(screen.getByRole('alert').textContent).toMatch(/no page to preview for "country-gr"/);
  });
});

describe('ContestDetailsForm: editorial indicator', () => {
  const NAV = () => ({ openDoc: vi.fn(), pendingDoc: null, clearPendingDoc: vi.fn() }) satisfies AdminNav;
  const show = (nav: AdminNav = NAV()) => {
    h.contest = { year: 2005, city: 'Kyiv', city_slug: 'kyiv', host_iso: 'UA', semi1_date: null, semi2_date: null, final_date: null, indexable: false, stage: 'archived' };
    render(<AdminNavContext.Provider value={nav}><ContestDetailsForm year={2005} /></AdminNavContext.Provider>);
    return nav;
  };

  it('none: no draft and not published; the link opens archive-{year}', async () => {
    const nav = show();
    await waitFor(() => expect(screen.getByTestId('editorial-level').textContent).toBe('Editorial: none'));
    fireEvent.click(screen.getByRole('button', { name: /Add editorial/ }));
    expect(nav.openDoc).toHaveBeenCalledWith('archive-2005');
  });

  it('text: from the draft when there is one (the published doc is not read)', async () => {
    h.drafts['archive-2005'] = { doc_id: 'archive-2005', doc_type: 'archive-editorial', data: { en: editorial({ intro: 'Hi' }), el: editorial() }, updated_at: 'x' };
    h.index = { editorial: ['archive-2005'] };
    h.published['archive-2005'] = { en: editorial({ intro: 'Hi', image: IMG }), el: editorial() };
    show();
    await waitFor(() => expect(screen.getByTestId('editorial-level').textContent).toBe('Editorial: text'));
    expect(screen.getByRole('button', { name: /Edit editorial/ })).toBeTruthy();
  });

  it('text + image: from the published doc when there is no draft', async () => {
    h.index = { editorial: ['archive-2005'] };
    h.published['archive-2005'] = { en: editorial({ blocks: [{ type: 'text', body: 'x' }], image: IMG }), el: editorial({ image: IMG }) };
    show();
    await waitFor(() => expect(screen.getByTestId('editorial-level').textContent).toBe('Editorial: text + image'));
  });

  it('only informs: the indexable switch is unchanged by it', async () => {
    h.index = { editorial: ['archive-2005'] };
    h.published['archive-2005'] = { en: editorial({ intro: 'Hi', image: IMG }), el: editorial() };
    show();
    await waitFor(() => expect(screen.getByTestId('editorial-level').textContent).toBe('Editorial: text + image'));
    expect((screen.getByRole('checkbox', { name: 'Indexable' }) as HTMLInputElement).checked).toBe(false);
    expect(h.rpc.mock.calls.filter(([n]) => n === 'update_contest')).toEqual([]);
  });
});

// The Pages module: the list of CMS pages, and the page editor with
// autosave (CMS P3): debounced and on-blur saves against cms_save's
// optimistic concurrency, the status pill, invalid drafts kept local, a
// refused save merged with the other editor's version (or the conflict
// dialog), discard, the leave guard, and the unsent-draft buffer.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { bundledContent } from '../../src/lib/seo/contentData';

type Doc = { en: Record<string, unknown>; el: Record<string, unknown> };
type Row = { doc_id: string; doc_type: string; updated_at: string; published: boolean };

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  list: [] as Array<{ doc_id: string; doc_type: string; updated_at: string; published: boolean }>,
  drafts: {} as Record<string, { doc_id: string; doc_type: string; data: unknown; updated_at: string }>,
  saveError: null as { message: string } | null,
  stamp: 0,
  summary: { changed_years: [] as number[], changed_docs: [] as string[], since: '2026-10-29T10:00:00Z' as string | null },
  invoke: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    rpc: (name: string, args?: Record<string, unknown>) => {
      h.rpc(name, args);
      const ok = (data: unknown) => Promise.resolve({ data, error: null });
      switch (name) {
        case 'cms_list':
          return ok(h.list);
        case 'cms_get':
          return ok(h.drafts[String(args?.p_doc_id)] ?? null);
        case 'cms_save': {
          if (h.saveError) return Promise.resolve({ data: null, error: h.saveError });
          const id = String(args?.p_doc_id);
          if ((h.drafts[id]?.updated_at ?? null) !== (args?.p_expected_updated_at ?? null)) {
            return Promise.resolve({ data: null, error: { message: 'document changed by someone else; reload' } });
          }
          const at = `2026-10-31T12:00:00.${String(++h.stamp).padStart(3, '0')}+00:00`;
          h.drafts[id] = { doc_id: id, doc_type: String(args?.p_doc_type), data: JSON.parse(JSON.stringify(args?.p_data)), updated_at: at };
          return ok(at);
        }
        case 'cms_discard':
          delete h.drafts[String(args?.p_doc_id)];
          return ok(null);
        case 'unpublished_summary':
          return ok(h.summary);
        case 'last_publish_run':
          return ok(null);
        default:
          return ok(null);
      }
    },
    functions: { invoke: (name: string, opts: unknown) => h.invoke(name, opts) },
  },
}));

import Pages from '../../src/admin/modules/Pages';
import { PUBLISH_PAGES_TEXT } from '../../src/admin/modules/pages/sitePages';
import { __resetPublishGuardForTests } from '../../src/admin/modules/contests/publish';
import { UNSAVED_TEXT } from '../../src/admin/unsavedGuard';
import { __resetPublishedPagesForTests } from '../../src/admin/modules/pages/cmsApi';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const published = (docId: string) => clone(bundledContent(`pages/${docId}.json`) as Doc);
const DRAFT_TIME = '2026-10-30T09:15:00.123+00:00';

let fetchSpy: ReturnType<typeof vi.spyOn>;

function mockPublishedFetch() {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const m = /\/content\/(pages\/[a-z0-9-]+\.json)$/.exec(url);
    const body = m ? bundledContent(m[1]) : undefined;
    if (!body) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
}

const pageFetches = () => fetchSpy.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/content/pages/'));
/** Fetches of one page's published file (the other site pages are read once for the SEO uniqueness check). */
const fetchesOf = (docId: string) => pageFetches().filter((u) => u === `/content/pages/${docId}.json`);
const rpcCalls = (name: string) => h.rpc.mock.calls.filter(([n]) => n === name);
const saves = () => rpcCalls('cms_save').map(([, a]) => a as { p_data: Doc; p_expected_updated_at: string | null });
const pill = () => screen.getByTestId('autosave-pill');

async function openEditor(label = 'Σχετικά') {
  render(<Pages />);
  const row = await screen.findByRole('row', { name: new RegExp(`^${label}`) });
  fireEvent.click(within(row).getByRole('button', { name: 'Επεξεργασία' }));
  return screen.findByTestId('autosave-pill');
}

/** A form control by its label text (getByLabelText is very slow in jsdom on a form this size). */
function control(name: string): HTMLInputElement {
  const label = [...document.querySelectorAll('label[for]')].find((l) => l.textContent === name);
  const el = label && document.getElementById(label.getAttribute('for')!);
  if (!el) throw new Error(`no control labelled ${name}`);
  return el as HTMLInputElement;
}
const homeBreadcrumbEn = () => control('Breadcrumbs › Home (EN)');

/** Types into a field and leaves it: the blur saves at once. */
function type(el: HTMLInputElement, value: string) {
  fireEvent.focus(el);
  fireEvent.change(el, { target: { value } });
  fireEvent.focusOut(el);
}

beforeEach(() => {
  h.rpc.mockClear();
  h.invoke.mockReset();
  h.list = [];
  h.drafts = {};
  h.saveError = null;
  h.stamp = 0;
  h.summary = { changed_years: [], changed_docs: [], since: '2026-10-29T10:00:00Z' };
  localStorage.clear();
  mockPublishedFetch();
  __resetPublishedPagesForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  __resetPublishGuardForTests();
});

// Per-file timeout: these tests render whole page forms and time out at the 5 s default under full-suite load.
vi.setConfig({ testTimeout: 15_000 });

describe('Pages module: test setup', () => {
  it('gives every test in this file 15 s', ({ task }) => {
    expect(task.timeout).toBe(15_000);
  });
});

describe('Pages module: list', () => {
  it('lists every site page with its state badge, in Greek', async () => {
    h.list = [
      { doc_id: 'about', doc_type: 'about', updated_at: DRAFT_TIME, published: false },
      { doc_id: 'faq', doc_type: 'faq', updated_at: DRAFT_TIME, published: true },
    ] satisfies Row[];
    render(<Pages />);
    const about = await screen.findByRole('row', { name: /^Σχετικά/ });
    expect(within(about).getByText('Πρόχειρο, χωρίς δημοσίευση')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /^Συχνές ερωτήσεις/ })).getByText('Δημοσιευμένο')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /^Κανόνες/ })).getByText('Χωρίς αλλαγές')).toBeTruthy();
    // All 18 site docs, one row each (plus the header row); the doc ids stay as they are.
    expect(screen.getAllByRole('row')).toHaveLength(18 + 1);
    expect(within(about).getByText('about')).toBeTruthy();
  });

  it('explains what Publish does with the drafts (I3)', async () => {
    render(<Pages />);
    expect(await screen.findByText(PUBLISH_PAGES_TEXT)).toBeTruthy();
    expect(PUBLISH_PAGES_TEXT).toMatch(/2 λεπτά/);
    expect(PUBLISH_PAGES_TEXT).toMatch(/μένει εδώ/);
  });

  it('the publish bar counts changed pages', async () => {
    h.summary = { changed_years: [2026], changed_docs: ['about', 'faq'], since: '2026-10-29T10:00:00Z' };
    render(<Pages />);
    expect(await screen.findByText('3 αλλαγές για δημοσίευση: 1 χρονιά (2026), 2 σελίδες (about, faq)')).toBeTruthy();
  });
});

describe('Pages module: editor', () => {
  it('loads the published version when there is no draft, and shows the form, the preview and «Αποθηκεύτηκε»', async () => {
    await openEditor();
    expect(rpcCalls('cms_get')[0][1]).toEqual({ p_doc_id: 'about' });
    expect(fetchesOf('about')).toEqual(['/content/pages/about.json']);
    expect(screen.getByText('Ίδιο με το site')).toBeTruthy();
    expect(homeBreadcrumbEn().value).toBe((published('about').en.breadcrumbs as Record<string, string>).home);
    expect(screen.getByTestId('preview-pane')).toBeTruthy();
    expect(pill().textContent).toBe('Αποθηκεύτηκε');
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Απόρριψη προχείρου' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Ιστορικό' }).getAttribute('href')).toBe('/admin/pages/about/history');
  });

  it('loads the saved draft when there is one, without fetching the published file', async () => {
    const doc = published('about');
    (doc.en.hero as Record<string, unknown>).title = 'Draft hero from DB';
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: doc, updated_at: DRAFT_TIME };
    await openEditor();
    expect(screen.getByText(/^Πρόχειρο, αποθήκευση \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)).toBeTruthy();
    expect(fetchesOf('about')).toEqual([]);
    expect(within(screen.getByTestId('preview-pane')).getByText('Draft hero from DB')).toBeTruthy();
  });

  it('typing updates the preview (debounced) and autosaves 1.5 s after the last keystroke', async () => {
    await openEditor();
    const title = control('Hero › Title (EN)');
    fireEvent.change(title, { target: { value: 'Live typed hero title' } });
    expect(pill().textContent).toBe('Αποθήκευση…');
    expect(saves()).toHaveLength(0);
    const pane = screen.getByTestId('preview-pane');
    expect(within(pane).queryByText('Live typed hero title')).toBeNull();
    expect(await within(pane).findByText('Live typed hero title')).toBeTruthy();
    await waitFor(() => expect(saves()).toHaveLength(1), { timeout: 4000 });
    expect(saves()[0]).toMatchObject({ p_expected_updated_at: null });
    expect(((saves()[0].p_data.en.hero as Record<string, unknown>).title)).toBe('Live typed hero title');
    await waitFor(() => expect(pill().textContent).toMatch(/^Αποθηκεύτηκε \d{2}:\d{2}$/));
  });

  it('leaving a field saves at once, then the next save is against the new timestamp', async () => {
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: published('about'), updated_at: DRAFT_TIME };
    await openEditor();
    type(homeBreadcrumbEn(), 'Home!');
    await waitFor(() => expect(saves()).toHaveLength(1));
    expect(saves()[0]).toMatchObject({ p_expected_updated_at: DRAFT_TIME });
    expect((saves()[0].p_data.en.breadcrumbs as Record<string, string>).home).toBe('Home!');
    // The list and the publish count refresh after a save.
    await waitFor(() => expect(rpcCalls('cms_list').length).toBeGreaterThan(1));
    expect(rpcCalls('unpublished_summary').length).toBeGreaterThan(1);

    type(homeBreadcrumbEn(), 'Home!!');
    await waitFor(() => expect(saves()).toHaveLength(2));
    expect(saves()[1]).toMatchObject({ p_expected_updated_at: '2026-10-31T12:00:00.001+00:00' });
  });

  it('a validation error keeps the draft local: nothing is sent until it is fixed', async () => {
    await openEditor();
    const original = homeBreadcrumbEn().value;
    type(homeBreadcrumbEn(), '');
    await waitFor(() => expect(homeBreadcrumbEn().getAttribute('aria-invalid')).toBe('true'));
    await waitFor(() => expect(pill().getAttribute('data-status')).toBe('invalid'));
    expect(screen.getByText(/1 λάθος/)).toBeTruthy();
    expect(saves()).toHaveLength(0);
    type(homeBreadcrumbEn(), `${original}!`);
    await waitFor(() => expect(saves()).toHaveLength(1));
  });

  it('a title or description used by another published page is an inline error, and is never saved (I2)', async () => {
    await openEditor();
    const title = control('Page meta (SEO) › SEO title (EN)');
    const faqTitle = (published('faq').en.meta as Record<string, string>).title;
    await waitFor(() => expect(fetchesOf('faq')).toHaveLength(1));
    type(title, faqTitle);
    await waitFor(() => expect(title.getAttribute('aria-invalid')).toBe('true'));
    expect(screen.getByText(/Same SEO title as "faq"/)).toBeTruthy();
    await waitFor(() => expect(pill().getAttribute('data-status')).toBe('invalid'));
    expect(saves()).toHaveLength(0);
    // The other pages were fetched once for the whole session.
    expect(fetchesOf('faq')).toHaveLength(1);
  });

  it('Extra blocks: + Add, a FAQ block; the autosave keeps extraBlocks in both languages', async () => {
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Προσθήκη: Extra blocks' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Τύπος ενότητας: Extra blocks' }), { target: { value: 'faq' } });
    fireEvent.click(screen.getByRole('button', { name: 'Προσθήκη ενότητας: Extra blocks' }));
    await waitFor(() => expect(saves()).toHaveLength(1), { timeout: 4000 });
    const data = saves()[0].p_data;
    expect(data.en.extraBlocks).toEqual([{ type: 'faq', items: [] }]);
    expect(data.el.extraBlocks).toEqual([{ type: 'faq', items: [] }]);
  });

  it('a save refused because someone else saved merges their version (disjoint fields) and saves again', async () => {
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: published('about'), updated_at: DRAFT_TIME };
    await openEditor();
    // The other editor saves an EL change meanwhile.
    const theirs = published('about');
    (theirs.el.breadcrumbs as Record<string, string>).home = 'Η αλλαγή τους';
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: theirs, updated_at: '2026-10-31T11:00:00.000+00:00' };
    type(homeBreadcrumbEn(), 'My edit');
    await waitFor(() => expect(saves()).toHaveLength(2));
    expect(saves()[1]).toMatchObject({ p_expected_updated_at: '2026-10-31T11:00:00.000+00:00' });
    const sent = saves()[1].p_data;
    expect((sent.en.breadcrumbs as Record<string, string>).home).toBe('My edit');
    expect((sent.el.breadcrumbs as Record<string, string>).home).toBe('Η αλλαγή τους');
    expect(control('Breadcrumbs › Home (EL)').value).toBe('Η αλλαγή τους');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('the same field changed by both: the dialog shows both values; «Κράτα τη δική μου» saves mine', async () => {
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: published('about'), updated_at: DRAFT_TIME };
    await openEditor();
    const theirs = published('about');
    (theirs.en.breadcrumbs as Record<string, string>).home = 'Their edit';
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: theirs, updated_at: '2026-10-31T11:00:00.000+00:00' };
    type(homeBreadcrumbEn(), 'My edit');
    const dialog = await screen.findByRole('alertdialog', { name: 'Το ίδιο πεδίο άλλαξε και από τις δύο πλευρές' });
    expect(within(dialog).getByText('Breadcrumbs › Home (EN)')).toBeTruthy();
    expect(within(dialog).getByText('My edit')).toBeTruthy();
    expect(within(dialog).getByText('Their edit')).toBeTruthy();
    expect(pill().getAttribute('data-status')).toBe('conflict');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Κράτα τη δική μου' }));
    await waitFor(() => expect(saves()).toHaveLength(2));
    expect((saves()[1].p_data.en.breadcrumbs as Record<string, string>).home).toBe('My edit');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('«Πάρε τη δική τους» takes their value into the form', async () => {
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: published('about'), updated_at: DRAFT_TIME };
    await openEditor();
    const theirs = published('about');
    (theirs.en.breadcrumbs as Record<string, string>).home = 'Their edit';
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: theirs, updated_at: '2026-10-31T11:00:00.000+00:00' };
    type(homeBreadcrumbEn(), 'My edit');
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Πάρε τη δική τους' }));
    await waitFor(() => expect(homeBreadcrumbEn().value).toBe('Their edit'));
    expect(saves()).toHaveLength(1); // nothing of mine is left to send
    expect(pill().getAttribute('data-status')).toBe('saved');
  });

  it('another save error shows «Σφάλμα – ξαναδοκίμασε»; the pill retries', async () => {
    await openEditor();
    h.saveError = { message: 'forbidden' };
    type(homeBreadcrumbEn(), 'x');
    await waitFor(() => expect(pill().textContent).toBe('Σφάλμα – ξαναδοκίμασε'));
    expect(pill().getAttribute('title')).toBe('forbidden');
    h.saveError = null;
    fireEvent.click(pill());
    await waitFor(() => expect(pill().getAttribute('data-status')).toBe('saved'));
    expect(h.drafts.about).toBeTruthy();
  });

  it('offline: «Εκτός σύνδεσης – θα αποθηκευτεί», and the edit is in the local buffer', async () => {
    await openEditor();
    h.saveError = { message: 'TypeError: Failed to fetch' };
    type(homeBreadcrumbEn(), 'offline edit');
    await waitFor(() => expect(pill().textContent).toBe('Εκτός σύνδεσης – θα αποθηκευτεί'));
    const buf = JSON.parse(localStorage.getItem('cms:unsent:about')!) as { value: Doc };
    expect((buf.value.en.breadcrumbs as Record<string, string>).home).toBe('offline edit');
    h.saveError = null;
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(pill().getAttribute('data-status')).toBe('saved'));
    expect(localStorage.getItem('cms:unsent:about')).toBeNull();
  });

  it('an unsent buffer from a crash or reload is restored and saved', async () => {
    const mine = published('about');
    (mine.en.breadcrumbs as Record<string, string>).home = 'Typed before the crash';
    localStorage.setItem('cms:unsent:about', JSON.stringify({ value: mine, base: published('about'), baseUpdatedAt: null, at: 1 }));
    await openEditor();
    expect(homeBreadcrumbEn().value).toBe('Typed before the crash');
    await waitFor(() => expect(saves()).toHaveLength(1), { timeout: 4000 });
    expect((saves()[0].p_data.en.breadcrumbs as Record<string, string>).home).toBe('Typed before the crash');
  });

  it('Discard draft asks, deletes the draft and goes back to the published version', async () => {
    const doc = published('about');
    (doc.en.breadcrumbs as Record<string, string>).home = 'Draft home';
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: doc, updated_at: DRAFT_TIME };
    await openEditor();
    expect(homeBreadcrumbEn().value).toBe('Draft home');
    fireEvent.click(screen.getByRole('button', { name: 'Απόρριψη προχείρου' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Απόρριψη του προχείρου;' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ακύρωση' }));
    expect(rpcCalls('cms_discard')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Απόρριψη προχείρου' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Απόρριψη προχείρου' }));
    await waitFor(() => expect(screen.getByText('Ίδιο με το site')).toBeTruthy());
    expect(rpcCalls('cms_discard')[0][1]).toEqual({ p_doc_id: 'about' });
    expect(homeBreadcrumbEn().value).toBe((published('about').en.breadcrumbs as Record<string, string>).home);
    expect(screen.queryByRole('button', { name: 'Απόρριψη προχείρου' })).toBeNull();
  });

  it('the leave guard asks only for edits that cannot be saved now (here: invalid)', async () => {
    await openEditor();
    const unload = () => {
      const e = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    // A pending edit is not "unsaved": leaving saves it, a closed tab keeps it in the buffer.
    fireEvent.change(homeBreadcrumbEn(), { target: { value: 'pending' } });
    expect(unload()).toBe(false);
    type(homeBreadcrumbEn(), '');
    await waitFor(() => expect(pill().getAttribute('data-status')).toBe('invalid'));
    expect(unload()).toBe(true);

    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: '← Όλες οι σελίδες' }));
    expect(confirm).toHaveBeenCalledWith(UNSAVED_TEXT);
    expect(homeBreadcrumbEn().value).toBe('');

    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: '← Όλες οι σελίδες' }));
    expect(await screen.findByRole('row', { name: /^Σχετικά/ })).toBeTruthy();
    expect(unload()).toBe(false);
  });

  it('narrow screens get Edit / Preview tabs', async () => {
    await openEditor();
    const tabs = screen.getByRole('tablist', { name: 'Προβολή' });
    const [edit, preview] = within(tabs).getAllByRole('tab');
    expect(edit.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(preview);
    expect(preview.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('preview-panel').className).not.toMatch(/(^| )hidden( |$)/);
    expect(screen.getByTestId('form-panel').className).toMatch(/(^| )hidden( |$)/);
    expect(screen.getByTestId('form-panel').className).toMatch(/xl:block/);
  });
});

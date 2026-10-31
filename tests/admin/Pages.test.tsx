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
  saveStamp: '2026-10-31T12:00:00.001+00:00',
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
        case 'cms_save':
          if (h.saveError) return Promise.resolve({ data: null, error: h.saveError });
          return ok(h.saveStamp);
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
import { SAVE_BLOCKED_TEXT } from '../../src/admin/modules/pages/PageEditor';
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

async function openEditor(label: string) {
  render(<Pages />);
  const row = await screen.findByRole('row', { name: new RegExp(label) });
  fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
  return screen.findByRole('button', { name: 'Save draft' });
}

/** A form control by its label text (getByLabelText is very slow in jsdom on a form this size). */
function control(name: string): HTMLInputElement {
  const label = [...document.querySelectorAll('label[for]')].find((l) => l.textContent === name);
  const el = label && document.getElementById(label.getAttribute('for')!);
  if (!el) throw new Error(`no control labelled ${name}`);
  return el as HTMLInputElement;
}
const homeBreadcrumbEn = () => control('Breadcrumbs › Home (EN)');

beforeEach(() => {
  h.rpc.mockClear();
  h.invoke.mockReset();
  h.list = [];
  h.drafts = {};
  h.saveError = null;
  h.summary = { changed_years: [], changed_docs: [], since: '2026-10-29T10:00:00Z' };
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
  // Each editor test renders a full page form (~1 s alone); under full-suite load that can pass 5 s.
  it('gives every test in this file 15 s', ({ task }) => {
    expect(task.timeout).toBe(15_000);
  });
});

describe('Pages module: list', () => {
  it('lists every site page with its state badge', async () => {
    h.list = [
      { doc_id: 'about', doc_type: 'about', updated_at: DRAFT_TIME, published: false },
      { doc_id: 'faq', doc_type: 'faq', updated_at: DRAFT_TIME, published: true },
    ] satisfies Row[];
    render(<Pages />);
    const about = await screen.findByRole('row', { name: /About/ });
    expect(within(about).getByText('Draft (unpublished)')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /FAQ/ })).getByText('Published')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /^Rules/ })).getByText('Never edited')).toBeTruthy();
    // All 18 site docs, one row each (plus the header row).
    expect(screen.getAllByRole('row')).toHaveLength(18 + 1);
  });

  it('explains what Publish does with the drafts (I3)', async () => {
    render(<Pages />);
    expect(await screen.findByText(PUBLISH_PAGES_TEXT)).toBeTruthy();
    expect(PUBLISH_PAGES_TEXT).toMatch(/about 2 minutes/);
    expect(PUBLISH_PAGES_TEXT).toMatch(/draft stays/);
  });

  it('the publish bar counts changed pages', async () => {
    h.summary = { changed_years: [2026], changed_docs: ['about', 'faq'], since: '2026-10-29T10:00:00Z' };
    render(<Pages />);
    expect(await screen.findByText('3 unpublished changes: 1 year (2026), 2 pages (about, faq)')).toBeTruthy();
  });
});

describe('Pages module: editor', () => {
  it('loads the published version when there is no draft, and shows the form and the preview', async () => {
    await openEditor('About');
    expect(rpcCalls('cms_get')[0][1]).toEqual({ p_doc_id: 'about' });
    expect(fetchesOf('about')).toEqual(['/content/pages/about.json']);
    expect(screen.getByText('Published version')).toBeTruthy();
    expect(homeBreadcrumbEn().value).toBe((published('about').en.breadcrumbs as Record<string, string>).home);
    expect(screen.getByTestId('preview-pane')).toBeTruthy();
    // Nothing edited yet: nothing to save.
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Discard draft' })).toBeNull();
  });

  it('loads the saved draft when there is one, without fetching the published file', async () => {
    const doc = published('about');
    (doc.en.hero as Record<string, unknown>).title = 'Draft hero from DB';
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: doc, updated_at: DRAFT_TIME };
    await openEditor('About');
    expect(screen.getByText(/^Draft saved \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)).toBeTruthy();
    expect(fetchesOf('about')).toEqual([]);
    expect(within(screen.getByTestId('preview-pane')).getByText('Draft hero from DB')).toBeTruthy();
  });

  it('typing updates the preview (debounced)', async () => {
    await openEditor('About');
    const title = control('Hero › Title (EN)');
    fireEvent.change(title, { target: { value: 'Live typed hero title' } });
    const pane = screen.getByTestId('preview-pane');
    expect(within(pane).queryByText('Live typed hero title')).toBeNull();
    expect(await within(pane).findByText('Live typed hero title')).toBeTruthy();
    expect(screen.getByText('Unsaved edits')).toBeTruthy();
  });

  it('a validation error blocks Save; fixing it enables Save again', async () => {
    await openEditor('About');
    const save = screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement;
    const original = homeBreadcrumbEn().value;
    fireEvent.change(homeBreadcrumbEn(), { target: { value: '' } });
    await waitFor(() => expect(homeBreadcrumbEn().getAttribute('aria-invalid')).toBe('true'));
    expect(save.disabled).toBe(true);
    expect(screen.getByText(/Fix the errors to save/)).toBeTruthy();
    fireEvent.change(homeBreadcrumbEn(), { target: { value: `${original}!` } });
    await waitFor(() => expect(save.disabled).toBe(false));
  });

  it('a title or description used by another published page is an inline error that blocks Save (I2)', async () => {
    await openEditor('About');
    const save = screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement;
    const title = control('Page meta (SEO) › SEO title (EN)');
    const faqTitle = (published('faq').en.meta as Record<string, string>).title;
    fireEvent.change(title, { target: { value: faqTitle } });
    await waitFor(() => expect(title.getAttribute('aria-invalid')).toBe('true'));
    expect(screen.getByText(/Same SEO title as "faq"/)).toBeTruthy();
    expect(save.disabled).toBe(true);
    // Save's own check catches it too, inside the delay.
    fireEvent.change(title, { target: { value: `${faqTitle} (about)` } });
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.change(title, { target: { value: faqTitle } });
    fireEvent.click(save);
    expect(screen.getByText(SAVE_BLOCKED_TEXT)).toBeTruthy();
    expect(rpcCalls('cms_save')).toHaveLength(0);
    // The other pages were fetched once for the whole session.
    expect(fetchesOf('faq')).toHaveLength(1);
  });

  it('Save inside the validation delay re-validates: an invalid draft is not sent, and the notice shows at once', async () => {
    await openEditor('About');
    const save = screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement;
    fireEvent.change(homeBreadcrumbEn(), { target: { value: '' } });
    // Before the debounced errors: Save is still enabled.
    expect(save.disabled).toBe(false);
    expect(homeBreadcrumbEn().getAttribute('aria-invalid')).toBeNull();
    fireEvent.click(save);
    expect(screen.getByText(SAVE_BLOCKED_TEXT)).toBeTruthy();
    expect(rpcCalls('cms_save')).toHaveLength(0);
    await waitFor(() => expect(homeBreadcrumbEn().getAttribute('aria-invalid')).toBe('true'));
    // Editing clears the notice.
    fireEvent.change(homeBreadcrumbEn(), { target: { value: 'Home' } });
    expect(screen.queryByText(SAVE_BLOCKED_TEXT)).toBeNull();
  });

  it('Extra blocks: + Add, a FAQ block, Save draft keeps extraBlocks in both languages', async () => {
    await openEditor('About');
    fireEvent.click(screen.getByRole('button', { name: 'Add Extra blocks' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Block type for Extra blocks' }), { target: { value: 'faq' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add block to Extra blocks' }));
    const save = screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    expect(await screen.findByText('Saved')).toBeTruthy();
    const data = (rpcCalls('cms_save')[0][1] as { p_data: Doc }).p_data;
    expect(data.en.extraBlocks).toEqual([{ type: 'faq', items: [] }]);
    expect(data.el.extraBlocks).toEqual([{ type: 'faq', items: [] }]);
  });

  it('Save sends the draft with the expected timestamp, then saves against the new one', async () => {
    const doc = published('about');
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: doc, updated_at: DRAFT_TIME };
    await openEditor('About');
    fireEvent.change(homeBreadcrumbEn(), { target: { value: 'Home!' } });
    const save = screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    expect(await screen.findByText('Saved')).toBeTruthy();
    const [, args] = rpcCalls('cms_save')[0];
    expect(args).toMatchObject({ p_doc_id: 'about', p_doc_type: 'about', p_expected_updated_at: DRAFT_TIME });
    expect(((args as { p_data: Doc }).p_data.en.breadcrumbs as Record<string, string>).home).toBe('Home!');
    expect(screen.queryByText('Unsaved edits')).toBeNull();
    expect(save.disabled).toBe(true);
    // The list and the publish count refresh after a save.
    expect(rpcCalls('cms_list').length).toBeGreaterThan(1);
    expect(rpcCalls('unpublished_summary').length).toBeGreaterThan(1);

    fireEvent.change(homeBreadcrumbEn(), { target: { value: 'Home!!' } });
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    await waitFor(() => expect(rpcCalls('cms_save')).toHaveLength(2));
    expect(rpcCalls('cms_save')[1][1]).toMatchObject({ p_expected_updated_at: h.saveStamp });
  });

  it('a first save from the published version sends a null expected timestamp', async () => {
    await openEditor('About');
    fireEvent.change(homeBreadcrumbEn(), { target: { value: 'Home!' } });
    const save = screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(rpcCalls('cms_save')[0][1]).toMatchObject({ p_expected_updated_at: null });
    expect(screen.getByText(/^Draft saved /)).toBeTruthy();
  });

  it('a stale save shows the conflict banner; Reload asks, then loads the latest', async () => {
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: published('about'), updated_at: DRAFT_TIME };
    await openEditor('About');
    fireEvent.change(homeBreadcrumbEn(), { target: { value: 'My edit' } });
    const save = screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    h.saveError = { message: 'document changed by someone else; reload' };
    fireEvent.click(save);
    const banner = await screen.findByText('Someone else changed this page — Reload');
    // Edits stay in the form until the user reloads.
    expect(homeBreadcrumbEn().value).toBe('My edit');
    expect(save.disabled).toBe(true);

    const theirs = published('about');
    (theirs.en.breadcrumbs as Record<string, string>).home = 'Their edit';
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: theirs, updated_at: '2026-10-31T11:00:00.000+00:00' };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const reload = within(banner.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Reload' });
    fireEvent.click(reload);
    expect(confirm).toHaveBeenLastCalledWith('Discard your edits and load the latest?');
    expect(homeBreadcrumbEn().value).toBe('My edit');
    fireEvent.click(reload);
    await waitFor(() => expect(homeBreadcrumbEn().value).toBe('Their edit'));
    expect(screen.queryByText('Someone else changed this page — Reload')).toBeNull();

    // The next save is against their timestamp.
    h.saveError = null;
    fireEvent.change(homeBreadcrumbEn(), { target: { value: 'Merged' } });
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    await screen.findByText('Saved');
    expect(rpcCalls('cms_save').at(-1)?.[1]).toMatchObject({ p_expected_updated_at: '2026-10-31T11:00:00.000+00:00' });
  });

  it('another save error is shown as is, without the conflict banner', async () => {
    await openEditor('About');
    fireEvent.change(homeBreadcrumbEn(), { target: { value: 'x' } });
    const save = screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    h.saveError = { message: 'forbidden' };
    fireEvent.click(save);
    expect(await screen.findByText('forbidden')).toBeTruthy();
    expect(screen.queryByText('Someone else changed this page — Reload')).toBeNull();
  });

  it('Discard draft asks, deletes the draft and reloads the published version', async () => {
    const doc = published('about');
    (doc.en.breadcrumbs as Record<string, string>).home = 'Draft home';
    h.drafts.about = { doc_id: 'about', doc_type: 'about', data: doc, updated_at: DRAFT_TIME };
    await openEditor('About');
    expect(homeBreadcrumbEn().value).toBe('Draft home');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(rpcCalls('cms_discard')).toHaveLength(0);

    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
    await waitFor(() => expect(screen.getByText('Published version')).toBeTruthy());
    expect(rpcCalls('cms_discard')[0][1]).toEqual({ p_doc_id: 'about' });
    expect(homeBreadcrumbEn().value).toBe((published('about').en.breadcrumbs as Record<string, string>).home);
    expect(screen.queryByRole('button', { name: 'Discard draft' })).toBeNull();
  });

  it('leaving a page with unsaved edits asks first; beforeunload is armed while dirty', async () => {
    await openEditor('About');
    const unload = () => {
      const e = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(unload()).toBe(false);
    fireEvent.change(homeBreadcrumbEn(), { target: { value: 'unsaved' } });
    expect(unload()).toBe(true);

    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: '← All pages' }));
    expect(confirm).toHaveBeenCalledWith(UNSAVED_TEXT);
    expect(homeBreadcrumbEn().value).toBe('unsaved');

    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: '← All pages' }));
    expect(await screen.findByRole('row', { name: /About/ })).toBeTruthy();
    expect(unload()).toBe(false);
  });

  it('narrow screens get Edit / Preview tabs', async () => {
    await openEditor('About');
    const tabs = screen.getByRole('tablist', { name: 'Editor view' });
    const [edit, preview] = within(tabs).getAllByRole('tab');
    expect(edit.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(preview);
    expect(preview.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('preview-panel').className).not.toMatch(/(^| )hidden( |$)/);
    expect(screen.getByTestId('form-panel').className).toMatch(/(^| )hidden( |$)/);
    // Side by side at xl (≥1280px) whatever the tab.
    expect(screen.getByTestId('form-panel').className).toMatch(/xl:block/);
  });
});

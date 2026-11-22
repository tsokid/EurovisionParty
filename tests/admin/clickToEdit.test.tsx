// P4 click-to-edit round trip (spec §4, §5), on every static page doc, the
// header and the footer, through the real bridge (in-memory port: jsdom
// cannot load the app into an iframe; protocol.test covers postMessage):
// - every element the preview marks maps to a field the form has;
// - hovering an element shows its field's label;
// - clicking it focuses that field;
// - focusing a field marks its element on the page;
// - EN and EL.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useRef, useState, type ReactNode } from 'react';
import { ToastHost } from '../../src/admin/ui/kit';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
const api = vi.hoisted(() => ({
  cmsGet: vi.fn(async () => null),
  cmsList: vi.fn(async () => []),
  cmsSave: vi.fn(async () => '2026-11-22T12:00:00Z'),
  cmsDiscard: vi.fn(async () => {}),
}));
vi.mock('../../src/admin/modules/pages/cmsApi', () => ({
  cmsGet: api.cmsGet, cmsList: api.cmsList, cmsSave: api.cmsSave, cmsDiscard: api.cmsDiscard, isConflict: () => false,
}));
vi.mock('../../src/admin/modules/contests/publish', () => ({
  usePublisher: () => ({ publish: vi.fn(), publishing: false, outcome: null, summary: { changed_years: [], changed_docs: [], since: null } }),
  outcomeText: () => 'Published',
}));

import { SchemaForm, type DocValue } from '../../src/admin/modules/pages/form/SchemaForm';
import PreviewPane from '../../src/admin/modules/pages/PreviewPane';
import { findField, controlLabel, useClickToEdit } from '../../src/admin/preview/useClickToEdit';
import HeaderEditor from '../../src/admin/modules/site/HeaderEditor';
import FooterEditor from '../../src/admin/modules/site/FooterEditor';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { bundledContent } from '../../src/lib/seo/contentData';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** PageEditor's wiring, without its data loading: the schema form, the preview and the bridge. */
function Editor({ docId }: { docId: string }) {
  const schema = CMS_DOC_TYPES[docTypeFor(docId)].schema;
  const [value, setValue] = useState<DocValue>(() => clone(bundledContent(`pages/${docId}.json`)) as DocValue);
  const formRef = useRef<HTMLDivElement>(null);
  const click = useClickToEdit({ docId, formRef, ready: true });
  return (
    <div>
      <div ref={formRef} data-testid="form-panel">
        <SchemaForm schema={schema} value={value} onChange={setValue} errors={[]} warnings={[]} />
      </div>
      <PreviewPane docId={docId} doc={value} getLabels={click.getLabels} highlight={click.highlight} onFocusTarget={click.onFocusTarget} />
    </div>
  );
}

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

const pane = () => screen.getByTestId('preview-pane');
const form = () => screen.getByTestId('form-panel');
const marked = (docId: string, locale: string) => [...pane().ownerDocument.querySelectorAll<HTMLElement>(`[data-cms-path^="${docId}:${locale}:"]`)];
const fieldOf = (el: Element) => {
  const [, locale, path] = /^[a-z0-9-]+:([a-z]{2}):(.+)$/.exec(el.getAttribute('data-cms-path')!)!;
  return `${locale}.${path}`;
};

/** Marked elements whose path has no field in the form (should be none). */
const orphans = (docId: string, locale: string) => marked(docId, locale).map(fieldOf).filter((f) => !findField(form(), f));

async function settle() {
  // The state message (in-memory port), the text mapping (rAF) and the focus (rAF).
  await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
}

/** Click → the field gets focus; hover → the field's label; field focus → the element is marked. */
async function roundTrip(el: HTMLElement) {
  const field = fieldOf(el);
  fireEvent.mouseOver(el);
  const control = findField(form(), field)!;
  expect(control, field).toBeTruthy();
  const label = await screen.findByTestId('preview-hover-label');
  expect(label.textContent).toBe(
    control.getAttribute('data-cms-field') === field ? controlLabel(control) : expect.any(String) as unknown as string,
  );
  fireEvent.click(el);
  await waitFor(() => expect(document.activeElement).toBe(control));
  // The field in focus is marked on the page (the element itself or its marked container).
  await waitFor(() => expect(pane().ownerDocument.querySelector('[data-cms-selected]')).not.toBeNull());
  const selected = [...pane().ownerDocument.querySelectorAll('[data-cms-selected]')];
  expect(selected.some((s) => s === el || s.contains(el) || el.contains(s))).toBe(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// Every static page of the registry, plus the 404 page (not-found).
const STATIC_DOCS = [...PAGE_REGISTRY.map((p) => p.id as string), 'not-found'].filter((id) => bundledContent(`pages/${id}.json`));

describe('click-to-edit on every static page doc', () => {
  it('covers all 18 static page docs', () => {
    expect(STATIC_DOCS.length).toBe(18);
  });

  for (const docId of STATIC_DOCS) {
    it(`${docId}: marks its copy, and click ↔ field works in EN and EL`, async () => {
      render(<MemoryRouter initialEntries={[`/admin/pages/${docId}`]}><ToastHost><Editor docId={docId} /></ToastHost></MemoryRouter>);
      await settle();
      for (const locale of ['en', 'el'] as const) {
        if (locale === 'el') {
          fireEvent.click(within(screen.getByTestId('preview-host')).getByRole('button', { name: 'EL' }));
          await settle();
        }
        const els = marked(docId, locale);
        expect(els.length, `${docId}/${locale} marked elements`).toBeGreaterThanOrEqual(5);
        expect(orphans(docId, locale), `${docId}/${locale}`).toEqual([]);
        const hero = els.find((e) => e.getAttribute('data-cms-path') === `${docId}:${locale}:hero.title`);
        await roundTrip(hero ?? els[0]);
      }
    }, 30_000);
  }
});

describe('click-to-edit: header and footer', () => {
  const wrap = (ui: ReactNode, at: string) =>
    render(
      <MemoryRouter initialEntries={[at]}>
        <ToastHost>
          <Routes>
            <Route path="/admin/header" element={ui} />
            <Route path="/admin/footer" element={ui} />
            <Route path="/admin/footer/:column" element={<FooterEditor column="help" />} />
            <Route path="*" element={null} />
          </Routes>
          <Where />
        </ToastHost>
      </MemoryRouter>,
    );

  it('header: every header element maps to a field, click focuses it, focus marks it', async () => {
    wrap(<HeaderEditor />, '/admin/header');
    await screen.findByTestId('autosave-pill');
    await settle();
    const els = marked('site-header', 'en');
    expect(els.length).toBeGreaterThanOrEqual(5);
    expect(orphans('site-header', 'en')).toEqual([]);
    const cta = els.find((e) => e.getAttribute('data-cms-path') === 'site-header:en:cta.createRoom')!;
    await roundTrip(cta);
    const item = els.find((e) => /:items\.\d+\.label$/.test(e.getAttribute('data-cms-path')!))!;
    await roundTrip(item);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/\?field=en\.items\.\d+\.label$/));
  }, 30_000);

  it('footer: tagline, column heading, link and disclaimer round-trip; another column opens its screen', async () => {
    wrap(<FooterEditor column={null} />, '/admin/footer');
    await screen.findByTestId('autosave-pill');
    await settle();
    const els = marked('site-footer', 'en');
    expect(orphans('site-footer', 'en')).toEqual([]);
    for (const p of ['tagline', 'columns.0.heading', 'columns.1.links.0.label', 'disclaimer']) {
      const el = els.find((e) => e.getAttribute('data-cms-path') === `site-footer:en:${p}`);
      expect(el, p).toBeTruthy();
      await roundTrip(el!);
    }
  }, 30_000);

  it('footer column screen: a link of another column opens that column, on the field', async () => {
    wrap(null, '/admin/footer/help');
    await screen.findByTestId('autosave-pill');
    await settle();
    const other = marked('site-footer', 'en').find((e) => /:columns\.0\.links\.0\.label$/.test(e.getAttribute('data-cms-path')!))!;
    fireEvent.click(other);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/admin/footer/about?field=en.columns.0.links.0.label'));
  }, 30_000);

  it('a page editor: clicking the header opens the header editor on that field', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/pages/rules']}>
        <ToastHost><Editor docId="rules" /><Where /></ToastHost>
      </MemoryRouter>,
    );
    await settle();
    const cta = marked('site-header', 'en').find((e) => e.getAttribute('data-cms-path') === 'site-header:en:cta.joinRoom')!;
    fireEvent.mouseOver(cta);
    expect((await screen.findByTestId('preview-hover-label')).textContent).toBe('Κεφαλίδα · άνοιξε για επεξεργασία');
    fireEvent.click(cta);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/admin/header?field=en.cta.joinRoom'));
  }, 30_000);
});

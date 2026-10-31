import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import i18n from '../../src/i18n';
import PreviewPane from '../../src/admin/modules/pages/PreviewPane';
import { bundledContent } from '../../src/lib/seo/contentData';
import { getCachedContent } from '../../src/lib/seo/contentCache';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

type Doc = { en: Record<string, unknown>; el: Record<string, unknown> };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const published = (docId: string) => clone(bundledContent(`pages/${docId}.json`) as Doc);

/** An "admin" around the pane: an outer data router at /admin, as in the app. */
function inAdmin(ui: React.ReactNode) {
  const router = createMemoryRouter([{ path: '/admin', element: <div data-testid="admin">{ui}</div> }], {
    initialEntries: ['/admin'],
  });
  return { router, ...render(<RouterProvider router={router} />) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PreviewPane', () => {
  it('renders the real page with the draft, never fetching or caching the previewed doc', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const doc = published('about');
    (doc.en.hero as Record<string, unknown>).title = 'Draft hero title XYZ';
    inAdmin(<PreviewPane docId="about" doc={doc} />);
    expect(screen.getByText('Draft hero title XYZ')).toBeInTheDocument();
    expect(screen.getByText('Preview — links are disabled')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes('pages/about.json'))).toBe(false);
    expect(getCachedContent('pages/about.json')).toBeUndefined();
  });

  it('toggles EN/EL without touching the global locale', () => {
    const doc = published('about');
    (doc.el.hero as Record<string, unknown>).title = 'Πρόχειρος τίτλος ΧΨΩ';
    const langBefore = i18n.language;
    const htmlLang = document.documentElement.lang;
    inAdmin(<PreviewPane docId="about" doc={doc} />);
    fireEvent.click(screen.getByRole('button', { name: 'EL' }));
    expect(screen.getByText('Πρόχειρος τίτλος ΧΨΩ')).toBeInTheDocument();
    // The page's own UI strings (the footer) follow the preview locale too.
    expect(screen.getAllByRole('heading', { name: i18n.getFixedT('el')('siteFooter.about') }).length).toBeGreaterThan(0);
    expect(i18n.language).toBe(langBefore);
    expect(document.documentElement.lang).toBe(htmlLang);
  });

  it('never writes document.head (title, meta, canonical, JSON-LD) across renders', () => {
    document.title = 'admin';
    const headBefore = document.head.innerHTML;
    const doc = published('eurovision-night');
    const { router } = inAdmin(<PreviewPane docId="eurovision-night" doc={doc} />);
    expect(screen.getAllByText(String((doc.en.hero as Record<string, unknown>).title)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'EL' }));
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(document.title).toBe('admin');
    expect(document.head.innerHTML).toBe(headBefore);
    act(() => router.dispose());
    expect(document.title).toBe('admin');
    expect(document.head.innerHTML).toBe(headBefore);
  });

  it('shows "Preview error" for a malformed draft, without crashing the admin', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    inAdmin(<PreviewPane docId="about" doc={{ en: {}, el: {} }} />);
    expect(screen.getByText(/^Preview error:/)).toBeInTheDocument();
    expect(screen.getByTestId('admin')).toBeInTheDocument();
  });

  it('shows "Preview error" for a placeholder the page does not supply', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const doc = published('eurovision-night');
    const faq = doc.en.faq as { q: string }[];
    faq[0].q = 'When is {bogus}?';
    inAdmin(<PreviewPane docId="eurovision-night" doc={doc} />);
    expect(screen.getByText(/^Preview error:.*bogus/)).toBeInTheDocument();
  });

  it('recovers once the draft is fixed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(<PreviewPane docId="about" doc={{ en: {}, el: {} }} />);
    expect(screen.getByText(/^Preview error:/)).toBeInTheDocument();
    const doc = published('about');
    (doc.en.hero as Record<string, unknown>).title = 'Fixed title QRS';
    rerender(<PreviewPane docId="about" doc={doc} />);
    expect(screen.getByText('Fixed title QRS')).toBeInTheDocument();
  });

  it('disables links: clicking one navigates neither the preview nor the admin', () => {
    const doc = published('about');
    (doc.en.hero as Record<string, unknown>).title = 'Stay here ABC';
    const { router } = inAdmin(<PreviewPane docId="about" doc={doc} />);
    const pane = screen.getByTestId('preview-pane');
    const link = pane.querySelector('a[href]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    // Default prevented: a plain <a href> (external link) cannot leave the admin either.
    expect(fireEvent.click(link)).toBe(false);
    expect(router.state.location.pathname).toBe('/admin');
    expect(screen.getByText('Stay here ABC')).toBeInTheDocument();
  });

  it('swallows plain <a href> clicks too (they would load a new document)', () => {
    inAdmin(<PreviewPane docId="privacy" doc={published('privacy')} />);
    const raw = screen.getByTestId('preview-pane').querySelector('a[href="/cookies"]') as HTMLAnchorElement;
    expect(raw).not.toBeNull();
    expect(fireEvent.click(raw)).toBe(false);
  });

  it('previews the 404 page for not-found, without a head collector', () => {
    const doc = published('not-found');
    (doc.en.hero as Record<string, unknown>).title = 'Lost draft DEF';
    inAdmin(<PreviewPane docId="not-found" doc={doc} />);
    expect(screen.getByText('Lost draft DEF')).toBeInTheDocument();
  });

  it('reports an unknown docId inside the pane', () => {
    render(<PreviewPane docId="nope" doc={{ en: {}, el: {} }} />);
    expect(screen.getByText(/^Preview error:.*nope/)).toBeInTheDocument();
  });

  it('can preview every site page from its published doc', () => {
    const siteDocs = Object.entries(CMS_DOC_TYPES).filter(([, d]) => d.group === 'site').map(([id]) => id);
    expect(siteDocs.length).toBeGreaterThan(15);
    for (const docId of siteDocs) {
      const { unmount } = inAdmin(<PreviewPane docId={docId} doc={published(docId)} />);
      expect(screen.queryByText(/^Preview error:/), docId).toBeNull();
      unmount();
    }
  });
});

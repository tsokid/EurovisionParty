import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import LocaleLink from '@/components/seo/LocaleLink';
import { PageContentFallback } from '@/pages/seo/PageContentFallback';
import { ContentPending } from '@/pages/contest/ContentPending';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { usePageContent } from '@/lib/cms/usePageContent';
import { LocaleProvider } from '@/lib/seo/LocaleContext';
import { pageDocIdForPath } from '@/lib/cms/prefetchPageContent';
import type { Locale } from '@/lib/seo/locale';

// Client-side navigation to a page whose content is not cached yet: the page
// keeps its chrome (LocaleRoot renders SiteHeader; the footer is per page, so
// the pending state must render it too), and links warm the cache on hover.

// vitest reads content from the eager snapshot, as the server does; hide these
// docs so the client paths (fetch, loading) run.
const HIDDEN = new Set(['pages/faq.json', 'pages/rules.json', 'pages/not-found.json']);
vi.mock('@/lib/seo/contentData', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/seo/contentData')>();
  return { ...real, bundledContent: (path: string) => (HIDDEN.has(path) ? undefined : real.bundledContent(path)) };
});

const at = (locale: Locale, node: ReactNode) => (
  <MemoryRouter><LocaleProvider locale={locale}>{node}</LocaleProvider></MemoryRouter>
);

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pending content keeps the site footer', () => {
  it('PageContentFallback (loading) renders the pending body and the footer', () => {
    render(at('en', <PageContentFallback state={{ status: 'loading' }} />));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('PageContentFallback (error) renders retry and the footer', () => {
    render(at('el', <PageContentFallback state={{ status: 'error', retry: () => {} }} />));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('ContentPending as a page body (contest pages) renders the footer; inline it does not', () => {
    const { unmount } = render(at('en', <ContentPending locale="en" />));
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    unmount();
    render(at('en', <ContentPending locale="en" inline />));
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('the minimal 404 (its doc still loading) renders the footer', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    render(at('en', <NotFoundPage />));
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});

describe('LocaleLink prefetches the target page doc', () => {
  it('maps registry paths to their doc id, and nothing else', () => {
    expect(pageDocIdForPath('/en/faq')).toEqual({ docId: 'faq', locale: 'en' });
    expect(pageDocIdForPath('/el/duels')).toEqual({ docId: 'eurovision-duels', locale: 'el' });
    expect(pageDocIdForPath('/en')).toEqual({ docId: 'home', locale: 'en' });
    expect(pageDocIdForPath('/en/faq#join')).toEqual({ docId: 'faq', locale: 'en' });
    expect(pageDocIdForPath('/en/faq?x=1')).toEqual({ docId: 'faq', locale: 'en' });
    expect(pageDocIdForPath('/en/past-contests')).toBeNull();
    expect(pageDocIdForPath('/faq')).toBeNull();
    expect(pageDocIdForPath('https://example.com/en/faq')).toBeNull();
  });

  it('hovering a link to /en/faq fetches pages/faq.json once; the page then renders ready synchronously', async () => {
    const doc = { en: { title: 'FAQ' }, el: { title: 'Συχνές' } };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(doc));
    render(at('en', <LocaleLink to="/faq">FAQ</LocaleLink>));
    const link = screen.getByRole('link', { name: 'FAQ' });
    expect(link).toHaveAttribute('href', '/en/faq');

    fireEvent.mouseEnter(link);
    fireEvent.mouseEnter(link);
    fireEvent.focus(link);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/content/pages/faq.json');
    await fetchSpy.mock.results[0].value;
    await new Promise((r) => setTimeout(r, 0));

    // "Navigate": the page reads its doc from the warmed cache, no loading state.
    function Faq() {
      const s = usePageContent<{ title: string }>('faq');
      return <p>{s.status === 'ready' ? `ready ${s.data.title}` : s.status}</p>;
    }
    render(at('en', <Faq />));
    expect(screen.getByText('ready FAQ')).toBeInTheDocument();
    fireEvent.mouseEnter(link);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('focus also prefetches; links outside the registry and external links do not', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    render(at('el', <>
      <LocaleLink to="/rules">Rules</LocaleLink>
      <LocaleLink to="/past-contests">Past</LocaleLink>
      <LocaleLink to="https://example.com/en/faq">Out</LocaleLink>
    </>));
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Past' }));
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Out' }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.focus(screen.getByRole('link', { name: 'Rules' }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/content/pages/rules.json');
  });

  it('keeps the caller’s own handlers', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    const onMouseEnter = vi.fn();
    const onFocus = vi.fn();
    render(at('en', <LocaleLink to="/about" onMouseEnter={onMouseEnter} onFocus={onFocus}>About</LocaleLink>));
    const link = screen.getByRole('link', { name: 'About' });
    fireEvent.mouseEnter(link);
    fireEvent.focus(link);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});

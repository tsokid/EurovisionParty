import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PageContentFallback } from '@/pages/seo/PageContentFallback';
import { usePageContent } from '@/lib/cms/usePageContent';
import { LocaleProvider } from '@/lib/seo/LocaleContext';
import type { Locale } from '@/lib/seo/locale';

// NotFoundPage reads content/pages/not-found.json, and PageContentFallback
// renders NotFoundPage for any missing doc: so while its own doc is not ready
// it must render a hardcoded minimal page, never the fallback (no recursion).

// vitest reads content from the eager snapshot, as the server does; hide the
// 404 doc so the client paths (fetch: loading, missing) run.
vi.mock('@/lib/seo/contentData', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/seo/contentData')>();
  return { ...real, bundledContent: (path: string) => (path === 'pages/not-found.json' ? undefined : real.bundledContent(path)) };
});

const at = (locale: Locale, node: React.ReactNode) => (
  <MemoryRouter><LocaleProvider locale={locale}>{node}</LocaleProvider></MemoryRouter>
);

function Probe() {
  return <p data-testid="probe">{usePageContent('not-found').status}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NotFoundPage without its CMS doc (client)', () => {
  it('renders the minimal page while the doc loads, and once it is missing', async () => {
    let answer!: (r: Response) => void;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((r) => { answer = r; }));
    render(at('en', <><NotFoundPage /><Probe /></>));
    expect(screen.getByTestId('probe')).toHaveTextContent('loading');
    expect(fetchSpy).toHaveBeenCalledWith('/content/pages/not-found.json');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en');
    answer(new Response('{}', { status: 404 }));
    // The probe reads the same hook (and cache) as the page: it proves the
    // fetch settled into 'missing', where the minimal page looks as it did loading.
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('missing'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en');
  });

  it('PageContentFallback for a missing doc renders it without recursing', async () => {
    render(at('el', <PageContentFallback state={{ status: 'missing' }} />));
    expect(await screen.findByRole('heading', { name: 'Η σελίδα δεν βρέθηκε' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Αρχική' })).toHaveAttribute('href', '/el');
  });
});

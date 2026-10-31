import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { usePageContent } from '@/lib/cms/usePageContent';
import { LocaleProvider } from '@/lib/seo/LocaleContext';
import { getCachedContent, seedContent } from '@/lib/seo/contentCache';
import type { Locale } from '@/lib/seo/locale';

interface Doc { title: string }

function Probe({ docId }: { docId: string }) {
  const s = usePageContent<Doc>(docId);
  return <p>{s.status === 'ready' ? `ready ${s.data.title}` : s.status}</p>;
}

const at = (locale: Locale, docId: string) => (
  <LocaleProvider locale={locale}><Probe docId={docId} /></LocaleProvider>
);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePageContent (client)', () => {
  it('returns the active locale slice synchronously when seeded (hydration)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    seedContent({ 'pages/__seeded.json': { en: { title: 'Hello' }, el: { title: 'Γεια' } } });
    expect(renderToString(at('en', '__seeded'))).toContain('ready Hello');
    expect(renderToString(at('el', '__seeded'))).toContain('ready Γεια');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('switches to the other locale slice when the LocaleProvider changes (en → el)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    seedContent({ 'pages/__switch.json': { en: { title: 'Rules' }, el: { title: 'Κανόνες' } } });
    const { rerender } = render(at('en', '__switch'));
    expect(screen.getByText('ready Rules')).toBeInTheDocument();
    rerender(at('el', '__switch'));
    expect(screen.getByText('ready Κανόνες')).toBeInTheDocument();
    expect(screen.queryByText('ready Rules')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches /content/pages/{docId}.json on a cache miss and becomes ready', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ en: { title: 'Fetched' }, el: { title: 'Φορτώθηκε' } }));
    render(at('el', '__fetched'));
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('ready Φορτώθηκε')).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledWith('/content/pages/__fetched.json');
    expect(getCachedContent('pages/__fetched.json')).toBeDefined();
  });

  it('returns missing on a 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, 404));
    render(at('en', '__absent'));
    await waitFor(() => expect(screen.getByText('missing')).toBeInTheDocument());
  });

  // The prerender inlines only the page's own locale, so a seeded doc may be a
  // partial: a locale it lacks is fetched (the full file), not reported missing.
  it('fetches the full doc once when a seeded partial lacks the new locale (en → el), then is ready', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ en: { title: 'Rules' }, el: { title: 'Κανόνες' } }));
    seedContent({ 'pages/__partial.json': { en: { title: 'Rules' } } });
    const { rerender } = render(at('en', '__partial'));
    expect(screen.getByText('ready Rules')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    rerender(at('el', '__partial'));
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('ready Κανόνες')).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/content/pages/__partial.json');
    // The full doc replaced the partial: back to en is synchronous, no refetch.
    rerender(at('en', '__partial'));
    expect(screen.getByText('ready Rules')).toBeInTheDocument();
    expect(getCachedContent('pages/__partial.json')).toEqual({ en: { title: 'Rules' }, el: { title: 'Κανόνες' } });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns missing when the full (fetched) document lacks the active locale', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ en: { title: 'Only' } }));
    seedContent({ 'pages/__enonly.json': { en: { title: 'Only' } } });
    render(at('el', '__enonly'));
    await waitFor(() => expect(screen.getByText('missing')).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns error (with retry) on other failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, 500));
    function Retry() {
      const s = usePageContent<Doc>('__broken');
      return <p>{s.status === 'error' ? `error ${typeof s.retry}` : s.status}</p>;
    }
    render(<Retry />);
    await waitFor(() => expect(screen.getByText('error function')).toBeInTheDocument());
  });
});

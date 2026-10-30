import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useContent } from '@/lib/seo/useContent';
import ContentProvider from '@/lib/seo/ContentProvider';
import { createContentCollector } from '@/lib/seo/contentContext';
import { seedContentFromDom, getCachedContent, CONTENT_SCRIPT_ID } from '@/lib/seo/contentCache';
import { bundledContent } from '@/lib/seo/contentData';

function Probe({ path }: { path: string | null }) {
  const s = useContent<{ year: number }>(path);
  return <p>{s.status === 'ready' ? `ready ${s.data.year}` : s.status}</p>;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('bundledContent (vitest/SSR: eager snapshot)', () => {
  it('reads content files by path relative to content/', () => {
    expect((bundledContent('contests/2026.json') as { year: number }).year).toBe(2026);
    expect((bundledContent('site.json') as { current_year: number }).current_year).toBe(2026);
    expect(bundledContent('contests/1066.json')).toBeUndefined();
  });
});

describe('seedContentFromDom', () => {
  it('seeds the sync cache from the inlined #__content__ script', () => {
    document.body.innerHTML =
      `<script type="application/json" id="${CONTENT_SCRIPT_ID}">{"contests/8001.json":{"year":8001,"x":"\\u003c/script>"}}</script>`;
    seedContentFromDom(document);
    expect(getCachedContent('contests/8001.json')).toEqual({ year: 8001, x: '</script>' });
  });

  it('is a no-op without the script or with malformed JSON', () => {
    expect(() => seedContentFromDom(document)).not.toThrow();
    document.body.innerHTML = `<script type="application/json" id="${CONTENT_SCRIPT_ID}">{oops</script>`;
    expect(() => seedContentFromDom(document)).not.toThrow();
  });
});

describe('useContent', () => {
  it('returns seeded data synchronously on the first render (hydration)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    document.body.innerHTML =
      `<script type="application/json" id="${CONTENT_SCRIPT_ID}">{"contests/8002.json":{"year":8002}}</script>`;
    seedContentFromDom(document);
    expect(renderToString(<Probe path="contests/8002.json" />)).toContain('ready 8002');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches /content/<path> when not cached, showing loading first', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ year: 8003 }));
    render(<Probe path="contests/8003.json" />);
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('ready 8003')).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledWith('/content/contests/8003.json');
    expect(getCachedContent('contests/8003.json')).toEqual({ year: 8003 });
  });

  it('reports missing on a 404 and error on other failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).includes('8004') ? jsonResponse({}, 404) : jsonResponse({}, 500));
    render(<><Probe path="contests/8004.json" /><Probe path="contests/8005.json" /></>);
    await waitFor(() => expect(screen.getByText('missing')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('error')).toBeInTheDocument());
  });

  it('treats a non-JSON response (the SPA shell) as missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    render(<Probe path="contests/8006.json" />);
    await waitFor(() => expect(screen.getByText('missing')).toBeInTheDocument());
    expect(getCachedContent('contests/8006.json')).toBeUndefined();
  });

  it('an error can be retried', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ year: 8007 }));
    function Retry() {
      const s = useContent<{ year: number }>('contests/8007.json');
      if (s.status === 'error') return <button onClick={s.retry}>retry</button>;
      return <p>{s.status === 'ready' ? `ready ${s.data.year}` : s.status}</p>;
    }
    render(<Retry />);
    const button = await screen.findByText('retry');
    button.click();
    await waitFor(() => expect(screen.getByText('ready 8007')).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('a null path is missing and fetches nothing', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<Probe path={null} />);
    expect(screen.getByText('missing')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('on the server: reads the bundle, records what it read, never fetches', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const collector = createContentCollector();
    const html = renderToString(
      <ContentProvider collector={collector}>
        <Probe path="contests/2026.json" />
        <Probe path="contests/1066.json" />
      </ContentProvider>,
    );
    expect(html).toContain('ready 2026');
    expect(html).toContain('missing');
    expect(Object.keys(collector.files)).toEqual(['contests/2026.json']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

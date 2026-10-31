// usePageContent(docId, { optional: true }) on the client when
// content/pages/index.json cannot be read (not deployed yet, a network
// error): it falls back to requesting the doc itself.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { usePageContent } from '@/lib/cms/usePageContent';
import { LocaleProvider } from '@/lib/seo/LocaleContext';

vi.mock('../../src/lib/seo/contentData', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/lib/seo/contentData')>();
  return { ...real, bundledContent: (path: string) => (path === 'pages/index.json' ? undefined : real.bundledContent(path)) };
});

afterEach(() => vi.restoreAllMocks());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function Optional({ docId }: { docId: string }) {
  const s = usePageContent<{ title: string }>(docId, { optional: true });
  return <p>{s.status === 'ready' ? `ready ${s.data.title}` : s.status}</p>;
}

describe('optional page doc without a readable index', () => {
  it('is loading while the index loads, then requests the doc when the index fails', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/pages/index.json') ? json({}, 500) : json({ en: { title: 'Fallback' }, el: { title: 'Φ' } }));
    render(<LocaleProvider locale="en"><Optional docId="archive-1070" /></LocaleProvider>);
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('ready Fallback')).toBeInTheDocument());
    expect(fetchSpy.mock.calls.map((c) => String(c[0]))).toEqual(['/content/pages/index.json', '/content/pages/archive-1070.json']);
  });
});

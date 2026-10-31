import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { usePageContent } from '@/lib/cms/usePageContent';
import { PageContentOverrideProvider } from '@/lib/cms/PageContentOverride';
import { LocaleProvider } from '@/lib/seo/LocaleContext';
import { getCachedContent, seedContent } from '@/lib/seo/contentCache';
import type { Locale } from '@/lib/seo/locale';

interface Doc { title: string }

function Probe({ docId }: { docId: string }) {
  const s = usePageContent<Doc>(docId);
  return <p>{s.status === 'ready' ? `ready ${s.data.title}` : s.status}</p>;
}

class Catch extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() { return this.state.error ? <p>caught {this.state.error.message}</p> : this.props.children; }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PageContentOverrideProvider', () => {
  it('serves the override slice synchronously instead of the cache, without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const published = { en: { title: 'Published' }, el: { title: 'Δημοσιευμένο' } };
    seedContent({ 'pages/__ovr.json': published });
    const draft = { en: { title: 'Draft' }, el: { title: 'Πρόχειρο' } };
    const at = (locale: Locale) => (
      <LocaleProvider locale={locale}>
        <PageContentOverrideProvider docId="__ovr" doc={draft}><Probe docId="__ovr" /></PageContentOverrideProvider>
      </LocaleProvider>
    );
    const { rerender } = render(at('en'));
    expect(screen.getByText('ready Draft')).toBeInTheDocument();
    rerender(at('el'));
    expect(screen.getByText('ready Πρόχειρο')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    // The shared cache still holds the published copy, untouched.
    expect(getCachedContent('pages/__ovr.json')).toBe(published);
  });

  it('never fetches the overridden doc even when it is not cached', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <LocaleProvider locale="en">
        <PageContentOverrideProvider docId="__uncached" doc={{ en: { title: 'Only draft' }, el: { title: 'x' } }}>
          <Probe docId="__uncached" />
        </PageContentOverrideProvider>
      </LocaleProvider>,
    );
    expect(screen.getByText('ready Only draft')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getCachedContent('pages/__uncached.json')).toBeUndefined();
  });

  it('leaves other docs on the normal path', () => {
    seedContent({ 'pages/__other.json': { en: { title: 'Other' }, el: { title: 'Άλλο' } } });
    render(
      <LocaleProvider locale="en">
        <PageContentOverrideProvider docId="__ovr2" doc={{ en: { title: 'Draft' }, el: { title: 'x' } }}>
          <Probe docId="__other" />
        </PageContentOverrideProvider>
      </LocaleProvider>,
    );
    expect(screen.getByText('ready Other')).toBeInTheDocument();
  });

  it('throws when the draft lacks the active locale (shown by the preview error boundary)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <LocaleProvider locale="el">
        <Catch>
          <PageContentOverrideProvider docId="__half" doc={{ en: { title: 'EN only' } }}>
            <Probe docId="__half" />
          </PageContentOverrideProvider>
        </Catch>
      </LocaleProvider>,
    );
    expect(screen.getByText(/caught .*no "el" content/)).toBeInTheDocument();
  });
});

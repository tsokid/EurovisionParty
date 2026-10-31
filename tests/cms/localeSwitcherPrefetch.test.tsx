import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { LocaleProvider } from '@/lib/seo/LocaleContext';
import { PreviewModeContext } from '@/lib/seo/PreviewMode';
import { prefetchOtherLocaleContent } from '@/lib/cms/prefetchPageContent';
import type { Locale } from '@/lib/seo/locale';

// The language switcher warms the other locale's slice of the current page's
// CMS doc when it is hovered, focused or opened, so switching renders at once.
// (Separate file: useContent's cache is module state, fresh per test file.)

// Hide these docs from the eager snapshot so the client fetch path runs.
const HIDDEN = new Set(['pages/faq.json', 'pages/rules.json', 'pages/about.json', 'pages/how-to-play.json']);
vi.mock('@/lib/seo/contentData', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/seo/contentData')>();
  return { ...real, bundledContent: (path: string) => (HIDDEN.has(path) ? undefined : real.bundledContent(path)) };
});

const pending = () => vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

function at(path: string, locale: Locale, preview = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PreviewModeContext.Provider value={preview}>
        <LocaleProvider locale={locale}>
          <LanguageSwitcher />
        </LocaleProvider>
      </PreviewModeContext.Provider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LanguageSwitcher prefetches the other locale of the current page', () => {
  it('hovering the trigger on /en/faq fetches pages/faq.json (once)', () => {
    const fetchSpy = pending();
    at('/en/faq', 'en');
    const trigger = screen.getByRole('button', { name: 'Change language' });
    fireEvent.mouseEnter(trigger);
    fireEvent.mouseEnter(trigger);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/content/pages/faq.json');
  });

  it('focusing the trigger prefetches (keyboard users)', () => {
    const fetchSpy = pending();
    at('/el/rules', 'el');
    fireEvent.focus(screen.getByRole('button', { name: 'Change language' }));
    expect(fetchSpy).toHaveBeenCalledWith('/content/pages/rules.json');
  });

  it('opening the switcher prefetches (touch: no hover)', () => {
    const fetchSpy = pending();
    at('/en/about', 'en');
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith('/content/pages/about.json');
  });

  it('does nothing off the registry, on /room, or in the admin preview', () => {
    const fetchSpy = pending();
    const a = at('/en/past-contests', 'en');
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Change language' }));
    a.unmount();
    const b = at('/room/ABCD', 'en');
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Change language' }));
    b.unmount();
    at('/en/how-to-play', 'en', true);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Change language' }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('prefetchOtherLocaleContent', () => {
  it('keys the prefetch on the other locale: a doc already cached with it is not refetched', async () => {
    const doc = { en: { title: 'How' }, el: { title: 'Πώς' } };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(doc), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    prefetchOtherLocaleContent('/en/how-to-play');
    expect(fetchSpy).toHaveBeenCalledWith('/content/pages/how-to-play.json');
    await fetchSpy.mock.results[0].value;
    await new Promise((r) => setTimeout(r, 0));
    prefetchOtherLocaleContent('/en/how-to-play');
    prefetchOtherLocaleContent('/el/how-to-play');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores paths that are not registry pages', () => {
    const fetchSpy = pending();
    prefetchOtherLocaleContent('/en/past-contests');
    prefetchOtherLocaleContent('/admin');
    prefetchOtherLocaleContent('https://example.com/en/faq');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

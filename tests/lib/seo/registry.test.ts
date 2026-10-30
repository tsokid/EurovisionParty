import { describe, it, expect } from 'vitest';
import { PAGE_REGISTRY, getPage, allPageUrls, type PageEntry } from '@/lib/seo/registry';
import { localizePath } from '@/lib/seo/locale';

describe('page registry', () => {
  it('contains the homepage', () => {
    const home = getPage('home');
    expect(home).toBeDefined();
    expect(home?.slugByLocale.en).toBe('/');
    expect(home?.slugByLocale.el).toBe('/');
  });

  it('every entry has en + el slugs', () => {
    for (const page of PAGE_REGISTRY) {
      expect(page.slugByLocale.en).toBeDefined();
      expect(page.slugByLocale.el).toBeDefined();
    }
  });

  it('allPageUrls returns localized URLs for every page', () => {
    const urls = allPageUrls();
    expect(urls.length).toBeGreaterThanOrEqual(PAGE_REGISTRY.length * 2);
    expect(urls).toContainEqual({ locale: 'en', path: '/en' });
    expect(urls).toContainEqual({ locale: 'el', path: '/el' });
  });

  it('no duplicate slugs within a locale', () => {
    const enSlugs = PAGE_REGISTRY.map((p) => p.slugByLocale.en);
    const elSlugs = PAGE_REGISTRY.map((p) => p.slugByLocale.el);
    expect(new Set(enSlugs).size).toBe(enSlugs.length);
    expect(new Set(elSlugs).size).toBe(elSlugs.length);
  });
  const REMOVED = ['eurovision-2026', 'eurovision-2026-schedule', 'eurovision-2026-semifinals', 'eurovision-2026-songs',
    'eurovision-quiz', 'host-eurovision-party', 'eurovision-history', 'eurovision-ellada', 'eurovision-kypros',
    'eurovision-2026-elliniko-tragoudi', 'eurovision-2026-programma', 'countries'];

  it('contains no unbuilt pages', () => {
    for (const id of REMOVED) expect(PAGE_REGISTRY.find((p) => p.id === id)).toBeUndefined();
  });

  it('no entry points at a removed hub', () => {
    for (const p of PAGE_REGISTRY) if (p.hub) expect(getPage(p.hub)).toBeDefined();
  });

  it('allPageUrls skips excluded locales', () => {
    const registry = [
      { id: 'home', slugByLocale: { en: '/', el: '/' }, priority: 1, changefreq: 'weekly' },
      { id: 'faq', slugByLocale: { en: '/gr-only', el: '/gr-only' }, priority: 0.5, changefreq: 'weekly', greekExclusive: true },
      { id: 'rules', slugByLocale: { en: '/en-only', el: '/en-only' }, priority: 0.5, changefreq: 'weekly', englishExclusive: true },
    ] as PageEntry[];
    const urls = allPageUrls(registry);
    expect(urls).not.toContainEqual({ locale: 'en', path: localizePath('en', '/gr-only') });
    expect(urls).toContainEqual({ locale: 'el', path: localizePath('el', '/gr-only') });
    expect(urls).not.toContainEqual({ locale: 'el', path: localizePath('el', '/en-only') });
    expect(urls).toContainEqual({ locale: 'en', path: localizePath('en', '/en-only') });
  });
});

describe('pageUrl', () => {
  it('returns the locale-prefixed canonical URL of a page', async () => {
    const { pageUrl } = await import('@/lib/seo/registry');
    expect(pageUrl('faq', 'en')).toBe('https://eurovision.games/en/faq');
    expect(pageUrl('faq', 'el')).toBe('https://eurovision.games/el/faq');
    expect(pageUrl('home', 'el')).toBe('https://eurovision.games/el');
    expect(pageUrl('eurovision-duels', 'en')).toBe('https://eurovision.games/en/duels');
  });
});

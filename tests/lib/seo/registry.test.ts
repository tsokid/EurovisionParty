import { describe, it, expect } from 'vitest';
import { PAGE_REGISTRY, getPage, allPageUrls } from '@/lib/seo/registry';

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
});

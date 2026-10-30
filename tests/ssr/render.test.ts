// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { MockInstance } from 'vitest';
import { render } from '@/entry-server';
import { allPageUrls } from '@/lib/seo/registry';
import { copy as faqCopy } from '@/pages/seo/content/faqCopy';
import { copy as homeCopy } from '@/pages/content/homeCopy';
import enJson from '@/i18n/locales/en.json';
import elJson from '@/i18n/locales/el.json';

describe('entry-server render', () => {
  let fetchSpy: MockInstance;

  beforeAll(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  it('renders every registry URL', async () => {
    const urls = allPageUrls();
    expect(urls.length).toBeGreaterThan(0);
    for (const { locale, path } of urls) {
      const r = await render(path);
      expect(r.status, path).toBe(200);
      expect(r.html.length, path).toBeGreaterThan(500);
      expect(r.head?.canonical, path).toBe('https://eurovision.games' + path);
      expect(r.lang, path).toBe(locale);
    }
  }, 60_000);

  it('JSON-LD page URLs (@id / url / item) are locale-prefixed like the canonical', async () => {
    const ORIGIN = 'https://eurovision.games';
    const bad: string[] = [];
    function walk(node: unknown, path: string, locale: string): void {
      if (Array.isArray(node)) return node.forEach((n) => walk(n, path, locale));
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        if ((k === '@id' || k === 'url' || k === 'item') && typeof v === 'string' && v.startsWith(ORIGIN)) {
          // Site-level identity (Organization url) and static assets (logo.png) are not pages.
          if (v === ORIGIN || /\.[a-z0-9]+$/i.test(v)) continue;
          if (!new RegExp(`^${ORIGIN}/${locale}(/|$)`).test(v)) bad.push(`${path} ${k}=${v}`);
        } else {
          walk(v, path, locale);
        }
      }
    }
    for (const { locale, path } of allPageUrls()) {
      const r = await render(path);
      walk(r.head?.jsonLd, path, locale);
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it('breadcrumb items point at the current locale', async () => {
    const r = await render('/el/faq');
    const blocks = [r.head?.jsonLd].flat() as Array<Record<string, unknown>>;
    const crumbs = blocks.find((b) => b['@type'] === 'BreadcrumbList') as { itemListElement: { item: string }[] };
    expect(crumbs.itemListElement.map((i) => i.item)).toEqual([
      'https://eurovision.games/el',
      'https://eurovision.games/el/faq',
    ]);
  });

  it('renders el after en without leaking language', async () => {
    await render('/en/faq');
    const el = await render('/el/faq');
    expect(el.html).toContain(faqCopy.el.hero.title);
    expect(el.lang).toBe('el');
    const en = await render('/en/faq');
    expect(en.html).toContain(faqCopy.en.hero.title);
    expect(en.lang).toBe('en');
  });

  it('home prerenders its static content while auth is loading', async () => {
    const en = await render('/en');
    expect(en.html).toContain(enJson.homeSeo.headline);
    expect(en.head?.title).toBe(homeCopy.en.meta.title);
    const el = await render('/el');
    expect(el.html).toContain(elJson.homeSeo.headline);
  });

  it('unknown locale path is 404', async () => {
    const r = await render('/en/no-such-page');
    expect(r.status).toBe(404);
  });

  it('404 page is noindex with no canonical (M4)', async () => {
    for (const url of ['/en/__404', '/el/__404']) {
      const r = await render(url);
      expect(r.status, url).toBe(404);
      expect(r.head?.robots, url).toBe('noindex');
      expect(r.head?.canonical, url).toBeUndefined();
    }
  });

  it('does not touch the network', () => {
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

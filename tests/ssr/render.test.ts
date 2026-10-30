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

  it('does not touch the network', () => {
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

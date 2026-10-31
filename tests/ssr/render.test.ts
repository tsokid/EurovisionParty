// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { MockInstance } from 'vitest';
import { render } from '@/entry-server';
import { allPageUrls, PAGE_REGISTRY } from '@/lib/seo/registry';
import { localizePath } from '@/lib/seo/locale';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import faqCopy from '../../content/pages/faq.json';
import homeDoc from '../../content/pages/home.json';
import { interpolate } from '../../supabase/functions/_shared/cms/placeholders';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import ContentProvider from '@/lib/seo/ContentProvider';
import { createContentCollector } from '@/lib/seo/contentContext';
import { LocaleProvider } from '@/lib/seo/LocaleContext';
import { usePageContent } from '@/lib/cms/usePageContent';
import { injectPage } from '../../scripts/prerender/injectPage';

// A test-only page document, injected into the SSR content map. None may be
// committed under content/pages as a fixture (validate-content checks every
// file there and the build publishes them).
const { FIXTURE_DOC } = vi.hoisted(() => ({
  FIXTURE_DOC: { en: { title: 'Fixture title' }, el: { title: 'Τίτλος δοκιμής' } },
}));
vi.mock('@/lib/seo/contentData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/seo/contentData')>();
  return {
    ...actual,
    bundledContent: (path: string) => (path === 'pages/__fixture.json' ? FIXTURE_DOC : actual.bundledContent(path)),
  };
});

function FixturePage({ docId }: { docId: string }) {
  const s = usePageContent<{ title: string }>(docId);
  return h('main', null, h('h1', null, s.status === 'ready' ? s.data.title : s.status));
}

function ssrPage(docId: string, locale: 'en' | 'el') {
  const collector = createContentCollector();
  const html = renderToString(
    h(ContentProvider, { collector }, h(LocaleProvider, { locale }, h(FixturePage, { docId }))),
  );
  return { html, content: collector.files };
}

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
    expect(en.html).toContain(homeDoc.en.seo.headline);
    expect(en.head?.title).toBe(interpolate(homeDoc.en.meta.title, { year: 2026 }));
    const el = await render('/el');
    expect(el.html).toContain(homeDoc.el.seo.headline);
  });

  it('unknown locale path is 404', async () => {
    const r = await render('/en/no-such-page');
    expect(r.status).toBe(404);
  });

  it('unknown params on the dynamic route patterns are 404', async () => {
    const urls = [
      '/en/eurovision-1800', '/en/eurovision-abc', '/en/no-such-page/schedule', '/el/eurovision-9999/songs',
      '/en/past-contests/eurovision-1800-nowhere', '/en/countries/atlantis', '/el/countries/atlantis',
      '/en/past-contests/x/y',
    ];
    for (const url of urls) {
      const r = await render(url);
      expect(r.status, url).toBe(404);
      expect(r.head?.robots, url).toBe('noindex');
    }
  });

  it('404 page is noindex with no canonical (M4)', async () => {
    for (const url of ['/en/__404', '/el/__404']) {
      const r = await render(url);
      expect(r.status, url).toBe(404);
      expect(r.head?.robots, url).toBe('noindex');
      expect(r.head?.canonical, url).toBeUndefined();
    }
  });

  it('/eurovision-predictions renders the live line-up (final ranking once finalized)', async () => {
    const en = await render('/en/eurovision-predictions');
    expect(en.status).toBe(200);
    expect(en.head?.canonical).toBe('https://eurovision.games/en/eurovision-predictions');
    expect(en.content['contests/2026.json']).toBeDefined();
    const lineup = /<section[^>]*id="lineup"[\s\S]*?<\/section>/.exec(en.html)?.[0] ?? '';
    // 2026 is finalized: places in order, Bulgaria first.
    expect(lineup).toMatch(/<td[^>]*>[\s\S]*?1[\s\S]*?<\/td>[\s\S]*?Bulgaria/);
    expect(lineup).toContain('516');
    expect(lineup.match(/<tr/g)!.length).toBe(36); // header + 35 countries
    const el = await render('/el/eurovision-predictions');
    expect(el.html).toContain('Βουλγαρία');
  });

  it('the old predictions slug is gone (301 comes with the redirects task)', async () => {
    expect((await render('/en/eurovision-2026-predictions')).status).toBe(404);
  });

  it('guide pages inline only site.json and their own CMS doc (predictions adds the contest file; winners its index)', async () => {
    // Static pages migrated to content/pages (their pageId is a CMS doc type) also inline that doc.
    const ownDoc = new Map<string, string>();
    for (const page of PAGE_REGISTRY) {
      if (!Object.prototype.hasOwnProperty.call(CMS_DOC_TYPES, page.id)) continue;
      for (const locale of ['en', 'el'] as const) ownDoc.set(localizePath(locale, page.slugByLocale[locale]), `pages/${page.id}.json`);
    }
    for (const { path } of allPageUrls()) {
      const r = await render(path);
      const files = Object.keys(r.content).sort();
      const own = ownDoc.has(path) ? [ownDoc.get(path)!] : [];
      if (path.endsWith('/eurovision-predictions')) expect(files, path).toEqual([...own, 'contests/2026.json', 'site.json'].sort());
      else if (path.endsWith('/winners')) expect(files, path).toEqual([...own, 'contests/index.json', 'site.json'].sort());
      else expect(files, path).toEqual([...own, 'site.json'].sort());
      // Only the active locale's slice of the page doc is inlined.
      if (own.length) expect(Object.keys(r.content[own[0]] as object), path).toEqual([path.slice(1, 3)]);
      expect(r.html, path).not.toContain('data-content-state');
    }
  }, 60_000);

  it('the nav links the renamed pages', async () => {
    for (const { path } of allPageUrls()) {
      expect((await render(path)).html, path).not.toContain('eurovision-2026-predictions');
    }
    const en = await render('/en/faq');
    expect(en.html).toContain('href="/en/eurovision-predictions"');
    expect(en.html).toContain('href="/en/past-contests"');
    expect(en.html).toContain('href="/en/countries"');
    expect(en.html).toContain('href="/en/winners"');
    const el = await render('/el/faq');
    for (const label of ['Προηγούμενοι διαγωνισμοί', 'Χώρες', 'Νικητές']) expect(el.html).toContain(label);
  }, 60_000);

  it('usePageContent: SSR reads pages/{docId}.json eagerly and the prerender inlines it', () => {
    const el = ssrPage('__fixture', 'el');
    expect(el.html).toContain('Τίτλος δοκιμής');
    expect(Object.keys(el.content)).toEqual(['pages/__fixture.json']);
    const shell = '<html lang="en"><head><!--seo:start--><!--seo:end--></head><body><div id="root"><!--app:start--><!--app:end--></div></body></html>';
    const out = injectPage(shell, { html: el.html, headHtml: '', lang: 'el', content: el.content });
    const inlined = /<script type="application\/json" id="__content__">(.*?)<\/script>/.exec(out)?.[1];
    // Only the rendered locale's slice: the other one is fetched on a locale switch.
    expect(JSON.parse(inlined ?? '{}')).toEqual({ 'pages/__fixture.json': { el: FIXTURE_DOC.el } });
    expect(ssrPage('__fixture', 'en').content).toEqual({ 'pages/__fixture.json': { en: FIXTURE_DOC.en } });
    expect(ssrPage('__fixture', 'en').html).toContain('Fixture title');
  });

  it('usePageContent: a missing page doc fails the server render (build failure)', () => {
    expect(() => ssrPage('__no-such-doc', 'en')).toThrow(/pages\/__no-such-doc\.json/);
  });

  it('does not touch the network', () => {
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

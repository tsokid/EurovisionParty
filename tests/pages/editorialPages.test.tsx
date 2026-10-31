// @vitest-environment node
// CMS 3c Task 6: the editorial layer on the archive-year, country and live
// hub pages, through the real prerender (entry-server render). Fixture docs
// are served by the content snapshot mock: nothing is committed to content/.
// Without a doc a page is byte-identical to before (dataPagesUnchanged, under
// CMS_MIGRATION_PROOF=1); here: it inlines no page doc and adds no JSON-LD.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { headTagsHtml } from '@/lib/seo/headTags';
import type { RenderResult } from '@/entry-server';

const docs = new Map<string, unknown>();

vi.mock('../../src/lib/seo/contentData', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/lib/seo/contentData')>();
  return { ...real, bundledContent: (path: string) => (docs.has(path) ? docs.get(path) : real.bundledContent(path)) };
});

const IMG = { media: '/media/0123456789ab.webp', alt: 'The stage in Kyiv', width: 1600, height: 900 };

const editorial = (lang: 'en' | 'el', extra: Record<string, unknown> = {}) => ({
  intro: lang === 'en' ? 'Kyiv hosted **the 50th** contest. See [the winners](/winners).' : 'Το Κίεβο φιλοξένησε τον **50ό** διαγωνισμό.',
  image: { ...IMG, alt: lang === 'en' ? 'The stage in Kyiv' : 'Η σκηνή στο Κίεβο' },
  blocks: [
    { type: 'text', body: lang === 'en' ? 'Editorial block text.' : 'Κείμενο ενότητας.' },
    { type: 'faq', items: [{ q: lang === 'en' ? 'Who won in 2005?' : 'Ποιος κέρδισε το 2005;', a: lang === 'en' ? 'Greece, with **My Number One**.' : 'Η Ελλάδα.' }] },
  ],
  metaDescription: lang === 'en' ? 'Eurovision 2005 in Kyiv, told by us: the night Greece won.' : 'Eurovision 2005 στο Κίεβο: η νύχτα που κέρδισε η Ελλάδα.',
  ...extra,
});
const doc = (extra: Record<string, unknown> = {}) => ({ en: editorial('en', extra), el: editorial('el', extra) });

let render: (url: string) => Promise<RenderResult>;
beforeAll(async () => {
  ({ render } = await import('@/entry-server'));
  docs.set('pages/archive-2005.json', doc());
  docs.set('pages/country-gr.json', doc({ metaDescription: undefined }));
  docs.set('pages/country-ma.json', doc({ metaDescription: 'Morocco at Eurovision: one entry, 1980.' }));
  docs.set('pages/hub-2026.json', doc({ metaDescription: 'Eurovision 2026 in Vienna: our own guide to the week.' }));
}, 60_000); // the first entry-server import is slow under full-suite load

const ldTypes = (r: RenderResult) =>
  [...headTagsHtml(r.head!).matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => (JSON.parse(m[1]) as { '@type': string })['@type']);

describe('archive year page', () => {
  const URL = '/en/past-contests/eurovision-2005-kyiv';

  it('renders the intro under the hero, then the hero image (eager, high priority, sized), H1 first', async () => {
    const r = await render(URL);
    expect(r.status).toBe(200);
    const h1 = r.html.indexOf('<h1');
    const intro = r.html.indexOf('Kyiv hosted <strong');
    const img = r.html.indexOf('<img src="/media/0123456789ab.webp"');
    expect(h1).toBeGreaterThan(-1);
    expect(intro).toBeGreaterThan(h1);
    expect(img).toBeGreaterThan(intro);
    expect(intro).toBeLessThan(r.html.indexOf('id="winner"'));
    const tag = r.html.slice(img, r.html.indexOf('>', img) + 1);
    expect(tag).toContain('loading="eager"');
    expect(tag).toMatch(/fetchPriority="high"|fetchpriority="high"/);
    expect(tag).toContain('width="1600"');
    expect(tag).toContain('height="900"');
    expect(tag).toContain('alt="The stage in Kyiv"');
    expect(r.html).toContain('href="/en/winners"');
  });

  it('renders the blocks after the data tables and before the year navigation', async () => {
    const r = await render(URL);
    const block = r.html.indexOf('Editorial block text.');
    expect(block).toBeGreaterThan(r.html.indexOf('id="final"'));
    expect(block).toBeLessThan(r.html.lastIndexOf('<nav aria-label')); // the year navigation (the first is the breadcrumb)
    expect(r.html.lastIndexOf('<nav aria-label')).toBeGreaterThan(r.html.indexOf('id="final"'));
    expect(r.html.indexOf('Who won in 2005?')).toBeGreaterThan(block);
  });

  it('metaDescription replaces the templated description (meta and og); FAQ blocks add FAQPage JSON-LD', async () => {
    const r = await render(URL);
    const want = 'Eurovision 2005 in Kyiv, told by us: the night Greece won.';
    expect(r.head!.description).toBe(want);
    const head = headTagsHtml(r.head!);
    expect(head).toContain(`<meta name="description" content="${want}"`);
    expect(head).toContain(`<meta property="og:description" content="${want}"`);
    expect(ldTypes(r).filter((t) => t === 'FAQPage')).toHaveLength(1);
    const faq = headTagsHtml(r.head!).match(/"@type":"FAQPage"[\s\S]*?<\/script>/)![0];
    expect(faq).toContain('Who won in 2005?');
    expect(faq).toContain('Greece, with My Number One.');
  });

  it('JSON-LD order matches the static pages (mergeFaqJsonLd): FAQPage before the trailing BreadcrumbList', async () => {
    expect(ldTypes(await render(URL))).toEqual(['Event', 'ItemList', 'FAQPage', 'BreadcrumbList']);
    expect(ldTypes(await render('/en/countries/greece'))).toEqual(['FAQPage', 'BreadcrumbList']);
    expect(ldTypes(await render('/en/eurovision-2026'))).toEqual(['Event', 'FAQPage', 'BreadcrumbList']);
    // Without FAQ blocks nothing changes.
    expect(ldTypes(await render('/en/past-contests/eurovision-2004-istanbul'))).toEqual(['Event', 'ItemList', 'BreadcrumbList']);
  });

  it('inlines its own locale of the doc for hydration, nothing else new', async () => {
    const r = await render('/el/past-contests/eurovision-2005-kyiv');
    expect(r.content['pages/archive-2005.json']).toEqual({ el: editorial('el') });
    expect(Object.keys(r.content).filter((k) => k.startsWith('pages/'))).toEqual(['pages/archive-2005.json']);
    expect(r.html).toContain('Το Κίεβο φιλοξένησε');
  });

  it('a year without editorial inlines no page doc and adds no FAQPage; its description is the templated one', async () => {
    const r = await render('/en/past-contests/eurovision-2004-istanbul');
    expect(r.status).toBe(200);
    expect(Object.keys(r.content).filter((k) => k.startsWith('pages/'))).toEqual([]);
    expect(ldTypes(r)).not.toContain('FAQPage');
    expect(r.head!.description).not.toBe('Eurovision 2005 in Kyiv, told by us: the night Greece won.');
    expect(r.html).not.toContain('/media/');
  });

  it('editorial renders on a noindex page too (2005 is not indexable): indexable stays the owner\'s switch', async () => {
    const r = await render(URL);
    expect(r.head!.robots).toBeUndefined();
    expect(r.html).toContain('Kyiv hosted <strong');
  });
});

describe('country page', () => {
  it('renders the editorial on an indexable country; without metaDescription the templated description stays', async () => {
    const r = await render('/en/countries/greece');
    expect(r.status).toBe(200);
    expect(r.head!.robots).toBeUndefined();
    const intro = r.html.indexOf('Kyiv hosted <strong');
    expect(intro).toBeGreaterThan(r.html.indexOf('<h1'));
    expect(intro).toBeLessThan(r.html.indexOf('id="summary"'));
    const block = r.html.indexOf('Editorial block text.');
    expect(block).toBeGreaterThan(r.html.indexOf('id="history"'));
    // Greece has no related countries: the related link is "All countries".
    expect(block).toBeLessThan(r.html.lastIndexOf('href="/en/countries"', r.html.indexOf('<footer')));
    expect(r.head!.description).toBeTruthy();
    expect(r.head!.description).not.toContain('told by us');
    expect(ldTypes(r)).toContain('FAQPage');
  });

  it('renders the same on a noindex country, with its metaDescription', async () => {
    const r = await render('/en/countries/morocco');
    expect(r.head!.robots).toBe('noindex');
    expect(r.html).toContain('Kyiv hosted <strong');
    expect(r.head!.description).toBe('Morocco at Eurovision: one entry, 1980.');
  });

  it('a country without editorial inlines no page doc', async () => {
    const r = await render('/en/countries/andorra');
    expect(Object.keys(r.content).filter((k) => k.startsWith('pages/'))).toEqual([]);
    expect(ldTypes(r)).not.toContain('FAQPage');
  });
});

describe('live hub page', () => {
  it('renders the editorial: intro under the hero, blocks before the related cards, metaDescription', async () => {
    const r = await render('/en/eurovision-2026');
    expect(r.status).toBe(200);
    const intro = r.html.indexOf('Kyiv hosted <strong');
    expect(intro).toBeGreaterThan(r.html.indexOf('<h1'));
    expect(intro).toBeLessThan(r.html.indexOf('id="glance"'));
    const block = r.html.indexOf('Editorial block text.');
    expect(block).toBeGreaterThan(r.html.indexOf('id="glance"'));
    expect(block).toBeLessThan(r.html.indexOf('id="related-heading"'));
    expect(r.head!.description).toBe('Eurovision 2026 in Vienna: our own guide to the week.');
    expect(ldTypes(r)).toContain('FAQPage');
  });

  it('the hub subpages take no editorial', async () => {
    const r = await render('/en/eurovision-2026/songs');
    expect(r.html).not.toContain('Kyiv hosted');
    expect(Object.keys(r.content).filter((k) => k.startsWith('pages/'))).toEqual([]);
  });
});

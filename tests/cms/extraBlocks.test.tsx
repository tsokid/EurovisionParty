// @vitest-environment node
// CMS 3c Task 7: the optional `extraBlocks` zone of every static page. Absent
// (as in all 18 committed docs) it changes nothing; present it renders before
// the page's related/CTA section and its FAQ blocks join the page's JSON-LD.
import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import { emptyValue } from '../../supabase/functions/_shared/cms/emptyValue';
import { fieldMeta } from '../../supabase/functions/_shared/cms/fields';
import { mergeFaqJsonLd } from '../../src/components/cms/extraFaq';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';

const PAGES = resolve(__dirname, '../../content/pages');
const STATIC_IDS = readdirSync(PAGES)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .map((f) => f.slice(0, -'.json'.length))
  .sort();

// Pages can only be given extraBlocks by overriding the eager content snapshot.
const overrides = vi.hoisted(() => ({ docs: new Map<string, unknown>() }));
vi.mock('../../src/lib/seo/contentData', async (importActual) => {
  const actual = await importActual<typeof import('../../src/lib/seo/contentData')>();
  return { ...actual, bundledContent: (p: string) => (overrides.docs.has(p) ? overrides.docs.get(p) : actual.bundledContent(p)) };
});

const FAQ_BLOCK = { type: 'faq', items: [{ q: 'Is it extra?', a: 'Yes, **really** extra.' }] };
const TEXT_BLOCK = { type: 'text', body: 'ExtraTextMarker paragraph.' };

describe('extraBlocks in every static page schema', () => {
  it('there are 18 static docs', () => {
    expect(STATIC_IDS).toHaveLength(18);
  });

  it.each(STATIC_IDS)('%s: optional blocks field; absent is valid and not added to a new draft', (id) => {
    const type = docTypeFor(id);
    const shape = (CMS_DOC_TYPES[type].schema as unknown as { shape: Record<string, never> }).shape;
    expect(fieldMeta(shape.extraBlocks)).toMatchObject({ kind: 'blocks', optional: true });
    expect(Object.keys(emptyValue(CMS_DOC_TYPES[type].schema) as object)).not.toContain('extraBlocks');
    const raw = JSON.parse(readFileSync(resolve(PAGES, `${id}.json`), 'utf8')) as { en: object; el: object };
    expect(Object.keys(raw.en)).not.toContain('extraBlocks');
    expect(validateDocument(type, raw).ok).toBe(true);
    const withBlocks = { en: { ...raw.en, extraBlocks: [TEXT_BLOCK, FAQ_BLOCK] }, el: { ...raw.el, extraBlocks: [TEXT_BLOCK, FAQ_BLOCK] } };
    expect(validateDocument(type, withBlocks).ok).toBe(true);
    const bad = { en: { ...raw.en, extraBlocks: [{ type: 'nope' }] }, el: raw.el };
    expect(validateDocument(type, bad).ok).toBe(false);
  });
});

describe('mergeFaqJsonLd', () => {
  const crumbs = { '@type': 'BreadcrumbList' };
  const article = { '@type': 'Article' };
  const faqPage = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Own?' }] };

  it('returns the same list when there are no blocks or no FAQ blocks', () => {
    const ld = [article, crumbs];
    expect(mergeFaqJsonLd(ld, undefined)).toBe(ld);
    expect(mergeFaqJsonLd(ld, [])).toBe(ld);
    expect(mergeFaqJsonLd(ld, [TEXT_BLOCK] as never)).toBe(ld);
  });

  it('adds one FAQPage before the breadcrumb when the page has none', () => {
    const out = mergeFaqJsonLd([article, crumbs], [FAQ_BLOCK] as never);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(article);
    expect(out[2]).toBe(crumbs);
    expect(out[1]).toMatchObject({ '@type': 'FAQPage', mainEntity: [{ name: 'Is it extra?', acceptedAnswer: { text: 'Yes, really extra.' } }] });
  });

  it("merges into the page's existing FAQPage instead of adding a second", () => {
    const out = mergeFaqJsonLd([article, faqPage, crumbs], [FAQ_BLOCK] as never) as Array<Record<string, unknown>>;
    expect(out.filter((o) => o['@type'] === 'FAQPage')).toHaveLength(1);
    expect((out[1].mainEntity as unknown[]).map((q) => (q as { name: string }).name)).toEqual(['Own?', 'Is it extra?']);
    expect(faqPage.mainEntity).toHaveLength(1); // input untouched
  });
});

describe('rendering extraBlocks', { timeout: 60_000 }, () => {
  type Ld = { '@type': string; mainEntity?: { name: string }[] };
  async function page(url: string) {
    const { render } = await import('../../src/entry-server');
    const r = await render(url);
    const { headTagsHtml } = await import('../../src/lib/seo/headTags');
    const head = headTagsHtml(r.head!);
    const jsonLd = [...head.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as Ld);
    return { html: r.html, jsonLd };
  }
  const withExtra = (id: string, blocks: unknown[]) => {
    const raw = JSON.parse(readFileSync(resolve(PAGES, `${id}.json`), 'utf8')) as { en: object; el: object };
    overrides.docs.set(`pages/${id}.json`, { en: { ...raw.en, extraBlocks: blocks }, el: { ...raw.el, extraBlocks: blocks } });
  };

  it('about: renders the blocks before the related cards and adds one FAQPage', async () => {
    withExtra('about', [TEXT_BLOCK, FAQ_BLOCK]);
    const { html, jsonLd } = await page('/en/about');
    overrides.docs.clear();
    const at = html.indexOf('ExtraTextMarker');
    expect(at).toBeGreaterThan(-1);
    expect(html.indexOf('Is it extra?')).toBeGreaterThan(at);
    const about = JSON.parse(readFileSync(resolve(PAGES, 'about.json'), 'utf8')) as { en: { cta: { title: string }; related: { title: string }[] } };
    const cta = html.indexOf(about.en.cta.title.replace(/&/g, '&amp;'));
    expect(cta).toBeGreaterThan(html.indexOf('Is it extra?'));
    expect(html.indexOf(about.en.related[0].title.replace(/&/g, '&amp;'))).toBeGreaterThan(cta);
    expect(jsonLd.filter((j) => j['@type'] === 'FAQPage')).toHaveLength(1);
  });

  it("faq: the page's own FAQPage gets the extra questions (still one FAQPage)", async () => {
    withExtra('faq', [FAQ_BLOCK]);
    const { jsonLd } = await page('/en/faq');
    overrides.docs.clear();
    const faqs = jsonLd.filter((j) => j['@type'] === 'FAQPage');
    expect(faqs).toHaveLength(1);
    const names = faqs[0].mainEntity!.map((q) => q.name);
    expect(names[names.length - 1]).toBe('Is it extra?');
    expect(names.length).toBeGreaterThan(1);
  });

  it('every static page renders its extra text and ends with exactly one FAQPage', async () => {
    for (const p of PAGE_REGISTRY) {
      const url = p.id === 'home' ? '/en' : `/en${p.slugByLocale.en}`;
      withExtra(p.id, [TEXT_BLOCK, FAQ_BLOCK]);
      const { html, jsonLd } = await page(url);
      overrides.docs.clear();
      expect(html, url).toContain('ExtraTextMarker paragraph.');
      expect(jsonLd.filter((j) => j['@type'] === 'FAQPage').length, url).toBe(1);
      expect(jsonLd.flatMap((j) => (j['@type'] === 'FAQPage' ? j.mainEntity! : [])).some((q) => q.name === 'Is it extra?'), url).toBe(true);
    }
    withExtra('not-found', [TEXT_BLOCK, FAQ_BLOCK]);
    const nf = await page('/en/__404');
    overrides.docs.clear();
    expect(nf.html).toContain('ExtraTextMarker paragraph.');
    expect(nf.jsonLd.filter((j) => j['@type'] === 'FAQPage')).toHaveLength(1);
  }, 120_000);
});

describe('no extraBlocks: nothing changes', () => {
  it('the committed docs hold none (content bytes stay as they were)', () => {
    for (const id of STATIC_IDS) expect(readFileSync(resolve(PAGES, `${id}.json`), 'utf8'), id).not.toContain('extraBlocks');
  });
});

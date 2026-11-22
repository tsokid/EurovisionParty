// @vitest-environment node
// CMS P6, owner decision Q4 = B: the section-based pages are a list of their
// own sections with design-system blocks between them. Editors reorder,
// remove and add; the SEO-critical parts (hero H1, breadcrumbs, the JSON-LD
// sources) never leave the page.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import { fieldAt } from '../../supabase/functions/_shared/cms/walk';
import { defaultLayout } from '../../supabase/functions/_shared/cms/fields';
import { layoutSections, upgradeDocument } from '../../supabase/functions/_shared/cms/layoutUpgrade';
import { migrateLayouts } from '../../scripts/cms/migrate-layout';
import { effectiveLayout, layoutBlocks } from '../../src/components/cms/PageSections';

const PAGES = resolve(__dirname, '../../content/pages');
const LAYOUT_PAGES = ['about', 'cookies', 'dashboard', 'eurovision-duels', 'eurovision-games', 'eurovision-party', 'eurovision-trivia', 'privacy', 'terms'];

const overrides = vi.hoisted(() => ({ docs: new Map<string, unknown>() }));
vi.mock('../../src/lib/seo/contentData', async (importActual) => {
  const actual = await importActual<typeof import('../../src/lib/seo/contentData')>();
  return { ...actual, bundledContent: (p: string) => (overrides.docs.has(p) ? overrides.docs.get(p) : actual.bundledContent(p)) };
});

type Slice = Record<string, unknown> & { layout?: unknown[] };
const published = (id: string) => JSON.parse(readFileSync(resolve(PAGES, `${id}.json`), 'utf8')) as { en: Slice; el: Slice };
const withLayout = (id: string, layout: unknown[]) => {
  const d = published(id);
  return { en: { ...d.en, layout }, el: { ...d.el, layout } };
};

describe('layout schemas', () => {
  it('exactly the section-based pages have a layout', () => {
    const withOne = Object.keys(CMS_DOC_TYPES).filter((t) => layoutSections(t));
    expect(withOne.sort()).toEqual(LAYOUT_PAGES);
  });

  it.each(LAYOUT_PAGES)('%s: every section names fields its schema has; the FAQ list behind a FAQPage is locked', (id) => {
    const schema = CMS_DOC_TYPES[id].schema;
    const sections = layoutSections(id)!;
    for (const s of sections) {
      expect(fieldAt(schema, s.title), `${id} ${s.key} title`).toBeDefined();
      for (const f of s.fields) expect(fieldAt(schema, f), `${id} ${s.key} ${f}`).toBeDefined();
    }
    const hasFaqList = fieldAt(schema, 'faq') !== undefined;
    if (hasFaqList) expect(sections.find((s) => s.fields.includes('faq'))?.locked, id).toBe(true);
    // The H1 and breadcrumbs are outside the layout.
    expect(sections.flatMap((s) => s.fields).some((f) => /^(hero|breadcrumbs|crumbs|meta)(\.|$)/.test(f))).toBe(false);
  });

  it.each(LAYOUT_PAGES)('%s: the committed doc has no layout and validates; its default layout validates too', (id) => {
    const doc = published(id);
    expect('layout' in doc.en).toBe(false);
    expect(validateDocument(id, doc).ok).toBe(true);
    expect(validateDocument(id, withLayout(id, defaultLayout(layoutSections(id)!))).ok).toBe(true);
  });
});

describe('layout validation', () => {
  const sections = (id: string) => defaultLayout(layoutSections(id)!);
  const errors = (id: string, layout: unknown[]) => validateDocument(id, withLayout(id, layout)).errors.map((e) => e.message);

  it('reorders, removes an unlocked section and adds blocks with ids', () => {
    const s = sections('about');
    const layout = [s[2], { type: 'text', id: 'b-intro', body: 'Hello' }, s[0], { type: 'callout', id: 'b-note', tone: 'info', body: 'Note' }, ...s.slice(3)];
    expect(errors('about', layout)).toEqual([]);
  });

  it('a locked section (the FAQ behind the FAQPage) cannot be removed', () => {
    const s = sections('eurovision-games').filter((x) => x.key !== 'faq');
    expect(errors('eurovision-games', s)).toContain('The section "faq" feeds the search-engine data (JSON-LD) and cannot be removed');
  });

  it('no section twice, no empty page, no duplicate block ids', () => {
    const s = sections('terms');
    expect(errors('terms', [...s, s[0]])).toContain('The section "whoWeAre" is already on the page');
    expect(errors('terms', [])).toContain('The page needs at least one section or block');
    const twins = [...s, { type: 'text', id: 'b-x', body: 'a' }, { type: 'text', id: 'b-x', body: 'b' }];
    expect(errors('terms', twins)).toContain('Two blocks have the same id: duplicate the block again');
  });

  it('both languages hold the same order (the layout is locale-shared)', () => {
    const s = sections('privacy');
    const d = published('privacy');
    const doc = { en: { ...d.en, layout: s }, el: { ...d.el, layout: [s[1], s[0], ...s.slice(2)] } };
    expect(validateDocument('privacy', doc).ok).toBe(false);
  });
});

describe('the data migration (extraBlocks → layout)', () => {
  it('folds extraBlocks after the sections, per locale, and leaves a doc without them untouched', () => {
    const d = published('about');
    expect(upgradeDocument('about', d)).toBe(d);
    const old = { en: { ...d.en, extraBlocks: [{ type: 'text', body: 'x' }] }, el: { ...d.el, extraBlocks: [{ type: 'text', body: 'ξ' }] } };
    const up = upgradeDocument('about', old) as { en: Slice; el: Slice };
    expect('extraBlocks' in up.en).toBe(false);
    expect(up.en.layout).toEqual([...defaultLayout(layoutSections('about')!), { type: 'text', body: 'x' }]);
    expect(up.el.layout!.at(-1)).toEqual({ type: 'text', body: 'ξ' });
    expect(validateDocument('about', up).ok).toBe(true);
    // An empty zone just goes; a page without a layout keeps its extraBlocks.
    const empty = upgradeDocument('about', { en: { ...d.en, extraBlocks: [] }, el: d.el }) as { en: Slice };
    expect('layout' in empty.en || 'extraBlocks' in empty.en).toBe(false);
    const faq = published('faq');
    expect(upgradeDocument('faq', faq)).toBe(faq);
  });

  it('the committed files need no change (nothing to migrate, bytes kept)', () => {
    expect(migrateLayouts(PAGES, false)).toEqual([]);
  });
});

describe('PageSections helpers', () => {
  it('no layout: the sections in page order; unknown sections are skipped', () => {
    expect(effectiveLayout(undefined, ['a', 'b'])).toEqual([{ type: 'section', key: 'a' }, { type: 'section', key: 'b' }]);
    expect(effectiveLayout([{ type: 'section', key: 'zz' }, { type: 'section', key: 'b' }], ['a', 'b'])).toEqual([{ type: 'section', key: 'b' }]);
    expect(layoutBlocks([{ type: 'section', key: 'a' }, { type: 'faq', items: [] }])).toEqual([{ type: 'faq', items: [] }]);
  });
});

describe('rendering a layout', { timeout: 60_000 }, () => {
  async function page(url: string) {
    const { render } = await import('../../src/entry-server');
    const r = await render(url);
    const { headTagsHtml } = await import('../../src/lib/seo/headTags');
    const head = headTagsHtml(r.head!);
    const jsonLd = [...head.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as { '@type': string });
    return { html: r.html, jsonLd };
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

  it('about: sections in the new order, a removed one gone, blocks where they were put; the H1 stays first', async () => {
    const d = published('about');
    const s = defaultLayout(layoutSections('about')!);
    const layout = [s[3], { type: 'text', id: 'b-1', body: 'LayoutMarker one.' }, s[0], s[1], s[2], s[4], { type: 'faq', id: 'b-2', items: [{ q: 'Layout question?', a: 'Yes.' }] }];
    overrides.docs.set('pages/about.json', withLayout('about', layout));
    const { html, jsonLd } = await page('/en/about');
    overrides.docs.clear();
    const title = (k: string) => html.indexOf(`>${esc((d.en[k] as { title: string }).title)}</h2>`);
    const h1 = html.indexOf('<h1');
    expect(h1).toBeGreaterThan(-1);
    expect(title('freeNoAccount')).toBeGreaterThan(h1);
    expect(html.indexOf('LayoutMarker one.')).toBeGreaterThan(title('freeNoAccount'));
    expect(title('whatIs')).toBeGreaterThan(html.indexOf('LayoutMarker one.'));
    expect(title('whatIs')).toBeLessThan(title('why'));
    expect(title('builtBy')).toBe(-1);
    expect(html.indexOf('Layout question?')).toBeGreaterThan(title('ebu'));
    expect(jsonLd.filter((j) => j['@type'] === 'FAQPage')).toHaveLength(1);
    // The "on this page" menu follows the layout: the first entry is the section placed first.
    const toc = html.indexOf('href="#s1"');
    expect(html.slice(toc, toc + 200)).toContain(esc((d.en.freeNoAccount as { title: string }).title));
  });
});

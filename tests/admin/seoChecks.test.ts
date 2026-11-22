// CMS P6, spec §4.1: the per-page SEO checks (pure part).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { blockingChecks, knownRoutes, resolvesInternally, seoChecks, type KnownRoutes, type SeoCheck } from '../../src/admin/seo/seoChecks';
import type { DomAudit } from '../../src/admin/seo/domAudit';
import { auditDom } from '../../src/admin/seo/domAudit';

const copy = new Proxy({}, { get: (_t, k) => (...a: unknown[]) => `${String(k)}${a.length ? `(${a.join(',')})` : ''}` }) as never;
const routes: KnownRoutes = { liveYear: 2027, archived: new Map([[2026, 'vienna']]), countrySlugs: new Set(['greece']) };
const faq = JSON.parse(readFileSync(resolve(__dirname, '../../content/pages/faq.json'), 'utf8'));
const okAudit: DomAudit = { h1: ['FAQ'], images: [], links: [{ href: '/en/rules', rel: '', text: 'Rules' }], ids: [] };

const run = (over: Partial<Parameters<typeof seoChecks>[0]> = {}) =>
  seoChecks({ docType: 'faq', doc: faq, duplicates: [], incomplete: {}, audits: { en: okAudit, el: okAudit }, routes, copy, ...over });
const find = (cs: SeoCheck[], id: string, locale: string | null = 'en') => cs.find((c) => c.id === id && c.locale === locale)!;

describe('seoChecks', () => {
  it('the published FAQ passes every blocking check', () => {
    expect(blockingChecks(run())).toEqual([]);
    expect(find(run(), 'title').count).toMatchObject({ min: 30, max: 60 });
    expect(find(run(), 'description').count).toMatchObject({ min: 70, max: 160 });
  });

  it('title: empty blocks, outside 30–60 warns; duplicates across the site block', () => {
    const doc = (title: string) => ({ ...faq, en: { ...faq.en, meta: { ...faq.en.meta, title } } });
    expect(find(run({ doc: doc('') }), 'title').severity).toBe('block');
    expect(find(run({ doc: doc('Short') }), 'title').severity).toBe('warn');
    expect(find(run({ doc: doc('x'.repeat(61)) }), 'title').severity).toBe('warn');
    const dup = run({ duplicates: [{ locale: 'en', path: 'meta.title', message: 'Same SEO title as "rules"' }] });
    expect(find(dup, 'title').severity).toBe('block');
  });

  it('{placeholders} are counted filled in', () => {
    const doc = { ...faq, en: { ...faq.en, meta: { ...faq.en.meta, title: 'Eurovision {year} party game FAQ and quick answers' } } };
    expect(find(run({ doc, vars: { en: { year: 2027 } } }), 'title').count!.length).toBe('Eurovision 2027 party game FAQ and quick answers'.length);
  });

  it('description: a duplicate or an empty one blocks; length outside 70–160 warns', () => {
    const doc = (description: string) => ({ ...faq, el: { ...faq.el, meta: { ...faq.el.meta, description } } });
    expect(find(run({ doc: doc('') }), 'description', 'el').severity).toBe('block');
    expect(find(run({ doc: doc('Λίγα') }), 'description', 'el').severity).toBe('warn');
    expect(find(run({ duplicates: [{ locale: 'el', path: 'meta.description', message: 'x' }] }), 'description', 'el').severity).toBe('block');
  });

  it('H1: none or two block; images without alt block; until the page is read, the DOM checks are pending (and hold Publish)', () => {
    expect(find(run({ audits: { en: { ...okAudit, h1: [] }, el: okAudit } }), 'h1').severity).toBe('block');
    expect(find(run({ audits: { en: { ...okAudit, h1: ['A', 'B'] }, el: okAudit } }), 'h1').severity).toBe('block');
    const imgs = run({ audits: { en: { ...okAudit, images: [{ src: '/a.webp', alt: '' }, { src: '/b.webp', alt: 'B' }] }, el: okAudit } });
    expect(find(imgs, 'images')).toMatchObject({ severity: 'block', items: ['/a.webp'] });
    const pending = run({ audits: { en: okAudit } });
    expect(find(pending, 'h1', 'el').severity).toBe('pending');
    expect(blockingChecks(pending).map((c) => c.id)).toEqual(['h1', 'images', 'links']);
  });

  it('hreflang: a language with errors or missing translations blocks the pair', () => {
    expect(find(run({ incomplete: { el: 2 } }), 'hreflang', null).severity).toBe('block');
    expect(find(run(), 'hreflang', null).severity).toBe('ok');
  });

  it('links: a broken internal link blocks; external and nofollow warn; the slug is info', () => {
    const audit = (links: DomAudit['links']): DomAudit => ({ ...okAudit, links });
    expect(find(run({ audits: { en: audit([{ href: '/en/nope', rel: '', text: '' }]), el: okAudit } }), 'links')).toMatchObject({ severity: 'block', items: ['/en/nope'] });
    expect(find(run({ audits: { en: audit([{ href: 'https://example.org', rel: 'noopener', text: '' }]), el: okAudit } }), 'links').severity).toBe('warn');
    expect(find(run({ audits: { en: audit([{ href: '/en/rules', rel: 'nofollow', text: '' }]), el: okAudit } }), 'links').severity).toBe('warn');
    expect(find(run({ canonical: { en: 'https://eurovision.games/en/faq' } }), 'slug')).toMatchObject({ severity: 'info' });
  });
});

describe('resolvesInternally', () => {
  const ids = new Set(['s1']);
  it.each([
    ['/en/faq', true], ['/el/faq#join', true], ['/en/faq#nope', false], ['/faq', true], ['/eurovision-predictions', true],
    ['/en/eurovision-2027', true], ['/en/eurovision-2027/songs', true], ['/en/eurovision-2027/bogus', false], ['/en/eurovision-2026', true],
    ['/en/eurovision-2031', false], ['/en/past-contests/eurovision-2026-vienna', true], ['/en/past-contests/eurovision-2026-basel', false],
    ['/el/countries/greece', true], ['/el/countries/atlantis', false], ['/en/?action=create', true], ['#s1', true], ['#s9', false],
    ['https://eurovision.games/en/rules', true], ['mailto:hello@eurovision.games', null], ['https://example.org/x', null], ['javascript:x', false],
  ] as const)('%s → %s', (href, expected) => {
    expect(resolvesInternally(href, 'en', routes, ids)).toBe(expected);
  });

  it('knownRoutes reads the content indexes (an archived year is not the live hub)', () => {
    const r = knownRoutes({ current_year: 2027 }, { 2026: { stage: 'archived', city_slug: 'vienna' }, 2027: { stage: 'current', city_slug: 'burgas' } }, { greece: {} });
    expect(r).toEqual({ liveYear: 2027, archived: new Map([[2026, 'vienna']]), countrySlugs: new Set(['greece']) });
  });
});

describe('auditDom', () => {
  it('reads h1s, images with their alt, the page links (not the header or footer) and ids', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <header class="topbar"><a href="/en/broken-but-chrome">x</a><img src="/logo.png" alt="logo"></header>
      <h1> Title </h1><section id="s1"><a href="/en/rules" rel="nofollow">Rules</a><img src="/a.webp"></section>
      <footer class="footer"><a href="/en/also-chrome">y</a></footer>`;
    expect(auditDom(root)).toEqual({
      h1: ['Title'],
      images: [{ src: '/logo.png', alt: 'logo' }, { src: '/a.webp', alt: null }],
      links: [{ href: '/en/rules', rel: 'nofollow', text: 'Rules' }],
      ids: ['s1'],
    });
  });
});

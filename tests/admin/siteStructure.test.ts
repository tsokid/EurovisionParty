// The admin's Site tree mirrors the links coded in SiteHeader/SiteFooter
// until P2 makes them CMS documents; this fails when the two drift. Also the
// admin URL helpers (paths.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';
import { FOOTER_COLUMNS, HEADER_DOC_IDS, pageGroups, pagesInNoMenu, sitePagePath } from '../../src/admin/siteStructure';
import { SITE_PAGES } from '../../src/admin/modules/pages/sitePages';
import { adminPaths, parseContestRoute, screenKey } from '../../src/admin/paths';

const source = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');
const bySlug = new Map(PAGE_REGISTRY.map((p) => [p.slugByLocale.en, p.id as string]));

/** Registry pages a source links to: `to: '/x'`, `href: '/x'`, `to="/x"` (anchors dropped). */
function linkedPages(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b(?:to|href)\s*[:=]\s*["'](\/[^"'#]*)/g)) {
    const id = bySlug.get(m[1]);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

describe('admin site structure', () => {
  it('header pages match SiteHeader.tsx (the logo is home)', () => {
    expect([...linkedPages(source('src/components/seo/SiteHeader.tsx'))].sort()).toEqual([...HEADER_DOC_IDS].sort());
  });

  it('footer columns match SiteFooter.tsx, column by column', () => {
    const text = source('src/components/seo/SiteFooter.tsx');
    const columns = text.split(/<Column\b/).slice(1);
    expect(columns).toHaveLength(FOOTER_COLUMNS.length);
    columns.forEach((col, i) => {
      expect(linkedPages(col), FOOTER_COLUMNS[i].key).toEqual([...FOOTER_COLUMNS[i].docIds]);
    });
  });

  it('"Not in any menu" is /eurovision-party today', () => {
    expect(pagesInNoMenu()).toEqual(['eurovision-party']);
  });

  it('every site page doc is in at least one group, and every grouped id is a site page doc', () => {
    const grouped = new Set(pageGroups().flatMap((g) => g.docIds));
    const docs = SITE_PAGES.map((p) => p.docId);
    expect(docs.filter((d) => !grouped.has(d))).toEqual([]);
    expect([...grouped].filter((d) => !docs.includes(d))).toEqual([]);
  });

  it('public paths of page docs come from the registry; the 404 page has none', () => {
    expect(sitePagePath('eurovision-duels')).toBe('/duels');
    expect(sitePagePath('home')).toBe('/');
    expect(sitePagePath('not-found')).toBeNull();
  });
});

describe('admin paths', () => {
  it('builds the URL map', () => {
    expect(adminPaths.contests()).toBe('/admin/contests');
    expect(adminPaths.contests(2027)).toBe('/admin/contests/2027');
    expect(adminPaths.contests(2027, 'entries')).toBe('/admin/contests/2027/entries');
    expect(adminPaths.contests(2027, 'entries', 'SE')).toBe('/admin/contests/2027/entries/SE');
    expect(adminPaths.pages('faq')).toBe('/admin/pages/faq');
    expect(adminPaths.footer('how-to-play')).toBe('/admin/footer/how-to-play');
    expect(adminPaths.parser(2026)).toBe('/admin/game/parser/2026');
    expect(adminPaths.winners('a b')).toBe('/admin/game/winners/a%20b');
  });

  it('parses contest routes', () => {
    expect(parseContestRoute(undefined)).toEqual({ year: null, section: 'details', iso: null, valid: true });
    expect(parseContestRoute('2027')).toEqual({ year: 2027, section: 'details', iso: null, valid: true });
    expect(parseContestRoute('2027/entries/se')).toEqual({ year: 2027, section: 'entries', iso: 'SE', valid: true });
    expect(parseContestRoute('20x7').valid).toBe(false);
    expect(parseContestRoute('2027/other').valid).toBe(false);
    expect(parseContestRoute('2027/entries/SE/more').valid).toBe(false);
  });

  it('screen keys group a contest year, and nothing else', () => {
    expect(screenKey('/admin/contests/2027/entries/SE')).toBe('/admin/contests/2027');
    expect(screenKey('/admin/contests/2027/entries')).toBe('/admin/contests/2027');
    expect(screenKey('/admin/contests/2027/')).toBe('/admin/contests/2027');
    expect(screenKey('/admin/contests')).toBe('/admin/contests');
    expect(screenKey('/admin/pages/faq')).toBe('/admin/pages/faq');
  });
});

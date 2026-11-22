// The admin's Site tree, read from the published header and footer docs
// (content/pages/site-header.json, site-footer.json). Also the admin URL
// helpers (paths.ts).
import { describe, it, expect } from 'vitest';
import { footerColumns, headerDocIds, linkedPageIds, pageGroups, pagesInNoMenu, sitePagePath } from '../../src/admin/siteStructure';
import { SITE_PAGES } from '../../src/admin/modules/pages/sitePages';
import { adminPaths, FOOTER_COLUMN_KEYS, parseContestRoute, screenKey } from '../../src/admin/paths';

describe('admin site structure', () => {
  it('header pages come from the header doc (the logo is home); /rules stays in the header', () => {
    expect(headerDocIds()).toEqual(['home', 'eurovision-night', 'eurovision-trivia', 'eurovision-predictions', 'rules', 'scoring', 'faq']);
  });

  it('footer columns come from the footer doc, in the Stage order', () => {
    const cols = footerColumns();
    expect(cols.map((c) => c.key)).toEqual([...FOOTER_COLUMN_KEYS]);
    expect(cols.map((c) => c.docIds)).toEqual([
      ['about', 'eurovision-games', 'cookies'],
      ['how-to-play', 'eurovision-trivia', 'eurovision-duels', 'eurovision-predictions', 'dashboard', 'rules'],
      ['winners'],
      ['faq', 'scoring', 'privacy', 'terms'],
    ]);
  });

  it('hidden links do not count as being in a menu', () => {
    expect(linkedPageIds([
      { target: { kind: 'page', pageId: 'faq' }, hidden: true },
      { children: [{ label: 'x', target: { kind: 'page', pageId: 'rules' }, hidden: true }, { label: 'y', target: { kind: 'page', pageId: 'about' } }] },
      { target: { kind: 'dynamic', key: 'hub' } },
    ])).toEqual(['about']);
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

// @vitest-environment node
// The site-wide docs (Track 3 P2): site-header, site-footer, site-settings.
// Their schemas, the link targets (page ids, never typed URLs) and how a
// target becomes a path.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import { SITE_PAGE_IDS, SITE_WIDE_DOC_IDS, targetKey } from '../../supabase/functions/_shared/cms/siteLinks';
import { linkText, resolveLinks, targetPath } from '../../src/lib/cms/siteChrome';

const read = (id: string) => JSON.parse(readFileSync(resolve(__dirname, `../../content/pages/${id}.json`), 'utf8'));
const clone = <T,>(v: T): T => structuredClone(v);
type AnyDoc = { en: Record<string, any>; el: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const messages = (id: string, doc: unknown) => {
  const r = validateDocument(id, doc);
  return r.ok ? [] : r.errors.map((e) => `${e.locale}:${e.path}: ${e.message}`);
};

describe('site-wide doc types', () => {
  it('are registered as sitewide, one doc each', () => {
    for (const id of SITE_WIDE_DOC_IDS) expect(CMS_DOC_TYPES[id]?.group, id).toBe('sitewide');
  });

  it('link targets can name exactly the registry pages', () => {
    expect([...SITE_PAGE_IDS].sort()).toEqual(PAGE_REGISTRY.map((p) => p.id).sort());
  });

  it('the committed docs validate', () => {
    for (const id of SITE_WIDE_DOC_IDS) expect(messages(id, read(id)), id).toEqual([]);
  });

  it('/rules is in the header menu and the footer, as shipped', () => {
    const header = read('site-header') as AnyDoc;
    const footer = read('site-footer') as AnyDoc;
    const menu = header.en.items.find((i: { children?: unknown[] }) => i.children);
    expect(menu.children.map((c: { target: { pageId: string } }) => c.target.pageId)).toContain('rules');
    expect(footer.en.columns[1].links.map((l: { target: { pageId: string } }) => l.target.pageId)).toContain('rules');
  });
});

describe('header and footer validation', () => {
  it('refuses an empty label, in either language', () => {
    const doc = clone(read('site-footer')) as AnyDoc;
    doc.el.columns[0].links[0].label = '  ';
    expect(messages('site-footer', doc).join('\n')).toMatch(/el:columns\.0\.links\.0\.label: Required/);
  });

  it('refuses the same page twice in one column, but allows it in two columns', () => {
    const doc = clone(read('site-footer')) as AnyDoc;
    for (const l of ['en', 'el'] as const) doc[l].columns[0].links.push(clone(doc[l].columns[0].links[0]));
    expect(messages('site-footer', doc).join('\n')).toMatch(/columns\.0\.links\.3\.target: This page is already in this list/);
    // /rules is in both "How to play" columns of header and footer: fine.
    expect(messages('site-footer', read('site-footer'))).toEqual([]);
  });

  it('an anchor on the same page is a different destination', () => {
    expect(targetKey({ kind: 'page', pageId: 'faq' })).not.toBe(targetKey({ kind: 'page', pageId: 'faq', anchor: 'join' }));
  });

  it('refuses a typed URL for a page, a missing page and an unknown page id', () => {
    const doc = clone(read('site-footer')) as AnyDoc;
    for (const l of ['en', 'el'] as const) doc[l].columns[0].links[0].target = { kind: 'page', href: '/about' };
    const m = messages('site-footer', doc).join('\n');
    expect(m).toMatch(/Pick a page/);
    expect(m).toMatch(/Not used by a page link/);
    for (const l of ['en', 'el'] as const) doc[l].columns[0].links[0].target = { kind: 'page', pageId: 'nope' };
    expect(messages('site-footer', doc).join('\n')).toMatch(/pageId/);
  });

  it('allows web addresses in the footer only, https:// only', () => {
    const footer = clone(read('site-footer')) as AnyDoc;
    for (const l of ['en', 'el'] as const) footer[l].columns[0].links.push({ label: 'X', target: { kind: 'external', href: 'https://example.org' } });
    expect(messages('site-footer', footer)).toEqual([]);
    for (const l of ['en', 'el'] as const) footer[l].columns[0].links[3].target.href = 'http://example.org';
    expect(messages('site-footer', footer).join('\n')).toMatch(/https/);

    const header = clone(read('site-header')) as AnyDoc;
    for (const l of ['en', 'el'] as const) header[l].items.push({ label: 'X', target: { kind: 'external', href: 'https://example.org' } });
    expect(messages('site-header', header).join('\n')).toMatch(/items\.3\.target\.kind/);
  });

  it('targets and their order are shared by both languages', () => {
    const doc = clone(read('site-header')) as AnyDoc;
    doc.el.items[1].target = { kind: 'page', pageId: 'about' };
    expect(messages('site-header', doc).join('\n')).toMatch(/el:items\.1\.target: must equal the en value/);
  });

  it('only an FAQ link can name a question', () => {
    const doc = clone(read('site-footer')) as AnyDoc;
    for (const l of ['en', 'el'] as const) doc[l].columns[0].links[0].target = { kind: 'page', pageId: 'about', anchor: 'join' };
    expect(messages('site-footer', doc).join('\n')).toMatch(/Only an FAQ link/);
  });

  it('a header item is a link or a menu', () => {
    const doc = clone(read('site-header')) as AnyDoc;
    for (const l of ['en', 'el'] as const) delete doc[l].items[1].target;
    expect(messages('site-header', doc).join('\n')).toMatch(/Pick a page, or make it a menu/);
  });

  it('settings need an email and https:// images', () => {
    const doc = clone(read('site-settings')) as AnyDoc;
    for (const l of ['en', 'el'] as const) { doc[l].contactEmail = 'nope'; doc[l].defaultOgImage = '/logo.png'; }
    const m = messages('site-settings', doc).join('\n');
    expect(m).toMatch(/Not an email address/);
    expect(m).toMatch(/defaultOgImage: Must be an https/);
  });
});

describe('link targets → paths', () => {
  it('resolves pages, anchors, contest pages and addresses', () => {
    expect(targetPath({ kind: 'page', pageId: 'eurovision-duels' }, 'en', 2026)).toBe('/duels');
    expect(targetPath({ kind: 'page', pageId: 'faq', anchor: 'leave' }, 'el', 2026)).toBe('/faq#leave');
    expect(targetPath({ kind: 'dynamic', key: 'hub' }, 'en', 2027)).toBe('/eurovision-2027');
    expect(targetPath({ kind: 'dynamic', key: 'hub' }, 'en', null)).toBeNull();
    expect(targetPath({ kind: 'dynamic', key: 'pastContests' }, 'en', null)).toBe('/past-contests');
    expect(targetPath({ kind: 'dynamic', key: 'countries' }, 'en', null)).toBe('/countries');
    expect(targetPath({ kind: 'external', href: 'https://x.org' }, 'en', null)).toBe('https://x.org');
  });

  it('leaves out hidden links and links with nowhere to go; fills {year}', () => {
    const links = resolveLinks([
      { label: 'Eurovision {year}', target: { kind: 'dynamic', key: 'hub' } },
      { label: 'About', target: { kind: 'page', pageId: 'about' }, hidden: true },
      { label: 'FAQ', target: { kind: 'page', pageId: 'faq' } },
    ], 'en', 2026);
    expect(links.map((l) => [l.label, l.to])).toEqual([['Eurovision 2026', '/eurovision-2026'], ['FAQ', '/faq']]);
    expect(resolveLinks([{ label: 'Hub', target: { kind: 'dynamic', key: 'hub' } }], 'en', null)).toEqual([]);
    expect(linkText('Eurovision {year}', null)).toBe('Eurovision ');
  });
});

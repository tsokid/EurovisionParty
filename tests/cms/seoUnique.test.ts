// @vitest-environment node
// I2: titles and meta descriptions must be unique per locale across the
// static pages (scripts/seo/checkPrerender.ts fails the build otherwise).
// seoFields() names the paths once, from the seoTitle()/metaDescription()
// metadata; seoDuplicates() is the check both Publish and the editor run.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import { fieldMeta } from '../../supabase/functions/_shared/cms/fields';
import { metaDescription, seoTitle } from '../../supabase/functions/_shared/cms/schemas/common';
import { seoDuplicates, seoFields } from '../../supabase/functions/_shared/cms/seo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = { en: any; el: any };
const SITE = Object.entries(CMS_DOC_TYPES).filter(([, d]) => d.group === 'site').map(([id]) => id);
const page = (id: string) => JSON.parse(readFileSync(resolve(process.cwd(), `content/pages/${id}.json`), 'utf8')) as Doc;
const committed = () => Object.fromEntries(SITE.map((id) => [id, page(id)])) as Record<string, Doc>;

describe('seoFields', () => {
  it('seoTitle() and metaDescription() carry the seo marker; an explicit seo: false drops it', () => {
    expect(fieldMeta(seoTitle()).seo).toBe('title');
    expect(fieldMeta(metaDescription()).seo).toBe('description');
    expect(fieldMeta(seoTitle({ label: 'Schema title', seo: false })).seo).toBeUndefined();
  });

  it('every site page has exactly one title and one description: meta.title and meta.description', () => {
    for (const id of SITE) expect(seoFields(id), id).toEqual({ title: 'meta.title', description: 'meta.description' });
  });

  it('is null for an unknown doc type', () => {
    expect(seoFields('nope')).toBeNull();
  });
});

describe('seoDuplicates', () => {
  it('the committed pages have no duplicates', () => {
    expect(seoDuplicates(committed(), SITE)).toEqual([]);
  });

  it('a title copied from another page is an error on the changed doc, naming the other, per locale', () => {
    const docs = committed();
    docs.about.en.meta.title = docs.faq.en.meta.title;
    const issues = seoDuplicates(docs, ['about']);
    expect(issues).toEqual([
      { doc_id: 'about', locale: 'en', path: 'meta.title', message: expect.stringContaining('"faq"') },
    ]);
    expect(issues[0].message).toMatch(/title/i);
  });

  it('descriptions too, compared after trimming, and in el independently', () => {
    const docs = committed();
    docs.rules.el.meta.description = `  ${docs.terms.el.meta.description} `;
    expect(seoDuplicates(docs, ['rules'])).toEqual([
      { doc_id: 'rules', locale: 'el', path: 'meta.description', message: expect.stringContaining('"terms"') },
    ]);
  });

  it('two changed docs that collide each get an error naming the other', () => {
    const docs = committed();
    docs.about.en.meta.title = 'Same';
    docs.faq.en.meta.title = 'Same';
    const issues = seoDuplicates(docs, ['about', 'faq']);
    expect(issues.map((i) => [i.doc_id, i.path])).toEqual([['about', 'meta.title'], ['faq', 'meta.title']]);
    expect(issues[0].message).toContain('"faq"');
    expect(issues[1].message).toContain('"about"');
  });

  it('a duplicate between two unchanged docs is not reported (this publish did not cause it)', () => {
    const docs = committed();
    docs.about.en.meta.title = docs.faq.en.meta.title;
    expect(seoDuplicates(docs, ['rules'])).toEqual([]);
  });

  it('a different locale with the same text is fine, and malformed values are skipped', () => {
    const docs = committed();
    docs.about.el.meta.title = docs.faq.en.meta.title;
    docs.rules.en.meta = 42;
    delete (docs as Record<string, unknown>).terms;
    (docs as Record<string, unknown>).stray = { en: { meta: { title: docs.faq.en.meta.title } }, el: {} };
    expect(seoDuplicates(docs, ['about', 'rules', 'stray'])).toEqual([]);
  });
});

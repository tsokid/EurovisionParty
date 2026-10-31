// @vitest-environment node
// CMS 3c Task 6: the editorial layer of the data pages. archive-{year},
// country-{iso} and hub-{year} share one schema; content/pages/index.json
// lists which editorial docs exist.
import { describe, it, expect } from 'vitest';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import { emptyValue } from '../../supabase/functions/_shared/cms/emptyValue';
import { fieldMeta } from '../../supabase/functions/_shared/cms/fields';
import { seoFields } from '../../supabase/functions/_shared/cms/seo';
import {
  editorialDocId, editorialFamily, isEditorialDocId, pagesIndex, readPagesIndex,
} from '../../supabase/functions/_shared/cms/pagesIndex';

const TYPES = ['archive-editorial', 'country-editorial', 'hub-editorial'] as const;
const IMG = '/media/0123456789ab.webp';

const doc = (en: unknown, el: unknown = en) => ({ en, el });

describe('editorial doc types', () => {
  it('are registered for the three families, one schema, grouped for the admin', () => {
    for (const t of TYPES) expect(Object.keys(CMS_DOC_TYPES)).toContain(t);
    expect(CMS_DOC_TYPES['archive-editorial'].schema).toBe(CMS_DOC_TYPES['country-editorial'].schema);
    expect(CMS_DOC_TYPES['hub-editorial'].schema).toBe(CMS_DOC_TYPES['archive-editorial'].schema);
    expect(CMS_DOC_TYPES['archive-editorial'].group).toBe('contest');
    expect(CMS_DOC_TYPES['country-editorial'].group).toBe('country');
    expect(CMS_DOC_TYPES['hub-editorial'].group).toBe('hub');
  });

  it('docTypeFor resolves each family', () => {
    expect(docTypeFor('archive-2005')).toBe('archive-editorial');
    expect(docTypeFor('country-GR')).toBe('country-editorial');
    expect(docTypeFor('hub-2026')).toBe('hub-editorial');
  });

  it('the schema is { intro: richText, image?: image, blocks, metaDescription?: metaDescription (soft 160) }', () => {
    const schema = CMS_DOC_TYPES['archive-editorial'].schema as unknown as { shape: Record<string, never> };
    expect(Object.keys(schema.shape).sort()).toEqual(['blocks', 'image', 'intro', 'metaDescription']);
    expect(fieldMeta(schema.shape.intro).kind).toBe('richText');
    expect(fieldMeta(schema.shape.image)).toMatchObject({ kind: 'image', optional: true });
    expect(fieldMeta(schema.shape.blocks).kind).toBe('blocks');
    expect(fieldMeta(schema.shape.metaDescription)).toMatchObject({ kind: 'text', optional: true, seo: 'description', softMaxLength: 160 });
  });

  it('the empty value (a new draft) validates: empty intro, no blocks', () => {
    const empty = emptyValue(CMS_DOC_TYPES['archive-editorial'].schema);
    expect(empty).toEqual({ intro: '', blocks: [] });
    expect(validateDocument('archive-editorial', doc(empty)).ok).toBe(true);
  });

  it('a full document validates; a bad intro or an unknown key does not', () => {
    const full = {
      intro: 'Kyiv **2005**: see [the winners](/winners).',
      image: { media: IMG, alt: 'Stage', width: 1600, height: 900 },
      blocks: [{ type: 'faq', items: [{ q: 'Who won?', a: 'Greece.' }] }],
      metaDescription: 'Eurovision 2005 in Kyiv: Helena Paparizou wins for Greece.',
    };
    expect(validateDocument('country-editorial', doc(full, { ...full, image: { ...full.image, alt: 'Σκηνή' } })).ok).toBe(true);
    expect(validateDocument('hub-editorial', doc({ ...full, intro: '[x](javascript:alert(1))' })).ok).toBe(false);
    expect(validateDocument('hub-editorial', doc({ ...full, extra: 1 })).ok).toBe(false);
  });

  it('seoFields resolves editorial docs through docTypeFor: a description, no title', () => {
    expect(seoFields('archive-editorial')).toEqual({ description: 'metaDescription' });
    expect(seoFields(docTypeFor('country-gr'))).toEqual({ description: 'metaDescription' });
  });
});

describe('pages index (content/pages/index.json)', () => {
  it('editorial ids: family prefix plus a non-empty key; static ids and the index are not', () => {
    expect(editorialFamily('archive-2005')).toBe('archive');
    expect(editorialFamily('country-gr')).toBe('country');
    expect(editorialFamily('hub-2026')).toBe('hub');
    expect(isEditorialDocId('faq')).toBe(false);
    expect(isEditorialDocId('index')).toBe(false);
    expect(isEditorialDocId('archive-')).toBe(false);
  });

  it('doc ids are lowercase (cms_documents.doc_id rule)', () => {
    expect(editorialDocId('archive', 2005)).toBe('archive-2005');
    expect(editorialDocId('country', 'GR')).toBe('country-gr');
    expect(editorialDocId('hub', 2026)).toBe('hub-2026');
  });

  it('pagesIndex lists the editorial ids only, sorted and unique', () => {
    expect(pagesIndex(['hub-2026', 'faq', 'archive-2005', 'country-gr', 'archive-2005', 'index'])).toEqual({
      editorial: ['archive-2005', 'country-gr', 'hub-2026'],
    });
    expect(pagesIndex([])).toEqual({ editorial: [] });
  });

  it('readPagesIndex accepts the shape and rejects anything else', () => {
    expect(readPagesIndex({ editorial: ['archive-2005'] })).toEqual(['archive-2005']);
    expect(readPagesIndex({ editorial: [1] })).toBeNull();
    expect(readPagesIndex(['archive-2005'])).toBeNull();
    expect(readPagesIndex(null)).toBeNull();
  });
});

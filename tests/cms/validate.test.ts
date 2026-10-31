// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { text, multiline, list, group } from '../../supabase/functions/_shared/cms/fields';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';

const schema = group({
  title: text({ label: 'Title', maxLength: 20, placeholders: ['year'] }),
  intro: multiline({ placeholders: ['count', 'year'] }),
  note: text({ required: false }),
  faq: list(group({ q: text(), a: multiline() })),
});

const page = (over: Record<string, unknown> = {}) => ({
  title: 'Eurovision {year}',
  intro: '{count} songs in {year}',
  note: '',
  faq: [{ q: 'Q?', a: 'A.' }],
  ...over,
});

const TYPE = '__test-page';

describe('validateDocument', () => {
  // The registry is empty until Tasks 4-6; register a fixture type for the test.
  CMS_DOC_TYPES[TYPE] = { schema, label: 'Test', group: 'site' };

  it('accepts a valid doc and returns the value', () => {
    const doc = { en: page(), el: page({ title: 'Γιουροβίζιον {year}' }) };
    const r = validateDocument(TYPE, doc);
    expect(r).toEqual({ ok: true, value: doc });
  });

  it('reports an empty required field in el with its path and locale', () => {
    const r = validateDocument(TYPE, { en: page(), el: page({ title: '  ' }) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual([{ path: 'title', locale: 'el', message: expect.stringMatching(/required/i) }]);
  });

  it('reports empty required fields inside lists with an indexed path', () => {
    const r = validateDocument(TYPE, { en: page({ faq: [{ q: 'Q?', a: '' }] }), el: page() });
    expect(!r.ok && r.errors).toEqual([{ path: 'faq.0.a', locale: 'en', message: expect.stringMatching(/required/i) }]);
  });

  it('allows an empty optional field', () => {
    expect(validateDocument(TYPE, { en: page({ note: '' }), el: page({ note: '' }) }).ok).toBe(true);
  });

  it('reports an unknown placeholder', () => {
    const r = validateDocument(TYPE, { en: page({ title: 'Eurovision {city}' }), el: page() });
    expect(!r.ok && r.errors).toEqual([{ path: 'title', locale: 'en', message: expect.stringContaining('{city}') }]);
  });

  it('accepts escaped braces in a field with no placeholders', () => {
    expect(validateDocument(TYPE, { en: page({ note: '{{year}}' }), el: page() }).ok).toBe(true);
  });

  it('enforces maxLength', () => {
    const r = validateDocument(TYPE, { en: page(), el: page({ title: 'x'.repeat(21) }) });
    expect(!r.ok && r.errors).toEqual([{ path: 'title', locale: 'el', message: expect.stringContaining('20') }]);
  });

  it('reports unknown keys (strict schemas)', () => {
    const r = validateDocument(TYPE, { en: page({ extra: 'x' }), el: page({ faq: [{ q: 'Q', a: 'A', z: 1 }] }) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual(expect.arrayContaining([
      { path: '', locale: 'en', message: expect.stringContaining('extra') },
      { path: 'faq.0', locale: 'el', message: expect.stringContaining('z') },
    ]));
    expect(r.errors).toHaveLength(2);
  });

  it('reports an unknown top-level key and a missing locale', () => {
    const r = validateDocument(TYPE, { en: page(), fr: page() });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ locale: 'el', path: '' }),
      expect.objectContaining({ message: expect.stringContaining('fr') }),
    ]));
  });

  it('reports wrong types and missing fields', () => {
    const { faq: _faq, ...noFaq } = page();
    const r = validateDocument(TYPE, { en: { ...noFaq }, el: page({ title: 5 }) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => `${e.locale}:${e.path}`).sort()).toEqual(['el:title', 'en:faq']);
  });

  it('rejects a non-object document', () => {
    expect(validateDocument(TYPE, 'nope').ok).toBe(false);
    expect(validateDocument(TYPE, null).ok).toBe(false);
  });

  it('rejects an unknown doc type', () => {
    const r = validateDocument('no-such-type', { en: {}, el: {} });
    expect(!r.ok && r.errors[0].message).toMatch(/unknown doc type/i);
  });
});

describe('docTypeFor', () => {
  it('maps static page ids to the same name and editorial ids to their family', () => {
    expect(docTypeFor('faq')).toBe('faq');
    expect(docTypeFor('how-to-play')).toBe('how-to-play');
    expect(docTypeFor('not-found')).toBe('not-found');
    expect(docTypeFor('archive-1956')).toBe('archive');
    expect(docTypeFor('country-GR')).toBe('country');
    expect(docTypeFor('hub-2026')).toBe('hub');
  });
});

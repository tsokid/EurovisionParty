// CMS P6: missing translations of a { en, el } document (the field, doc and
// tree flags all count with this).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { group, list, optional, text, href, choice } from '../../supabase/functions/_shared/cms/fields';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { missingTranslations, missingTranslationsOf } from '../../supabase/functions/_shared/cms/translations';

const schema = group({
  title: text(),
  tail: text({ required: false }),
  link: href(),
  tone: choice(['a', 'b']),
  note: optional(text()),
  items: list(group({ q: text(), a: text() })),
});

const full = { title: 'T', tail: '', link: '/faq', tone: 'a' as const, items: [{ q: 'Q', a: 'A' }] };

describe('missingTranslations', () => {
  it('nothing is missing when both languages are filled; shared fields never count', () => {
    expect(missingTranslations(schema, { en: full, el: { ...full, title: 'Τ', items: [{ q: 'Ε', a: 'Α' }] } })).toEqual({ en: [], el: [] });
  });

  it('a required field empty in one language, an optional one set only in the other, a may-be-empty field and a shorter free list never count', () => {
    const en = { ...full, tail: 'and more', note: 'Note', items: [{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }] };
    const el = { ...full, title: '  ', items: [{ q: 'Ε1', a: '' }] };
    expect(missingTranslations(schema, { en, el })).toEqual({ en: [], el: ['title', 'note', 'items.0.a'] });
  });

  it('every committed doc is fully translated (no flag shows today)', () => {
    for (const docType of Object.keys(CMS_DOC_TYPES)) {
      const file = resolve(__dirname, `../../content/pages/${docType}.json`);
      let doc: unknown;
      try {
        doc = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        continue; // editorial families have no file of their own
      }
      expect(missingTranslationsOf(docTypeFor(docType), doc), docType).toEqual({ en: [], el: [] });
    }
  });
});

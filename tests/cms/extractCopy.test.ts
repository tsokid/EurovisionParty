// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { group, list, text } from '../../supabase/functions/_shared/cms/fields';
import { interpolate } from '../../supabase/functions/_shared/cms/placeholders';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import {
  COPY_MAPPINGS, extractDocument, extractMapping, interpolateDocument, sentinel, templatedPaths,
} from '../../scripts/cms/extract-copy';

const ROOT = resolve(__dirname, '../..');
const readDoc = (docId: string) =>
  JSON.parse(readFileSync(resolve(ROOT, `content/pages/${docId}.json`), 'utf8')) as Record<'en' | 'el', unknown>;

describe('extractDocument (sentinel extraction)', () => {
  const schema = group({
    title: text({ placeholders: ['year'] }),
    plain: text(),
    items: list(group({ blurb: text({ placeholders: ['year', 'city'] }) })),
  });
  const S = { year: sentinel('year'), city: sentinel('city') };

  it('turns sentinels into placeholders in templated fields', () => {
    const out = extractDocument(schema, {
      en: { title: `Rules (${S.year})`, plain: 'Plain', items: [{ blurb: `${S.city} ${S.year}` }, { blurb: 'none' }] },
      el: { title: `Κανόνες (${S.year})`, plain: 'Απλό', items: [] },
    }, ['year', 'city']);
    expect(out).toEqual({
      en: { title: 'Rules ({year})', plain: 'Plain', items: [{ blurb: '{city} {year}' }, { blurb: 'none' }] },
      el: { title: 'Κανόνες ({year})', plain: 'Απλό', items: [] },
    });
  });

  it('escapes literal braces in templated fields so they render unchanged', () => {
    const out = extractDocument(schema, {
      en: { title: `{x} } {{ ${S.year}`, plain: 'a', items: [] },
      el: { title: 'b', plain: 'b', items: [] },
    }, ['year']) as { en: { title: string } };
    expect(out.en.title).toBe('{{x}} }} {{{{ {year}');
    expect(interpolate(out.en.title, { year: 2031 })).toBe('{x} } {{ 2031');
  });

  it('rejects a sentinel in a field that declares no placeholders', () => {
    expect(() => extractDocument(schema, {
      en: { title: 't', plain: `in ${S.year}`, items: [] },
      el: { title: 't', plain: 'p', items: [] },
    }, ['year'])).toThrow(/en\.plain.*\{year\}/);
  });

  it('rejects a placeholder the field does not allow', () => {
    expect(() => extractDocument(schema, {
      en: { title: `${S.city}`, plain: 'p', items: [] },
      el: { title: 't', plain: 'p', items: [] },
    }, ['year', 'city'])).toThrow(/en\.title.*\{city\}/);
  });

  it('rejects braces in a field without placeholders that would read as an escape or placeholder', () => {
    for (const plain of ['a {{ b', 'a }} b', 'a {name} b']) {
      expect(() => extractDocument(schema, {
        en: { title: 't', plain, items: [] },
        el: { title: 't', plain: 'p', items: [] },
      }, [])).toThrow(/en\.plain/);
    }
    // A lone brace is rendered raw and is fine.
    expect(() => extractDocument(schema, {
      en: { title: 't', plain: 'a { b }', items: [] },
      el: { title: 't', plain: 'p', items: [] },
    }, [])).not.toThrow();
  });

  it('rejects an unused sentinel left anywhere', () => {
    expect(() => extractDocument(schema, {
      en: { title: `${sentinel('cityIn')}`, plain: 'p', items: [] },
      el: { title: 't', plain: 'p', items: [] },
    }, ['year'])).toThrow(/sentinel/);
  });

  it('interpolateDocument renders templated fields only', () => {
    const doc = { en: { title: '{{{year}}}', plain: '{x}', items: [{ blurb: '{city}' }] }, el: { title: '', plain: '', items: [] } };
    expect(interpolateDocument(schema, doc, { year: 7, city: 'V' })).toEqual({
      en: { title: '{7}', plain: '{x}', items: [{ blurb: 'V' }] },
      el: { title: '', plain: '', items: [] },
    });
  });

  it('templatedPaths lists every field with placeholders', () => {
    expect(templatedPaths(schema)).toEqual(['title', 'items.*.blurb']);
  });
});

describe('content/pages (Task 4 group)', () => {
  const TASK4 = ['about', 'privacy', 'terms', 'cookies', 'dashboard', 'scoring', 'rules', 'faq'];

  it.each(TASK4)('%s.json exists, has a mapping, and validates', (docId) => {
    expect(COPY_MAPPINGS.some((m) => m.docId === docId)).toBe(true);
    expect(Object.keys(CMS_DOC_TYPES)).toContain(docTypeFor(docId));
    const r = validateDocument(docTypeFor(docId), readDoc(docId));
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('only rules is templated in this group', () => {
    const templated = TASK4.filter((id) => templatedPaths(CMS_DOC_TYPES[id].schema).length > 0);
    expect(templated).toEqual(['rules']);
    expect(templatedPaths(CMS_DOC_TYPES.rules.schema)).toEqual(['meta.title', 'schema.articleHeadline', 'related.items.*.blurb']);
  });

  // Pinned from the former rulesCopy.copy(contestTexts) with year 2031, before
  // the copy module was deleted. Byte-identical after interpolation.
  it('rules: every templated field renders exactly as the former template function', () => {
    const doc = interpolateDocument(CMS_DOC_TYPES.rules.schema, readDoc('rules'), { year: 2031 }) as Record<
      'en' | 'el',
      { meta: { title: string }; schema: { articleHeadline: string }; related: { items: { blurb: string }[] } }
    >;
    const pick = (l: 'en' | 'el') => [doc[l].meta.title, doc[l].schema.articleHeadline, doc[l].related.items.map((i) => i.blurb)];
    expect(pick('en')).toEqual([
      'Eurovision Games Rules — Full Rule Book (2031)',
      'Eurovision Games — Full Rule Book (2031)',
      [
        'Exact point math behind every prediction, quiz answer, and duel.',
        '60-second setup walkthrough from create-room to trophy reveal.',
        'Quick answers on creating rooms, joining, leaving, and disputes.',
        'Top 5 and Worst 5 mechanics with the 2031 country list.',
        'Head-to-head trivia rules, Steal vs Double, and trophy impact.',
        'Sample questions and the bank quiz/duels pull from.',
      ],
    ]);
    expect(pick('el')).toEqual([
      'Κανόνες Eurovision Games — Πλήρης Κανονισμός (2031)',
      'Eurovision Games — Πλήρης Κανονισμός (2031)',
      [
        'Ακριβή μαθηματικά πόντων για κάθε πρόβλεψη, απάντηση quiz και μονομαχία.',
        'Οδηγός εγκατάστασης 60 δευτερολέπτων από τη δημιουργία δωματίου μέχρι την αποκάλυψη τροπαίων.',
        'Σύντομες απαντήσεις για δημιουργία, είσοδο, αποχώρηση και διαφωνίες.',
        'Μηχανική Top 5 και Worst 5 με τη λίστα χωρών 2031.',
        'Κανόνες trivia ένας προς έναν, Κλοπή vs Διπλασιασμός και επίδραση στα τρόπαια.',
        'Ενδεικτικές ερωτήσεις και η τράπεζα από όπου τραβάνε quiz/μονομαχίες.',
      ],
    ]);
  });
});

// While a copy module still exists (Tasks 5-6 before their switch), the
// committed JSON must be exactly what extraction produces from it, and every
// template must round-trip for each sample.
describe('extraction matches the committed JSON while the copy module exists', () => {
  const live = COPY_MAPPINGS.filter((m) => existsSync(resolve(ROOT, m.module)));
  it.each(live.map((m) => [m.docId, m] as const))('%s', async (_id, m) => {
    const { json } = await extractMapping(m);
    expect(json).toBe(readFileSync(resolve(ROOT, `content/pages/${m.docId}.json`), 'utf8'));
  });
  it('lists every mapping whose module was deleted as migrated', () => {
    for (const m of COPY_MAPPINGS.filter((x) => !live.includes(x))) {
      expect(existsSync(resolve(ROOT, `content/pages/${m.docId}.json`))).toBe(true);
    }
  });
});

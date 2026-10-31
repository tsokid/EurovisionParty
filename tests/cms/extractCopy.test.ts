// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { group, list, text } from '../../supabase/functions/_shared/cms/fields';
import { interpolate } from '../../supabase/functions/_shared/cms/placeholders';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import {
  COPY_MAPPINGS, extractDocument, extractMapping, interpolateDocument, sentinel, templatedPaths,
} from '../../scripts/cms/extract-copy';
import { stableJson } from '../../scripts/history/import';
import type { EurovisionPredictionsContent } from '../../supabase/functions/_shared/cms/schemas/eurovision-predictions';
import type { WinnersContent } from '../../supabase/functions/_shared/cms/schemas/winners';
import type { ContestText } from '../../src/pages/seo/content/contestText';
import { predictionsText } from '../../src/pages/seo/predictionsText';
import { winnersText } from '../../src/pages/seo/winnersText';

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

describe('content/pages (Task 5 group: guides)', () => {
  const TASK5 = ['how-to-play', 'eurovision-night', 'eurovision-games', 'eurovision-party', 'eurovision-trivia', 'eurovision-duels'];
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');

  it.each(TASK5)('%s.json exists, has a mapping, and validates', (docId) => {
    expect(COPY_MAPPINGS.some((m) => m.docId === docId)).toBe(true);
    expect(Object.keys(CMS_DOC_TYPES)).toContain(docTypeFor(docId));
    const r = validateDocument(docTypeFor(docId), readDoc(docId));
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('templates exactly these fields', () => {
    const paths = Object.fromEntries(TASK5.map((id) => [id, templatedPaths(CMS_DOC_TYPES[id].schema)]));
    expect(paths).toEqual({
      'how-to-play': [],
      'eurovision-night': [
        'meta.title', 'meta.keywords.*', 'sections.what.bodyBefore', 'sections.what.bodyDate', 'sections.what.bodyAfter',
        'sections.playbook.steps.*.rest', 'faq.*.q', 'faq.*.a', 'related.items.*.blurb',
      ],
      'eurovision-games': ['meta.title', 'meta.headline', 'sections.predictions.p1'],
      'eurovision-party': ['meta.title', 'meta.description', 'meta.headline', 'meta.articleDescription', 'meta.eventName', 'meta.eventDescription'],
      'eurovision-trivia': [],
      'eurovision-duels': [],
    });
  });

  // Hashes of stableJson(former copy module rendered with PIN), taken before the
  // modules were deleted. Covers every field (templated or not) in both locales.
  const PIN = { year: 2033, city: 'Ζ{x}', cityFrom: 'from $& Ζ', finalDay: 'Day {{ 1', finalDayShort: 'Short }}' };
  const FORMER: Record<string, string> = {
    'how-to-play': 'a20d88fec1ff238aef547574665bf565aefaef4bae00afb5f115729fa7d4bda8',
    'eurovision-night': 'c72ceac0889bef21bc9e6b7edef620532bd56176d654c409da296792414ef69a',
    'eurovision-games': '180d6d81386327d1668906bbdfbc7012a0b131ee4b984db85a3dd6e67c4a16ee',
    'eurovision-party': 'dffc5671aca70349a14ab416caef2e2abc8e1697e795e46794dc6763f8023ec9',
    'eurovision-trivia': 'fb704540da76673d81c67f0c477a0e343912c84a1f97688c4971c4dc706fb19b',
    'eurovision-duels': '29545990fe23a7c395c6c2bd8752e8e401de053ceb029f97a9f4993e73359e3a',
  };
  it.each(TASK5)('%s renders exactly as the former copy module', (docId) => {
    const doc = interpolateDocument(CMS_DOC_TYPES[docId].schema, readDoc(docId), PIN);
    expect(sha(stableJson(doc))).toBe(FORMER[docId]);
  });

  it('eurovision-night: templated sentences render as the former template functions', () => {
    type Night = { faq: { q: string; a: string }[]; sections: { what: { bodyBefore: string; bodyDate: string; bodyAfter: string } } };
    const doc = interpolateDocument(CMS_DOC_TYPES['eurovision-night'].schema, readDoc('eurovision-night'), PIN) as Record<'en' | 'el', Night>;
    expect(doc.en.faq[3]).toEqual({
      q: 'When is Eurovision 2033?',
      a: 'The grand final airs on Day {{ 1 from $& Ζ, with semi-finals earlier that week. Start times vary by country (21:00 CET / 20:00 BST / 22:00 EET).',
    });
    expect(doc.el.faq[3].q).toBe('Πότε είναι η Eurovision 2033;');
    expect(doc.en.sections.what.bodyDate).toBe('Day {{ 1');
    expect(doc.en.sections.what.bodyBefore.endsWith('In 2033 the grand final airs on ')).toBe(true);
    expect(doc.el.sections.what.bodyAfter.startsWith(' from $& Ζ, με τους ημιτελικούς')).toBe(true);
  });

  it('eurovision-party: the event description renders as the former template function', () => {
    const doc = interpolateDocument(CMS_DOC_TYPES['eurovision-party'].schema, readDoc('eurovision-party'), PIN) as Record<'en' | 'el', { meta: { eventDescription: string } }>;
    expect(doc.en.meta.eventDescription).toBe(
      'Host a Eurovision watch party for the 2033 grand final on Short }}. Country-themed food, costumes, and a free scoring app for predictions, quiz, and duels.',
    );
    expect(doc.el.meta.eventDescription).toBe(
      'Διοργάνωσε βραδιά Eurovision για τον μεγάλο τελικό του 2033, Short }}. Φαγητό ανά χώρα, κοστούμια και μια δωρεάν εφαρμογή βαθμολογίας για προβλέψεις, quiz και μονομαχίες.',
    );
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

describe('content/pages (Task 6 group: data-mixed pages)', () => {
  const TASK6 = ['home', 'not-found', 'eurovision-predictions', 'winners'];
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');
  const L = ['en', 'el'] as const;

  it.each(TASK6)('%s.json exists, has a mapping, and validates', (docId) => {
    expect(COPY_MAPPINGS.some((m) => m.docId === docId)).toBe(true);
    expect(Object.keys(CMS_DOC_TYPES)).toContain(docTypeFor(docId));
    const r = validateDocument(docTypeFor(docId), readDoc(docId));
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('templates exactly these fields', () => {
    const paths = Object.fromEntries(TASK6.map((id) => [id, templatedPaths(CMS_DOC_TYPES[id].schema)]));
    expect(paths).toEqual({
      home: ['meta.title', 'meta.description', 'seo.leadRest'],
      'not-found': [],
      'eurovision-predictions': [
        'meta.description', 'meta.schemaDescription', 'meta.keywords.*', 'hero.lede', 'hero.ledeHost',
        'sections.lineup.title', 'sections.lineup.intro', 'sections.lineup.resultsTitle', 'sections.lineup.resultsIntro',
        'sections.lineup.empty', 'sections.lineup.hubLink',
      ],
      winners: [
        'meta.description', 'meta.keywords.*', 'sections.recent.title', 'sections.recent.intro', 'sections.recent.introCancelled',
        'sections.all.title',
      ],
    });
  });

  // The FORMER hashes below were taken from the former copy modules (and, for
  // home, the former i18n homeSeo keys) before they were deleted, rendered with
  // the same values: stableJson of everything each module produced, in both
  // locales. The JSON side renders the way the pages now do.

  it('home renders exactly as the former homeCopy meta and i18n homeSeo text', () => {
    const doc = interpolateDocument(CMS_DOC_TYPES.home.schema, readDoc('home'), { year: 2033 });
    expect(sha(stableJson(doc))).toBe('2a634f5e393315909b6f00f9fe8eda078d2c8fe2454eae1c5697def28fdf9b9a');
    expect((doc as Record<'en', { seo: { leadRest: string } }>).en.seo.leadRest).toBe(
      ' where 2-20 friends predict the Eurovision 2033 Top 5 and Worst 5, battle in trivia duels, and crown five winners — Champion, Thief, Duelist, Oracle, Guru. No download, no account.',
    );
  });

  it('not-found is exactly the former copy', () => {
    expect(sha(stableJson(readDoc('not-found')))).toBe('49cff2552e9b9a5eea5dcb9d44816ef91d09ad0bb012e015d0b0dc5b35cf43ff');
  });

  // Every branch of the former hero lede (decided or not, host known or not),
  // with values that look like template syntax.
  const P = { year: 2033, cityIn: 'στη Ζ{x}', finalDay: 'Day {{ 1', lineup: 37 };
  const ct = (decided: boolean, host: string): ContestText => ({
    ...P, city: 'X', cityFrom: 'X', host, finalDayShort: 'X', finalMonth: 'X', flag: 'X', decided,
  });
  const CONFIGS = [[false, ''], [true, ''], [false, 'Host $& }}'], [true, 'Χώρα {hostName}']] as const;

  it('eurovision-predictions renders exactly as the former copy, in every branch', () => {
    const doc = readDoc('eurovision-predictions') as Record<'en' | 'el', EurovisionPredictionsContent>;
    const rendered = CONFIGS.map(([d, h]) => Object.fromEntries(L.map((l) => [l, predictionsText(doc[l], ct(d, h))])));
    expect(sha(stableJson(rendered))).toBe('f9fd30c5b569982b972f96ceb0b560a4d1461eee22cabb96f2c7ebb7a877dd5c');
    expect(rendered[3].en.hero.lede.startsWith('Eurovision 2033 took place στη Ζ{x}, Χώρα {hostName}, with the grand final on Day {{ 1. In')).toBe(true);
    expect(rendered[2].el.hero.lede.startsWith('Η Eurovision 2033 διεξάγεται στη Ζ{x} (Host $& }}), με τον μεγάλο τελικό το Day {{ 1.')).toBe(true);
    expect(rendered[0].en.sections.lineup.intro).toBe('37 countries are confirmed for Eurovision 2033 across two semi-finals and the grand final:');
  });

  it('winnersText falls back to the hero chip and an empty intro while the index is not loaded', () => {
    const doc = readDoc('winners') as Record<'en' | 'el', WinnersContent>;
    const none = { last: null, from: null, to: null, first: null, cancelled: null };
    const t = winnersText(doc.en, none);
    expect(t.sections.recent.title).toBe(doc.en.hero.chip);
    expect(t.sections.recent.intro).toBe('');
    expect('introCancelled' in t.sections.recent).toBe(false);
  });

  it('winners renders exactly as the former template functions', () => {
    const doc = readDoc('winners') as Record<'en' | 'el', WinnersContent>;
    const ARGS = [
      { last: 2032, from: 2018, to: 2032, first: 1956, cancelled: 2020 },
      { last: 2031, from: 2017, to: 2031, first: 1957, cancelled: null },
    ];
    // faqTitle was added after the pin was taken (the heading used to live in
    // WinnersPage), so the pin covers everything the former module produced.
    const rendered = ARGS.map((a) => Object.fromEntries(L.map((l) => {
      const text = winnersText(doc[l], a);
      const { faqTitle, ...sections } = text.sections;
      expect(faqTitle).toBe(l === 'el' ? 'Συχνές ερωτήσεις' : 'Frequently asked questions');
      return [l, { ...text, sections }];
    })));
    expect(sha(stableJson(rendered))).toBe('053ffd85572ddb1c84751a7a96e2b151cfe93b365fed50b428a3a94c99c7ea29');
    expect(rendered[0].en.sections.recent.intro).toBe(
      'Winners since 2018, with the song, performing artist, and the combined jury + televote points from the grand final. (No 2020 — the contest was cancelled due to COVID.)',
    );
    expect(rendered[1].el.sections.recent.intro).toBe(
      'Νικητές από το 2017, με το τραγούδι, τον καλλιτέχνη, και τους συνολικούς πόντους από κριτική επιτροπή + televote στον μεγάλο τελικό.',
    );
  });
});

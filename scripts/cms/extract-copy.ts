/**
 * One-off migration (CMS 3a, spec §4): turns a page's former
 * src/pages/**\/content/*Copy.ts module into content/pages/{docId}.json.
 *
 *   npx tsx scripts/cms/extract-copy.ts [docId ...]
 *
 * Template functions are recovered by calling them with sentinel values
 * (`__year__`) and replacing each sentinel with its placeholder (`{year}`).
 * The doc type's schema decides which fields are templated: in those, literal
 * braces are escaped ({{ / }}) before the sentinels are replaced, so
 * interpolate() renders them unchanged. A field without placeholders must not
 * contain a sentinel, an escape or anything that reads as a placeholder.
 * Every mapping is then verified: for each sample, interpolating the extracted
 * document must give exactly what the copy module renders with those values.
 *
 * Once a page reads its JSON through usePageContent, its copy module is
 * deleted and the JSON is the source of truth: the mapping stays as a record,
 * and running the script for it reports "skipped".
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { z } from 'zod';
import { fieldMeta, schemaDef } from '../../supabase/functions/_shared/cms/fields';
import { interpolate, placeholdersIn } from '../../supabase/functions/_shared/cms/placeholders';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import { stableJson } from '../history/import';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

type Locale = 'en' | 'el';
type Vars = Record<string, string | number>;
type Doc = Record<Locale, unknown>;

export interface CopyMapping {
  docId: string;
  /** Copy module, relative to the repo root. */
  module: string;
  /** Placeholder names the module's template functions take (none: plain copy). */
  placeholders: string[];
  /** The { en, el } copy the module renders for `vars` (sentinels or sample values). */
  build: (mod: Record<string, unknown>, vars: Vars) => Doc;
  /** Real values to verify the round-trip with (templated mappings only). */
  samples: Vars[];
}

/** Sentinel standing in for placeholder `name` while extracting. */
export const sentinel = (name: string): string => `__${name}__`;
const SENTINEL = /__[a-zA-Z][a-zA-Z0-9]*__/;

const plainCopy = (mod: Record<string, unknown>): Doc => mod.copy as Doc;

const CONTEST_TEXT_KEYS = ['year', 'city', 'cityIn', 'cityFrom', 'host', 'finalDay', 'finalDayShort', 'finalMonth', 'flag', 'lineup'];

/**
 * ContestTexts with the mapping's placeholders taken from `vars` and every
 * other text a sentinel, so a use the mapping does not declare fails extraction.
 * `decided` is fixed (false): no migrated copy branches on it.
 */
function contestTextsFor(vars: Vars): Record<Locale, Record<string, unknown>> {
  const one = (): Record<string, unknown> => ({
    ...Object.fromEntries(CONTEST_TEXT_KEYS.map((k) => [k, Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : sentinel(k)])),
    decided: false,
  });
  return { en: one(), el: one() };
}

/** A copy module of the form `copy(contestTexts)`, templated on `placeholders`. */
const contestCopy = (docId: string, file: string, placeholders: string[], samples: Vars[]): CopyMapping => ({
  docId,
  module: `src/pages/seo/content/${file}.ts`,
  placeholders,
  build: (mod, vars) => (mod.copy as (t: unknown) => Doc)(contestTextsFor(vars)),
  samples,
});

/**
 * Round-trip samples: realistic values in both languages, plus one whose
 * values look like template syntax (braces, `$&`) to prove they are inserted
 * verbatim.
 */
const CONTEST_SAMPLES: Vars[] = [
  { year: 2031, city: 'Lisbon', cityFrom: 'from Lisbon', finalDay: 'Saturday 17 May 2031', finalDayShort: 'Saturday 17 May' },
  { year: 2032, city: 'Λισαβόνα', cityFrom: 'από τη Λισαβόνα', finalDay: 'Σάββατο 15 Μαΐου 2032', finalDayShort: 'ένα Σάββατο του Μαΐου' },
  { year: 1999, city: '{city}', cityFrom: '{{x}} $& }', finalDay: '{finalDay}', finalDayShort: '$1 {{' },
];
const samplesFor = (placeholders: string[]): Vars[] =>
  CONTEST_SAMPLES.map((s) => Object.fromEntries(placeholders.map((p) => [p, s[p]])));

const plain = (docId: string, file: string): CopyMapping => ({
  docId,
  module: `src/pages/seo/content/${file}.ts`,
  placeholders: [],
  build: plainCopy,
  samples: [],
});

const NIGHT_VARS = ['year', 'city', 'cityFrom', 'finalDay'];
const PARTY_VARS = ['year', 'finalDayShort'];

const LOCALES = ['en', 'el'] as const;
type Fn = (...args: unknown[]) => unknown;
const fn = (v: unknown): Fn => v as Fn;
const deepCopy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * home: the meta of the former homeCopy.ts (a function of the year) plus the
 * HomeSeoBlock text of the former i18n `homeSeo` keys, whose `{{year}}`
 * i18next rendered unescaped (escapeValue: false).
 */
function buildHome(mod: Record<string, unknown>, vars: Vars): Doc {
  const meta = fn(mod.copy)(vars.year) as Record<Locale, { meta: unknown }>;
  const out = {} as Doc;
  for (const l of LOCALES) {
    const i18n = JSON.parse(readFileSync(resolve(ROOT, `src/i18n/locales/${l}.json`), 'utf8')) as { homeSeo: Record<string, unknown> };
    const seo = deepCopy(i18n.homeSeo);
    seo.leadRest = String(seo.leadRest).split('{{year}}').join(String(vars.year));
    out[l] = { meta: meta[l].meta, seo };
  }
  return out;
}

/** The two forms of the predictions hero lede's verb (checked against the module in buildPredictions). */
const PREDICTIONS_VERB: Record<Locale, { upcoming: string; decided: string }> = {
  en: { upcoming: 'takes place', decided: 'took place' },
  el: { upcoming: 'διεξάγεται', decided: 'διεξήχθη' },
};

/**
 * eurovision-predictions: copy(contestTexts) with {count} for the line-up
 * size. The hero lede branched on `decided` and `host`; it is rendered in each
 * branch and split into a template ({verb}, {hostPart}) and its pieces
 * (ledeVerb, ledeHost with {hostName}), throwing unless the branches differ
 * exactly there.
 */
function buildPredictions(mod: Record<string, unknown>, vars: Vars): Doc {
  const render = (decided: boolean, host: string) => {
    const ct = contestTextsFor({ year: vars.year, cityIn: vars.cityIn, finalDay: vars.finalDay, lineup: vars.count, host });
    for (const l of LOCALES) ct[l].decided = decided;
    return fn(mod.copy)(ct) as Record<Locale, { hero: { lede: string } }>;
  };
  const base = render(false, '');
  const decided = render(true, '');
  const hosted = render(false, String(vars.hostName));
  const out = {} as Doc;
  for (const l of LOCALES) {
    const lede = base[l].hero.lede;
    const verb = PREDICTIONS_VERB[l];
    const once = (s: string, part: string) => s.indexOf(part) !== -1 && s.indexOf(part) === s.lastIndexOf(part);
    if (!once(lede, verb.upcoming) || !once(decided[l].hero.lede, verb.decided)
      || lede.replace(verb.upcoming, '\0') !== decided[l].hero.lede.replace(verb.decided, '\0')) {
      throw new Error(`extract: eurovision-predictions ${l} hero.lede: decided branch differs other than in the verb`);
    }
    // The host part follows the city.
    const cityIn = String(vars.cityIn);
    if (!once(lede, cityIn)) throw new Error(`extract: eurovision-predictions ${l} hero.lede: city not found once`);
    const at = lede.indexOf(cityIn) + cityIn.length;
    const h = hosted[l].hero.lede;
    if (!h.startsWith(lede.slice(0, at)) || !h.endsWith(lede.slice(at)) || h.length <= lede.length) {
      throw new Error(`extract: eurovision-predictions ${l} hero.lede: host branch differs other than after the city`);
    }
    const ledeHost = h.slice(at, h.length - (lede.length - at));
    const copy = deepCopy(base[l]) as { hero: Record<string, unknown> };
    copy.hero.lede = `${lede.slice(0, at)}${vars.hostPart}${lede.slice(at)}`.replace(verb.upcoming, () => String(vars.verb));
    copy.hero.ledeVerb = { ...verb };
    copy.hero.ledeHost = ledeHost;
    out[l] = copy;
  }
  return out;
}

/**
 * winners: the former copy's template functions called with the vars. The
 * recent intro appended a sentence only when a cancelled year fell in the
 * table: `intro` is its form without one, `introCancelled` the appended part.
 */
function buildWinners(mod: Record<string, unknown>, vars: Vars): Doc {
  const all = mod.copy as Record<Locale, Record<string, Record<string, unknown>>>;
  const out = {} as Doc;
  for (const l of LOCALES) {
    const c = all[l];
    const sections = c.sections as Record<string, Record<string, unknown>>;
    const intro = fn(sections.recent.intro)(vars.from, null) as string;
    const withGap = fn(sections.recent.intro)(vars.from, vars.cancelled) as string;
    if (!withGap.startsWith(intro) || withGap === intro) {
      throw new Error(`extract: winners ${l} sections.recent.intro: the cancelled form does not extend the plain one`);
    }
    out[l] = {
      ...c,
      meta: { ...c.meta, description: fn(c.meta.description)(vars.last), keywords: fn(c.meta.keywords)(vars.last) },
      sections: {
        ...sections,
        recent: {
          ...sections.recent,
          title: fn(sections.recent.title)(vars.from, vars.to),
          intro,
          introCancelled: withGap.slice(intro.length),
        },
        all: { ...sections.all, title: fn(sections.all.title)(vars.from) },
        // Not in the former module: WinnersPage hardcoded the FAQ heading.
        faqTitle: l === 'el' ? 'Συχνές ερωτήσεις' : 'Frequently asked questions',
      },
    };
  }
  return out;
}

const PREDICTIONS_VARS = ['year', 'cityIn', 'finalDay', 'count', 'verb', 'hostPart', 'hostName'];
const WINNERS_VARS = ['last', 'from', 'to', 'cancelled'];

/** Per-file mapping. Tasks 5-6 append their pages here. */
export const COPY_MAPPINGS: CopyMapping[] = [
  plain('about', 'aboutCopy'),
  plain('privacy', 'privacyCopy'),
  plain('terms', 'termsCopy'),
  plain('cookies', 'cookiesCopy'),
  plain('dashboard', 'dashboardCopy'),
  plain('scoring', 'scoringCopy'),
  {
    docId: 'rules',
    module: 'src/pages/seo/content/rulesCopy.ts',
    placeholders: ['year'],
    build: (mod, vars) => (mod.copy as (t: unknown) => Doc)(contestTextsFor(vars)),
    samples: [{ year: 2026 }, { year: 1999 }],
  },
  plain('faq', 'faqCopy'),
  // Task 5: guides.
  plain('how-to-play', 'howToPlayCopy'),
  contestCopy('eurovision-night', 'eurovisionNightCopy', NIGHT_VARS, samplesFor(NIGHT_VARS)),
  contestCopy('eurovision-games', 'eurovisionGamesCopy', ['year'], samplesFor(['year'])),
  contestCopy('eurovision-party', 'eurovisionPartyCopy', PARTY_VARS, samplesFor(PARTY_VARS)),
  plain('eurovision-trivia', 'triviaCopy'),
  plain('eurovision-duels', 'duelsCopy'),
  // Task 6: data-mixed pages.
  {
    docId: 'home',
    module: 'src/pages/content/homeCopy.ts',
    placeholders: ['year'],
    build: buildHome,
    samples: [{ year: 2031 }, { year: 1999 }],
  },
  { docId: 'not-found', module: 'src/pages/content/notFoundCopy.ts', placeholders: [], build: plainCopy, samples: [] },
  {
    docId: 'eurovision-predictions',
    module: 'src/pages/seo/content/predictionsCopy.ts',
    placeholders: PREDICTIONS_VARS,
    build: buildPredictions,
    samples: [
      { year: 2031, cityIn: 'in Lisbon', finalDay: 'Saturday 17 May 2031', count: 37, verb: 'takes place', hostPart: ', Portugal', hostName: 'Portugal' },
      { year: 2032, cityIn: 'στη Λισαβόνα', finalDay: 'Σάββατο 15 Μαΐου 2032', count: 0, verb: 'διεξήχθη', hostPart: '', hostName: 'Πορτογαλία' },
      { year: 1999, cityIn: '{city}', finalDay: '{{x}} $& }', count: 1, verb: '$1 {{', hostPart: ' ({hostName})', hostName: '}} $&' },
    ],
  },
  {
    docId: 'winners',
    module: 'src/pages/seo/content/winnersCopy.ts',
    placeholders: WINNERS_VARS,
    build: buildWinners,
    samples: [
      { last: 2025, from: 2011, to: 2025, cancelled: 2020 },
      { last: 1999, from: 1985, to: 1999, cancelled: 1990 },
    ],
  },
];

// ---- schema walk ---------------------------------------------------------

const defOf = schemaDef;

/**
 * Maps every string leaf of `value` through `fn(value, allowedPlaceholders, path)`,
 * following `schema`. Non-string leaves are returned as they are.
 */
function mapStrings(
  schema: z.ZodType,
  value: unknown,
  path: string,
  fn: (s: string, allowed: string[], path: string) => string,
): unknown {
  const def = defOf(schema);
  const at = (k: string | number) => (path ? `${path}.${k}` : String(k));
  switch (def.type) {
    case 'object': {
      if (!value || typeof value !== 'object') return value;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const child = def.shape![k];
        out[k] = child ? mapStrings(child, v, at(k), fn) : v;
      }
      return out;
    }
    case 'array':
      return Array.isArray(value) ? value.map((v, i) => mapStrings(def.element!, v, at(i), fn)) : value;
    case 'tuple':
      return Array.isArray(value) ? value.map((v, i) => (def.items![i] ? mapStrings(def.items![i], v, at(i), fn) : v)) : value;
    case 'optional':
      return value === undefined ? value : mapStrings(def.innerType!, value, path, fn);
    case 'string':
      return typeof value === 'string' ? fn(value, fieldMeta(schema).placeholders ?? [], path) : value;
    default:
      return value;
  }
}

/** Dotted paths of the fields that declare placeholders (`*` for any list index). */
export function templatedPaths(schema: z.ZodType, path = ''): string[] {
  const def = defOf(schema);
  const at = (k: string | number) => (path ? `${path}.${k}` : String(k));
  switch (def.type) {
    case 'object':
      return Object.entries(def.shape!).flatMap(([k, s]) => templatedPaths(s, at(k)));
    case 'array':
      return templatedPaths(def.element!, at('*'));
    case 'tuple':
      return def.items!.flatMap((s, i) => templatedPaths(s, at(i)));
    case 'optional':
      return templatedPaths(def.innerType!, path);
    case 'string':
      return (fieldMeta(schema).placeholders ?? []).length ? [path] : [];
    default:
      return [];
  }
}

const escapeBraces = (s: string): string => s.replace(/[{}]/g, (c) => c + c);

/**
 * The CMS document for `rendered` (the copy rendered with sentinels for
 * `placeholders`). Throws on anything that would not round-trip.
 */
export function extractDocument(schema: z.ZodType, rendered: Doc, placeholders: string[]): Doc {
  const out = {} as Doc;
  for (const locale of ['en', 'el'] as const) {
    out[locale] = mapStrings(schema, rendered[locale], '', (value, allowed, path) => {
      const where = `${locale}.${path}`;
      let result = value;
      if (allowed.length) {
        result = escapeBraces(value);
        for (const name of placeholders) result = result.split(sentinel(name)).join(`{${name}}`);
        for (const name of placeholdersIn(result)) {
          if (!allowed.includes(name)) throw new Error(`extract: ${where} uses {${name}}, not allowed by the schema`);
        }
      } else {
        for (const name of placeholders) {
          if (value.includes(sentinel(name))) throw new Error(`extract: ${where} uses {${name}} but declares no placeholders`);
        }
        if (value.includes('{{') || value.includes('}}') || placeholdersIn(value).length) {
          throw new Error(`extract: ${where} has braces that would read as an escape or placeholder: ${JSON.stringify(value)}`);
        }
      }
      const stray = SENTINEL.exec(result);
      if (stray) throw new Error(`extract: ${where} contains an unmapped sentinel ${stray[0]}`);
      return result;
    });
  }
  return out;
}

/** `doc` with every templated field interpolated with `vars` (what a page renders). */
export function interpolateDocument(schema: z.ZodType, doc: Doc, vars: Vars): Doc {
  const out = {} as Doc;
  for (const locale of ['en', 'el'] as const) {
    out[locale] = mapStrings(schema, doc[locale], '', (value, allowed) => (allowed.length ? interpolate(value, vars) : value));
  }
  return out;
}

/** Extracts and verifies one mapping. Returns the document and its serialised JSON. */
export async function extractMapping(m: CopyMapping): Promise<{ doc: Doc; json: string }> {
  const def = CMS_DOC_TYPES[docTypeFor(m.docId)];
  if (!def) throw new Error(`extract: no doc type registered for ${m.docId}`);
  const mod = (await import(pathToFileURL(resolve(ROOT, m.module)).href)) as Record<string, unknown>;
  const sentinels = Object.fromEntries(m.placeholders.map((p) => [p, sentinel(p)]));
  const doc = extractDocument(def.schema, m.build(mod, sentinels), m.placeholders);

  const samples = m.placeholders.length ? m.samples : [{}];
  if (m.placeholders.length && !samples.length) throw new Error(`extract: ${m.docId} is templated but has no samples`);
  for (const vars of samples) {
    const expected = JSON.stringify(m.build(mod, vars));
    const actual = JSON.stringify(interpolateDocument(def.schema, doc, vars));
    if (actual !== expected) throw new Error(`extract: ${m.docId} does not round-trip for ${JSON.stringify(vars)}`);
  }
  const r = validateDocument(docTypeFor(m.docId), doc);
  if (!r.ok) {
    throw new Error(`extract: ${m.docId} fails validation:\n${r.errors.map((e) => `  [${e.locale}] ${e.path}: ${e.message}`).join('\n')}`);
  }
  return { doc, json: stableJson(doc) };
}

async function main(): Promise<void> {
  const only = process.argv.slice(2);
  const mappings = only.length ? COPY_MAPPINGS.filter((m) => only.includes(m.docId)) : COPY_MAPPINGS;
  for (const id of only) if (!COPY_MAPPINGS.some((m) => m.docId === id)) throw new Error(`extract: no mapping for ${id}`);
  for (const m of mappings) {
    if (!existsSync(resolve(ROOT, m.module))) {
      console.log(`extract-copy: ${m.docId} skipped (${m.module} deleted; content/pages/${m.docId}.json is the source)`);
      continue;
    }
    const { json } = await extractMapping(m);
    const target = resolve(ROOT, `content/pages/${m.docId}.json`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, json, 'utf8');
    console.log(`extract-copy: wrote content/pages/${m.docId}.json`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error((e as Error).message);
    process.exit(1);
  });
}

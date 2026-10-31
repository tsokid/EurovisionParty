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
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { z } from 'zod';
import { fieldMeta } from '../../supabase/functions/_shared/cms/fields';
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

/** ContestTexts with `year` set and every other text a sentinel, so a stray use fails extraction. */
function contestTextsFor(vars: Vars): Record<Locale, Record<string, unknown>> {
  const one = (): Record<string, unknown> => ({
    year: vars.year,
    city: sentinel('city'),
    cityIn: sentinel('cityIn'),
    cityFrom: sentinel('cityFrom'),
    host: sentinel('host'),
    finalDay: sentinel('finalDay'),
    finalDayShort: sentinel('finalDayShort'),
    finalMonth: sentinel('finalMonth'),
    flag: sentinel('flag'),
    lineup: sentinel('lineup'),
    decided: false,
  });
  return { en: one(), el: one() };
}

const plain = (docId: string, file: string): CopyMapping => ({
  docId,
  module: `src/pages/seo/content/${file}.ts`,
  placeholders: [],
  build: plainCopy,
  samples: [],
});

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
];

// ---- schema walk ---------------------------------------------------------

type Def = { type: string; shape?: Record<string, z.ZodType>; element?: z.ZodType; items?: z.ZodType[]; innerType?: z.ZodType };
const defOf = (schema: z.ZodType): Def => (schema as unknown as { _zod: { def: Def } })._zod.def;

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

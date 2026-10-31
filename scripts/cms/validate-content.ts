/**
 * Build gate: validates every content/pages/*.json against its CMS doc type
 * (supabase/functions/_shared/cms). Prints each error and exits 1 on failure.
 * A missing or empty content/pages/ passes with "0 documents".
 *
 * Also warns (never fails) for any string naming the live contest's year or
 * host city (content/site.json): copy should say {year} / use the contest
 * facts, so it stays right when the next contest goes live. A dated past fact
 * (a policy date, a trivia answer) is a legitimate hit: review, then ignore.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import { cityName } from '../../src/pages/contest/content/hubCopy';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const PAGES_DIR = resolve(ROOT, 'content/pages');

/** The live contest's year and host city names (en, el), from content/site.json. */
export interface LiveContestFacts { year: number; cities: string[] }

export function liveContestFacts(sitePath = resolve(ROOT, 'content/site.json')): LiveContestFacts {
  const site = JSON.parse(readFileSync(sitePath, 'utf8')) as { current: { year: number; city: string; city_slug: string } };
  const { year, city, city_slug } = site.current;
  return { year, cities: [...new Set([city, cityName('el', city_slug, city).name])] };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `docId:locale:path` (list indices as numbers) of every string naming the live year or city. */
export function hardcodedFacts(docId: string, data: unknown, facts: LiveContestFacts): string[] {
  const re = new RegExp([`(?<!\\d)${facts.year}(?!\\d)`, ...facts.cities.map(escapeRe)].join('|'));
  const hits: string[] = [];
  const walk = (v: unknown, at: string): void => {
    if (typeof v === 'string') {
      if (re.test(v)) hits.push(at);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}.${i}`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`);
  };
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const locale of ['en', 'el']) {
      const slice = (data as Record<string, unknown>)[locale];
      if (slice && typeof slice === 'object') for (const [k, x] of Object.entries(slice)) walk(x, `${docId}:${locale}:${k}`);
    }
  }
  return hits;
}

export function validateContentDir(
  dir: string,
  facts: LiveContestFacts = liveContestFacts(),
): { count: number; errors: string[]; warnings: string[] } {
  if (!existsSync(dir)) return { count: 0, errors: [], warnings: [] };
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const file of files) {
    const docId = file.slice(0, -'.json'.length);
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (e) {
      errors.push(`${file}: invalid JSON: ${(e as Error).message}`);
      continue;
    }
    const r = validateDocument(docTypeFor(docId), data);
    if (!r.ok) {
      for (const e of r.errors) errors.push(`${file}: [${e.locale ?? 'doc'}] ${e.path || '(root)'}: ${e.message}`);
    }
    for (const at of hardcodedFacts(docId, data, facts)) warnings.push(`possible hardcoded year/city at ${at}`);
  }
  return { count: files.length, errors, warnings };
}

function main(): void {
  const { count, errors, warnings } = validateContentDir(PAGES_DIR);
  for (const w of warnings) console.warn(`validate-content: warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`validate-content: ${e}`);
    console.error(`validate-content: ${errors.length} error(s) in ${count} documents`);
    process.exit(1);
  }
  console.log(`validate-content: ${count} documents OK`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

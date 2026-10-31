/**
 * Build gate: validates every content/pages/*.json against its CMS doc type
 * (supabase/functions/_shared/cms). Prints each error and exits 1 on failure.
 * A missing or empty content/pages/ passes with "0 documents".
 *
 * Also prints validateDocument's warnings (never a failure): a string over its
 * field's recommended length (SEO title 60, meta description 160), an optional
 * field filled in one locale only, and any string naming the live contest's
 * year or host city (content/site.json): copy should say {year} / use the
 * contest facts, so it stays right when the next contest goes live. A dated
 * past fact (a policy date, a trivia answer) is a legitimate hit: review, then
 * ignore.
 *
 * content/pages/index.json is not a document: it lists the editorial docs
 * (archive-*, country-*, hub-*) and must match the files exactly, sorted. It
 * may be absent only while there are none.
 *
 * Also fails on a draft media reference (cms-media/<uuid>) in any file under
 * content/: published content must only hold /media/<sha12>.<ext> (publish
 * rewrites the references and commits the files).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument, type ValidationContext } from '../../supabase/functions/_shared/cms/validate';
import { isEditorialDocId, readPagesIndex } from '../../supabase/functions/_shared/cms/pagesIndex';
import { cityName } from '../../src/pages/contest/content/hubCopy';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const CONTENT_DIR = resolve(ROOT, 'content');
export const PAGES_DIR = resolve(CONTENT_DIR, 'pages');

/** Every file under `dir`, recursively, as paths relative to it with / separators, sorted. */
function filesUnder(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name), `${prefix}${e.name}/`) : e.isFile() ? [`${prefix}${e.name}`] : []))
    .sort();
}

/**
 * One error per file under `dir` (content/) holding a draft media reference
 * (cms-media/, any case). A missing folder has none.
 */
export function draftMediaRefs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return filesUnder(dir)
    .filter((f) => /cms-media\//i.test(readFileSync(join(dir, f), 'utf8')))
    .map((f) => `${f}: draft media reference (cms-media/) in published content: publish it through the CMS`);
}

/** The live contest's year and host city names (en, el), from content/site.json. */
export type LiveContestFacts = ValidationContext;

export function liveContestFacts(sitePath = resolve(ROOT, 'content/site.json')): LiveContestFacts {
  const site = JSON.parse(readFileSync(sitePath, 'utf8')) as { current: { year: number; city: string; city_slug: string } };
  const { year, city, city_slug } = site.current;
  return { year, cities: [...new Set([city, cityName('el', city_slug, city).name])] };
}

const INDEX_FILE = 'index.json';

/** Errors of content/pages/index.json against the editorial docs present (`docIds`). */
export function pagesIndexErrors(dir: string, docIds: readonly string[]): string[] {
  const present = docIds.filter(isEditorialDocId).sort();
  const at = join(dir, INDEX_FILE);
  if (!existsSync(at)) {
    return present.length ? [`${INDEX_FILE}: missing, but editorial documents exist (${present.join(', ')}): publish writes it`] : [];
  }
  let ids: string[] | null;
  try {
    ids = readPagesIndex(JSON.parse(readFileSync(at, 'utf8')));
  } catch (e) {
    return [`${INDEX_FILE}: invalid JSON: ${(e as Error).message}`];
  }
  if (!ids) return [`${INDEX_FILE}: must be { "editorial": [doc ids] }`];
  const errors: string[] = [];
  for (const id of ids) {
    if (!isEditorialDocId(id)) errors.push(`${INDEX_FILE}: lists "${id}", which is not an editorial doc id`);
    else if (!present.includes(id)) errors.push(`${INDEX_FILE}: lists "${id}", but content/pages/${id}.json does not exist`);
  }
  for (const id of present) {
    if (!ids.includes(id)) errors.push(`${INDEX_FILE}: does not list "${id}" (content/pages/${id}.json exists)`);
  }
  if (ids.some((id, i) => i > 0 && ids![i - 1] >= id)) errors.push(`${INDEX_FILE}: ids must be sorted and unique`);
  return errors;
}

export function validateContentDir(
  dir: string,
  facts: LiveContestFacts = liveContestFacts(),
): { count: number; errors: string[]; warnings: string[] } {
  if (!existsSync(dir)) return { count: 0, errors: [], warnings: [] };
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== INDEX_FILE).sort();
  const errors: string[] = [...pagesIndexErrors(dir, files.map((f) => f.slice(0, -'.json'.length)))];
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
    const r = validateDocument(docTypeFor(docId), data, facts);
    const line = (e: { locale: string | null; path: string; message: string }) => `${file}: [${e.locale ?? 'doc'}] ${e.path || '(root)'}: ${e.message}`;
    errors.push(...r.errors.map(line));
    warnings.push(...r.warnings.map(line));
  }
  return { count: files.length, errors, warnings };
}

function main(): void {
  const { count, errors: docErrors, warnings } = validateContentDir(PAGES_DIR);
  const errors = [...docErrors, ...draftMediaRefs(CONTENT_DIR)];
  for (const w of warnings) console.warn(`validate-content: warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`validate-content: ${e}`);
    console.error(`validate-content: ${errors.length} error(s) in ${count} documents`);
    process.exit(1);
  }
  console.log(`validate-content: ${count} documents OK`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

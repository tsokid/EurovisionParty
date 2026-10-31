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
 *
 * And checks that every published media reference (/media/<name>) in
 * content/**.json names a file in public/media/ (an image value also needs its
 * <sha12>-800.webp variant): a missing file fails the build with the content
 * file and the reference. A file in public/media/ that nothing references is
 * only a warning. A missing public/media/ means there are no references yet.
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
export const PUBLIC_MEDIA_DIR = resolve(ROOT, 'public/media');

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

/** Strings of a parsed JSON value, with the image values (`{ media: '….webp', alt }`) flagged. */
function* jsonStrings(v: unknown): Generator<{ text: string; image: boolean }> {
  if (typeof v === 'string') yield { text: v, image: false };
  else if (Array.isArray(v)) for (const x of v) yield* jsonStrings(x);
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const [k, x] of Object.entries(o)) {
      if (k === 'media' && typeof x === 'string' && typeof o.alt === 'string') yield { text: x, image: true };
      else yield* jsonStrings(x);
    }
  }
}

// A reference starts a string or follows a character that cannot continue a
// path or URL, so cms-media/…, https://host/media/… and /medias/… do not count.
const MEDIA_FILE = /^[0-9a-f]{12}(-800)?\.(webp|mp4|vtt)$/;
const MEDIA_REF = /(?<![\w./:-])\/media\/([\w-]+(?:\.[\w-]+)*)/g;

/**
 * Published media references of content/**.json against `mediaDir` (public/media):
 * an error per reference whose file is missing (an image value also needs its
 * `<sha12>-800.webp` variant), a warning per file nothing references (a variant
 * counts as referenced with its image).
 */
export function mediaRefReport(contentDir: string, mediaDir: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const referenced = new Set<string>();
  // Real media files only (<sha12>[-800].<ext>): a .gitkeep or a folder is neither referenced nor an orphan.
  const onDisk = new Set(
    existsSync(mediaDir)
      ? readdirSync(mediaDir, { withFileTypes: true }).filter((e) => e.isFile() && MEDIA_FILE.test(e.name)).map((e) => e.name)
      : [],
  );
  if (existsSync(contentDir)) {
    for (const file of filesUnder(contentDir).filter((f) => f.endsWith('.json'))) {
      let data: unknown;
      try {
        data = JSON.parse(readFileSync(join(contentDir, file), 'utf8'));
      } catch {
        continue; // reported as invalid JSON where the file is validated
      }
      const seen = new Set<string>();
      const need = (name: string, note = '') => {
        if (seen.has(name)) return;
        seen.add(name);
        referenced.add(name);
        if (!onDisk.has(name)) errors.push(`${file}: /media/${name}${note} is referenced but public/media/${name} does not exist`);
      };
      for (const { text, image } of jsonStrings(data)) {
        for (const m of text.matchAll(MEDIA_REF)) need(m[1]);
        if (image) {
          const v = text.match(/^\/media\/([\w.-]+)\.webp$/);
          if (v && !v[1].endsWith('-800')) need(`${v[1]}-800.webp`, ' (the 800 w variant of an image)');
        }
      }
    }
  }
  const warnings = [...onDisk]
    .filter((n) => !referenced.has(n) && !(n.endsWith('-800.webp') && referenced.has(n.replace(/-800\.webp$/, '.webp'))))
    .sort()
    .map((n) => `public/media/${n}: not referenced by anything under content/`);
  return { errors, warnings };
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

/** Everything the build gate checks: documents, draft media references, media files. */
export function validateAll(
  dirs: { content: string; pages: string; media: string } = { content: CONTENT_DIR, pages: PAGES_DIR, media: PUBLIC_MEDIA_DIR },
  facts?: LiveContestFacts,
): { count: number; errors: string[]; warnings: string[] } {
  const { count, errors: docErrors, warnings } = validateContentDir(dirs.pages, facts);
  const media = mediaRefReport(dirs.content, dirs.media);
  return {
    count,
    errors: [...docErrors, ...draftMediaRefs(dirs.content), ...media.errors],
    warnings: [...warnings, ...media.warnings],
  };
}

function main(): void {
  const { count, errors, warnings } = validateAll();
  for (const w of warnings) console.warn(`validate-content: warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`validate-content: ${e}`);
    console.error(`validate-content: ${errors.length} error(s) in ${count} documents`);
    process.exit(1);
  }
  console.log(`validate-content: ${count} documents OK`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

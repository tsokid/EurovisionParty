/**
 * Captures the prerendered <head> + <main> of every static page, so the CMS 3a
 * migration can prove it changed nothing. Fixtures: tests/fixtures/pages-before/{locale}/{name}.json
 *
 * Regenerate (needs vitest's aliases and CSS handling, so tsx cannot run it):
 *   CAPTURE_PAGES=1 npx vitest run tests/cms/pagesUnchanged.test.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { allPageUrls } from '../../src/lib/seo/registry';
import { headTagsHtml } from '../../src/lib/seo/headTags';

export interface PageCapture {
  head: string;
  main: string;
  title: string;
  jsonLd: string[];
}

/**
 * PredictionsPage derives its dateModified from VITE_BUILD_DATE, falling back to
 * today's date, which would make the capture change daily. Pin it. The value is
 * read at module load, so entry-server is imported lazily after this is set.
 * (Excluded-from-capture alternative rejected: the date sits in the JSON-LD, which must stay covered.)
 */
export const PINNED_BUILD_DATE = '2026-10-31';

async function renderPage(url: string) {
  process.env.VITE_BUILD_DATE = PINNED_BUILD_DATE;
  (import.meta.env as Record<string, unknown>).VITE_BUILD_DATE = PINNED_BUILD_DATE;
  const { render } = await import('../../src/entry-server');
  return render(url);
}

export const NOT_FOUND_URL = '/en/__404';

export const FIXTURE_DIR = resolve(process.cwd(), 'tests/fixtures/pages-before');

/** Every static registry URL in both locales, plus the 404 page. */
export function captureUrls(): string[] {
  return [...allPageUrls().map((u) => u.path), NOT_FOUND_URL];
}

/** `/en` -> en/index.json, `/el/how-to-play` -> el/how-to-play.json, `/en/a/b` -> en/a_b.json */
export function fixtureName(url: string): { locale: string; file: string } {
  const [, locale, ...rest] = url.split('/');
  const name = rest.filter(Boolean).join('_') || 'index';
  return { locale, file: `${locale}/${name}.json` };
}

const normalise = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * The public pages have no <main> element: the shell is header + page + footer
 * straight from renderToString. `main` is therefore the whole rendered body
 * (the strictest capture), whitespace-normalised, tags kept.
 */
const extractMain = (html: string): string => normalise(html);

export async function capturePage(url: string): Promise<PageCapture> {
  const r = await renderPage(url);
  if (!r.head) throw new Error(`${url}: no head collected (status ${r.status})`);
  const head = headTagsHtml(r.head);
  const jsonLd = [...head.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  return { head, main: extractMain(r.html), title: r.head.title, jsonLd };
}

export async function writeFixtures(): Promise<number> {
  const urls = captureUrls();
  for (const url of urls) {
    const { file } = fixtureName(url);
    const target = resolve(FIXTURE_DIR, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(await capturePage(url), null, 2) + '\n', 'utf8');
  }
  return urls.length;
}

// ---------------------------------------------------------------------------
// Data pages (CMS 3c Task 6): hub, archive and country pages, with the
// editorial layer. A page without an editorial doc must prerender exactly as
// before the layer existed. The whole prerender output (status, head tags,
// body, inlined #__content__) is hashed per URL, so the fixture stays small:
// tests/fixtures/data-pages-before.json.

export const DATA_FIXTURE = resolve(process.cwd(), 'tests/fixtures/data-pages-before.json');

/** Every data-driven public URL (hub + subpages, archive, countries, both indexes), both locales. */
export async function dataPageUrls(): Promise<string[]> {
  const { dynamicPageUrls } = await import('../../src/lib/seo/dynamicPages');
  const { contentData } = await import('../../src/lib/seo/contentData');
  return dynamicPageUrls(contentData()).map((p) => p.path);
}

/** sha256 of everything the prerender writes for `url`. */
export async function dataPageDigest(url: string): Promise<string> {
  const r = await renderPage(url);
  const payload = JSON.stringify({
    status: r.status,
    head: r.head ? headTagsHtml(r.head) : null,
    html: r.html,
    content: JSON.stringify(r.content),
  });
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export async function writeDataFixture(): Promise<number> {
  const out: Record<string, string> = {};
  for (const url of await dataPageUrls()) out[url] = await dataPageDigest(url);
  writeFileSync(DATA_FIXTURE, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return Object.keys(out).length;
}

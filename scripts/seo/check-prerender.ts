/**
 * Build gate: verifies prerendered pages in dist/ (run after scripts/prerender.ts).
 * index.html (SPA shell) and 404.html are not pages for duplicate/canonical rules.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPrerender, type BuiltPage } from './checkPrerender';
import { loadContent } from './loadContent';
import { allPublicUrls } from '../../src/lib/seo/registry';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = resolve(ROOT, 'dist');
const ORIGIN = 'https://eurovision.games';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function main(): void {
  const files = walk(DIST)
    .filter((f) => f.endsWith('.html'))
    .map((f) => relative(DIST, f).split(sep).join('/'));

  const pages: BuiltPage[] = files
    // Only locale pages (en.html, el.html, en/**, el/**). Other .html files in dist
    // are static assets copied from public/ (mockups, reference designs), not pages.
    .filter((f) => /^(en|el)(\.html$|\/)/.test(f))
    .map((f) => ({
      url: `${ORIGIN}/${f.replace(/\.html$/, '')}`,
      html: readFileSync(resolve(DIST, f), 'utf8'),
    }));

  const sitemap = readFileSync(resolve(ROOT, 'public/sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

  const noindexUrls = allPublicUrls(loadContent())
    .filter((u) => !u.indexable)
    .map((u) => ORIGIN + u.path);

  const errors = checkPrerender(pages, locs, existsSync(resolve(DIST, '404.html')), noindexUrls);
  if (errors.length) {
    console.error(`prerender check failed (${errors.length}):\n` + errors.map((e) => `  - ${e}`).join('\n'));
    process.exit(1);
  }
  console.log(`prerender check: ${pages.length} pages OK`);
}

main();

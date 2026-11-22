/**
 * Build gate (Track 3 P4): the admin preview's click-to-edit markers never
 * reach the site. cmsAttrs (src/lib/cms/cmsAttrs.ts) renders data-cms-path
 * only in preview mode, which the prerender never sets; this scans every
 * file of dist/ (HTML, the inlined content JSON, JS, CSS, XML, text) and
 * fails the build on any occurrence. Run after scripts/prerender.ts.
 *
 *   tsx scripts/cms/check-no-cms-markers.ts [distDir]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The marker, spelled out at runtime so this script cannot match itself in a bundle. */
export const MARKER = ['data', 'cms', 'path'].join('-');

/** Text files worth scanning; binaries (images, fonts, video) cannot hold an attribute. */
const TEXT = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.css', '.json', '.xml', '.txt', '.webmanifest', '.svg', '.map']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** dist/-relative paths of the text files that contain the marker, with a count each. */
export function findMarkers(dist: string): Array<{ file: string; count: number }> {
  const hits: Array<{ file: string; count: number }> = [];
  for (const file of walk(dist)) {
    if (!TEXT.has(extname(file).toLowerCase())) continue;
    const text = readFileSync(file, 'utf8');
    const count = text.split(MARKER).length - 1;
    if (count) hits.push({ file: relative(dist, file).split(sep).join('/'), count });
  }
  return hits;
}

function main(): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const dist = resolve(root, process.argv[2] ?? 'dist');
  const hits = findMarkers(dist);
  if (hits.length) {
    console.error(`cms marker check failed: ${MARKER} found in ${hits.length} file(s) of dist/:\n`
      + hits.slice(0, 30).map((h) => `  - ${h.file} (${h.count})`).join('\n'));
    process.exit(1);
  }
  console.log(`cms marker check: no ${MARKER} in dist/`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

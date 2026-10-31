/**
 * Last build step: moves Vite's client manifest out of the deployed folder.
 *
 * dist/.vite/manifest.json maps every source module to its chunk, the lazy
 * admin's included, and dist/ is what Vercel serves. The bundle and
 * service-worker tests need it (tests/scripts/bundleSize.test.ts,
 * swPrecache.test.ts), so it goes to dist-meta/manifest.json (git-ignored,
 * not deployed) and dist/.vite is removed. Runs after check-prerender.
 */
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Moves `dist`/.vite/manifest.json to `meta`/manifest.json and deletes `dist`/.vite. */
export function moveBuildManifest(dist: string, meta: string): void {
  const from = resolve(dist, '.vite/manifest.json');
  if (!existsSync(from)) throw new Error(`move-build-manifest: ${from} not found (build.manifest off?)`);
  mkdirSync(meta, { recursive: true });
  const to = resolve(meta, 'manifest.json');
  rmSync(to, { force: true });
  renameSync(from, to);
  rmSync(resolve(dist, '.vite'), { recursive: true, force: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  moveBuildManifest(resolve(root, 'dist'), resolve(root, 'dist-meta'));
  console.log('move-build-manifest: dist/.vite/manifest.json -> dist-meta/manifest.json');
}

/**
 * `npm run seo:baseline`: refresh the committed SEO baseline
 * (docs/design/stage/seo-baseline.json) from the current dist/.
 *
 * The guard (guard.ts) falls back to this file when the live
 * /_seo/snapshot.json is 404 (any age) or unreachable (only while under 30
 * days old, by its built_at). Builds never commit, so we refresh it by hand
 * when shipping: after `npm run build` passes on the commit going to main,
 * run this and commit the file with it. See docs/seo/seo-guard.md.
 *
 *   npx tsx scripts/seo/write-baseline.ts [distDir]
 */
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSnapshot, LIVE_SNAPSHOT_FORMAT, type LiveSnapshot } from './snapshot';
import { readIntentFile } from './intent';
import { COMMITTED_BASELINE } from './guard';
import { SEO_INTENT_FILE } from '../../supabase/functions/_shared/cms/seoIntent';

export function committedBaselineOf(distDir: string, root: string, now: Date, commit: string | null): LiveSnapshot {
  const routes = collectSnapshot(distDir);
  if (Object.keys(routes).length === 0) throw new Error(`no prerendered pages in ${distDir}: run npm run build first`);
  return {
    format: LIVE_SNAPSHOT_FORMAT,
    built_at: now.toISOString(),
    commit,
    intents: readIntentFile(resolve(root, SEO_INTENT_FILE)).map((e) => e.id),
    routes,
  };
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const dist = resolve(process.argv[2] ?? resolve(root, 'dist'));
  if (!existsSync(dist)) throw new Error(`${dist} not found: run npm run build first`);
  let commit: string | null = null;
  try {
    commit = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    commit = null;
  }
  const snap = committedBaselineOf(dist, root, new Date(), commit);
  writeFileSync(resolve(root, COMMITTED_BASELINE), JSON.stringify(snap, null, 2) + '\n', 'utf8');
  console.log(`seo:baseline: ${Object.keys(snap.routes).length} routes -> ${COMMITTED_BASELINE} (built_at ${snap.built_at})`);
}

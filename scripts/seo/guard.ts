/**
 * Build step: the SEO guard (Track 3 spec §6, P1). Runs in `npm run build`
 * after check-prerender. Runbook: docs/seo/seo-guard.md.
 *
 * 1. Snapshots the prerendered dist/ (snapshot.ts; /admin is never in it)
 *    and writes it to dist/_seo/snapshot.json, so every deploy publishes
 *    what it serves (noindex header, disallowed in robots.txt).
 * 2. Loads the baseline: what is live.
 *    - default: GET https://eurovision.games/_seo/snapshot.json
 *      (SEO_BASELINE_URL overrides the URL), 3 tries;
 *    - HTTP 404 (nothing published yet, e.g. the first guarded deploy):
 *      the committed baseline docs/design/stage/seo-baseline.json, with a
 *      warning;
 *    - network error, timeout, 5xx or a response that is not a snapshot:
 *      the copy the last passing build left in the build cache
 *      (node_modules/.cache/seo-guard/snapshot.json, which Vercel restores
 *      between builds), else the committed baseline if its built_at is
 *      under 30 days old;
 *    - SEO_BASELINE=<file> uses that file instead (local checks; ignored on
 *      Vercel production, which always compares against live).
 *    No baseline: the build fails (fail closed), except under the bootstrap
 *    flag below.
 * 3. Diffs with the pending SEO intent (seo-intent.json entries the live
 *    snapshot has not seen; intent.ts). A title, description, robots,
 *    canonical, hreflang, H1 or JSON-LD change the intent does not declare,
 *    or a removed route without a 301, fails the build, so Vercel keeps the
 *    current production deployment.
 * 4. On a pass, stores the new snapshot in the build cache (the fallback of
 *    step 2 for the next build).
 *
 * SEO_GUARD_BOOTSTRAP=1 skips the diff (the snapshot is still written).
 * For local builds without network; the first deploy does not need it
 * (the committed baseline covers it). On Vercel production it applies only while
 * no baseline can be loaded: once one is live, a forgotten flag is ignored.
 * Never set it permanently in Vercel.
 *
 * Exit codes: 0 pass (or bootstrap), 1 SEO regression, 2 no baseline or an
 * invalid seo-intent.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSnapshot, LIVE_SNAPSHOT_FORMAT, readBaseline, type LiveSnapshot, type Snapshot } from './snapshot';
import { diffSnapshots, formatDiff } from './snapshot-diff';
import { intentContext, intentPolicy, readIntentFile, type IntentContext } from './intent';
import { SEO_INTENT_FILE, type IntentEntry } from '../../supabase/functions/_shared/cms/seoIntent';

export const LIVE_SNAPSHOT_URL = 'https://eurovision.games/_seo/snapshot.json';
/** Where the snapshot is deployed, relative to dist/. */
export const SNAPSHOT_PATH = '_seo/snapshot.json';
/** Build-cache copy, relative to the repo root (Vercel restores node_modules/.cache). */
export const CACHE_PATH = 'node_modules/.cache/seo-guard/snapshot.json';
/** The committed baseline, refreshed by `npm run seo:baseline` (repo-relative). */
export const COMMITTED_BASELINE = 'docs/design/stage/seo-baseline.json';
/** After a network error the committed baseline is used only while younger than this. */
export const COMMITTED_MAX_AGE_DAYS = 30;

export type GuardEnv = {
  SEO_BASELINE?: string;
  SEO_BASELINE_URL?: string;
  SEO_GUARD_BOOTSTRAP?: string;
  VERCEL_ENV?: string;
  VERCEL_GIT_COMMIT_SHA?: string;
};

export type GuardOptions = {
  root: string;
  distDir: string;
  env: GuardEnv;
  fetch: typeof fetch;
  log: (line: string) => void;
  /** Intent → route context; default intentContext(root). */
  context?: () => IntentContext;
  /** Pause between fetch tries; default 2 s. */
  retryDelayMs?: number;
  now?: () => Date;
};

type Baseline = { routes: Snapshot; intents: string[] | null; builtAt: string | null; source: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The live snapshot, or why not: `missing` (HTTP 404, nothing published yet) or `error` (network, timeout, 5xx, not a snapshot). */
async function fetchLive(url: string, opts: GuardOptions): Promise<Baseline | { kind: 'missing' | 'error'; reason: string }> {
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await opts.fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'eurovision-games-seo-guard' },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 404) return { kind: 'missing', reason: `${url}: 404 (no live snapshot published yet)` };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = readBaseline(JSON.parse(await res.text()));
      return { ...parsed, source: url };
    } catch (e) {
      last = `${url}: ${message(e)}`;
      opts.log(`seo-guard: live baseline try ${attempt}/3 failed: ${message(e)}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 2000));
    }
  }
  return { kind: 'error', reason: last };
}

function readFileBaseline(path: string, source = path): Baseline {
  return { ...readBaseline(JSON.parse(readFileSync(path, 'utf8'))), source };
}

/** Age of the committed baseline in days (from its built_at), or null when it has no date (a bare snapshot). */
function ageDays(b: Baseline, now: Date): number | null {
  const t = b.builtAt ? Date.parse(b.builtAt) : NaN;
  return Number.isNaN(t) ? null : (now.getTime() - t) / 86_400_000;
}

/**
 * The committed baseline (COMMITTED_BASELINE, refreshed by `npm run
 * seo:baseline`). After a 404 it is used whatever its age (nothing is live
 * to compare against; it is the best record of what was). After a network
 * error only while fresher than COMMITTED_MAX_AGE_DAYS.
 */
function committedBaseline(opts: GuardOptions, requireFresh: boolean): Baseline | string {
  const path = resolve(opts.root, COMMITTED_BASELINE);
  if (!existsSync(path)) return `${COMMITTED_BASELINE}: not found`;
  let b: Baseline;
  try {
    b = readFileBaseline(path, COMMITTED_BASELINE);
  } catch (e) {
    return `${COMMITTED_BASELINE}: ${message(e)}`;
  }
  if (!requireFresh) return b;
  const age = ageDays(b, (opts.now ?? (() => new Date()))());
  if (age === null) return `${COMMITTED_BASELINE}: has no built_at date, cannot prove it is fresh (run npm run seo:baseline)`;
  if (age > COMMITTED_MAX_AGE_DAYS) return `${COMMITTED_BASELINE}: ${Math.floor(age)} days old (max ${COMMITTED_MAX_AGE_DAYS}; run npm run seo:baseline)`;
  return b;
}

/** The baseline, or the reasons none could be loaded. */
async function loadBaseline(opts: GuardOptions, production: boolean): Promise<Baseline | string[]> {
  const { env, root, log } = opts;
  if (env.SEO_BASELINE && !production) {
    // Explicit file: no fallback, a missing or bad file is an error.
    try {
      return readFileBaseline(resolve(root, env.SEO_BASELINE));
    } catch (e) {
      return [`SEO_BASELINE ${env.SEO_BASELINE}: ${message(e)}`];
    }
  }
  if (env.SEO_BASELINE) log('seo-guard: SEO_BASELINE is ignored on Vercel production (the baseline is always live)');
  const live = await fetchLive(env.SEO_BASELINE_URL || LIVE_SNAPSHOT_URL, opts);
  if (!('kind' in live)) return live;

  if (live.kind === 'missing') {
    const b = committedBaseline(opts, false);
    if (typeof b === 'string') return [live.reason, b];
    log(`seo-guard: WARNING: ${live.reason}; comparing against the committed baseline ${COMMITTED_BASELINE} (built ${b.builtAt ?? 'undated'})`);
    return b;
  }

  const reasons = [live.reason];
  const cache = resolve(root, CACHE_PATH);
  if (existsSync(cache)) {
    try {
      const b = readFileBaseline(cache, CACHE_PATH);
      log(`seo-guard: WARNING: live baseline unavailable (${live.reason}); using the build-cache copy`);
      return b;
    } catch (e) {
      reasons.push(`${CACHE_PATH}: ${message(e)}`);
    }
  } else {
    reasons.push(`${CACHE_PATH}: not in the build cache`);
  }
  const b = committedBaseline(opts, true);
  if (typeof b === 'string') return [...reasons, b];
  log(`seo-guard: WARNING: live baseline unavailable (${live.reason}); comparing against the committed baseline ${COMMITTED_BASELINE} (built ${b.builtAt})`);
  return b;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value) + '\n', 'utf8');
}

export async function runGuard(opts: GuardOptions): Promise<0 | 1 | 2> {
  const { env, log, root } = opts;
  const production = env.VERCEL_ENV === 'production';
  const bootstrap = env.SEO_GUARD_BOOTSTRAP === '1';

  let entries: IntentEntry[];
  try {
    entries = readIntentFile(resolve(root, SEO_INTENT_FILE));
  } catch (e) {
    log(`seo-guard: FAIL: ${message(e)}`);
    return 2;
  }

  const routes = collectSnapshot(opts.distDir);
  const live: LiveSnapshot = {
    format: LIVE_SNAPSHOT_FORMAT,
    built_at: (opts.now ?? (() => new Date()))().toISOString(),
    commit: env.VERCEL_GIT_COMMIT_SHA || null,
    intents: entries.map((e) => e.id),
    routes,
  };
  writeJson(resolve(opts.distDir, SNAPSHOT_PATH), live);
  log(`seo-guard: snapshot of ${Object.keys(routes).length} routes -> dist/${SNAPSHOT_PATH}`);
  const pass = (): 0 => {
    writeJson(resolve(root, CACHE_PATH), live);
    return 0;
  };

  if (bootstrap && !production) {
    log('seo-guard: SEO_GUARD_BOOTSTRAP=1: diff SKIPPED (local bootstrap). Never use this for a production deploy that has a live snapshot.');
    return pass();
  }

  const baseline = await loadBaseline(opts, production);
  if (Array.isArray(baseline)) {
    if (bootstrap) {
      log(`seo-guard: no baseline (${baseline.join('; ')})`);
      log('seo-guard: SEO_GUARD_BOOTSTRAP=1: diff SKIPPED (first deploy). Remove the flag from Vercel now.');
      return pass();
    }
    log(`seo-guard: FAIL: no baseline to compare against (fail closed):\n  ${baseline.join('\n  ')}`);
    log('seo-guard: for a first deploy or an offline local build, see docs/seo/seo-guard.md (SEO_GUARD_BOOTSTRAP=1).');
    return 2;
  }
  if (bootstrap) log('seo-guard: SEO_GUARD_BOOTSTRAP=1 ignored: a baseline exists on production');

  const seen = new Set(baseline.intents ?? []);
  const pending = entries.filter((e) => !seen.has(e.id));
  log(`seo-guard: baseline ${baseline.source} (${Object.keys(baseline.routes).length} routes); intent: ${pending.length ? pending.map((e) => e.id).join(', ') : 'none pending'}`);
  const policy = pending.length ? intentPolicy(pending, (opts.context ?? (() => intentContext(root)))()) : undefined;
  const result = diffSnapshots(baseline.routes, routes, policy);
  log(formatDiff(result));
  return result.exitCode === 0 ? pass() : 1;
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  runGuard({ root, distDir: resolve(root, 'dist'), env: process.env as GuardEnv, fetch, log: (l) => console.log(l) })
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error('seo-guard: fatal', e);
      process.exit(2);
    });
}

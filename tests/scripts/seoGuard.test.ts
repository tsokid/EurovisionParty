// @vitest-environment node
// The build's SEO guard (Track 3 P1, scripts/seo/guard.ts): the live
// baseline, the SEO intent and fail-closed behaviour. The headline case: a
// commit that changes a page title fails the build step without an intent
// and passes with the intent publish-content writes for it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runGuard, CACHE_PATH, COMMITTED_BASELINE, SNAPSHOT_PATH, type GuardEnv } from '../../scripts/seo/guard';
import { committedBaselineOf } from '../../scripts/seo/write-baseline';
import { collectSnapshot, LIVE_SNAPSHOT_FORMAT, type LiveSnapshot } from '../../scripts/seo/snapshot';
import { intentContext } from '../../scripts/seo/intent';
import { appendIntent, buildIntentEntry, SEO_INTENT_FILE, type IntentEntry } from '../../supabase/functions/_shared/cms/seoIntent';

const REPO = process.cwd();
const faq = JSON.parse(readFileSync(resolve(REPO, 'tests/fixtures/content-live-hub/pages/faq.json'), 'utf8'));
const ORIGIN = 'https://eurovision.games';

type Page = { title: string; description?: string; canonical?: string; h1?: string; robots?: string };

function html(route: string, p: Page): string {
  return `<!doctype html><html><head><title>${p.title}</title>
<meta name="description" content="${p.description ?? 'Desc'}">
<meta name="robots" content="${p.robots ?? 'index,follow'}">
<link rel="canonical" href="${p.canonical ?? ORIGIN + route}">
<link rel="alternate" hreflang="en" href="${ORIGIN}${route.replace(/^\/el/, '/en')}">
<link rel="alternate" hreflang="el" href="${ORIGIN}${route.replace(/^\/en/, '/el')}">
<script type="application/ld+json">{"@type":"WebPage","name":"${p.title}"}</script>
</head><body><main><h1>${p.h1 ?? 'Heading'}</h1></main></body></html>`;
}

const BASE: Record<string, Page> = {
  '/en/faq': { title: faq.en.meta.title },
  '/el/faq': { title: faq.el.meta.title },
  '/en/about': { title: 'About' },
};

let root: string;
let dist: string;

function writeDist(pages: Record<string, Page>) {
  rmSync(dist, { recursive: true, force: true });
  for (const [route, p] of Object.entries(pages)) {
    const file = join(dist, `${route}.html`);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, html(route, p));
  }
  // The SPA shell and the admin are never in the snapshot.
  writeFileSync(join(dist, 'index.html'), html('/', { title: 'shell' }));
  mkdirSync(join(dist, 'admin'), { recursive: true });
  writeFileSync(join(dist, 'admin/index.html'), html('/admin', { title: 'admin' }));
}

/** What is live: the snapshot of BASE, as a deploy publishes it. */
function liveSnapshot(intents: string[] = []): LiveSnapshot {
  writeDist(BASE);
  return { format: LIVE_SNAPSHOT_FORMAT, built_at: 'x', commit: 'live', intents, routes: collectSnapshot(dist) };
}

function serve(body: unknown, status = 200): typeof fetch {
  return (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as typeof fetch;
}
const offline = (async () => { throw new Error('getaddrinfo ENOTFOUND'); }) as typeof fetch;

function writeIntent(entries: IntentEntry[]) {
  let text: string | null = null;
  for (const e of entries) text = appendIntent(text, e);
  writeFileSync(join(root, SEO_INTENT_FILE), text!);
}

/** The intent publish-content writes for a publish of `draft` over the committed faq. */
const faqIntent = (id: string, draft: unknown) =>
  buildIntentEntry({ id, createdAt: 'x', changedPaths: ['content/pages/faq.json'], drafts: { faq: draft }, committed: { faq } })!;

const newTitle = () => {
  const d = JSON.parse(JSON.stringify(faq));
  d.en.meta.title = 'Eurovision Games FAQ: a brand new title';
  return d;
};

const NOW = new Date('2027-01-31T12:00:00Z');

async function guard(env: GuardEnv, fetchImpl: typeof fetch) {
  const lines: string[] = [];
  const code = await runGuard({
    root, distDir: dist, env, fetch: fetchImpl, log: (l) => lines.push(l), retryDelayMs: 0,
    context: () => intentContext(REPO), now: () => NOW,
  });
  return { code, out: lines.join('\n') };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'seo-guard-'));
  dist = join(root, 'dist');
  copyFileSync(resolve(REPO, 'vercel.json'), join(root, 'vercel.json'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('SEO guard: a title change', () => {
  it('fails the build step without an intent, and passes with the intent publish-content writes', async () => {
    const live = liveSnapshot();
    writeDist({ ...BASE, '/en/faq': { title: newTitle().en.meta.title } });

    const without = await guard({}, serve(live));
    expect(without.code).toBe(1);
    expect(without.out).toMatch(/ERRORS[\s\S]*\/en\/faq title:/);
    expect(without.out).toMatch(/FAIL: SEO regression detected/);

    writeIntent([faqIntent('publish-1', newTitle())]);
    const withIntent = await guard({}, serve(live));
    expect(withIntent.out).toMatch(/ALLOWED BY SEO INTENT[\s\S]*\/en\/faq title:/);
    expect(withIntent.code).toBe(0);
  });

  it('the intent covers only what it declares: the other locale, other fields and other pages still fail', async () => {
    const live = liveSnapshot();
    writeIntent([faqIntent('publish-1', newTitle())]);
    for (const pages of [
      { '/el/faq': { title: 'Νέος τίτλος' } },
      { '/en/faq': { title: newTitle().en.meta.title, description: 'Changed too' } },
      { '/en/faq': { title: faq.en.meta.title, canonical: `${ORIGIN}/en/elsewhere` } },
      { '/en/faq': { title: faq.en.meta.title, robots: 'noindex' } },
      { '/en/about': { title: 'About, retitled' } },
    ]) {
      writeDist({ ...BASE, ...pages });
      expect((await guard({}, serve(live))).code, JSON.stringify(pages)).toBe(1);
    }
  });

  it('an intent the live deploy already shipped no longer applies (a later code commit cannot ride on it)', async () => {
    const live = liveSnapshot(['publish-1']);
    writeIntent([faqIntent('publish-1', newTitle())]);
    writeDist({ ...BASE, '/en/faq': { title: 'A later, unannounced title' } });
    const r = await guard({}, serve(live));
    expect(r.out).toMatch(/intent: none pending/);
    expect(r.code).toBe(1);
  });

  it('an unchanged site passes and the deploy records the intent ids it was built with', async () => {
    const live = liveSnapshot();
    writeIntent([faqIntent('publish-1', newTitle())]);
    writeDist(BASE);
    expect((await guard({ VERCEL_GIT_COMMIT_SHA: 'abc' }, serve(live))).code).toBe(0);
    const deployed = JSON.parse(readFileSync(join(dist, SNAPSHOT_PATH), 'utf8')) as LiveSnapshot;
    expect(deployed.format).toBe(LIVE_SNAPSHOT_FORMAT);
    expect(deployed.commit).toBe('abc');
    expect(deployed.intents).toEqual(['publish-1']);
    expect(Object.keys(deployed.routes).sort()).toEqual(['/el/faq', '/en/about', '/en/faq']);
  });
});

describe('SEO guard: removed routes', () => {
  it('a removed route fails, even with a doc intent', async () => {
    const live = liveSnapshot();
    writeIntent([faqIntent('publish-1', newTitle())]);
    writeDist({ '/en/faq': BASE['/en/faq'], '/el/faq': BASE['/el/faq'] });
    const r = await guard({}, serve(live));
    expect(r.out).toMatch(/removed route: \/en\/about/);
    expect(r.code).toBe(1);
  });

  it('passes only when the intent explains it and vercel.json 301s it to a built page', async () => {
    const live = liveSnapshot();
    const manual: IntentEntry = { id: 'manual-1', created_at: 'x', source: 'manual', docs: [], data: [], routes: [{ route: '/en/about', fields: ['removed'] }] };
    writeIntent([manual]);
    writeDist({ '/en/faq': BASE['/en/faq'], '/el/faq': BASE['/el/faq'] });
    expect((await guard({}, serve(live))).code).toBe(1); // no redirect for /en/about

    const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
    const withRedirect = (permanent: boolean) => ({
      ...vercel,
      redirects: [{ source: '/:locale(en|el)/about', destination: '/:locale/faq', permanent }, ...vercel.redirects],
    });
    const temporary = await runGuard({ root, distDir: dist, env: {}, fetch: serve(live), log: () => {}, retryDelayMs: 0,
      context: () => ({ ...intentContext(REPO), vercel: withRedirect(false) }) });
    expect(temporary).toBe(1); // a 307 is not enough
    const lines: string[] = [];
    const code = await runGuard({ root, distDir: dist, env: {}, fetch: serve(live), log: (l) => lines.push(l), retryDelayMs: 0,
      context: () => ({ ...intentContext(REPO), vercel: withRedirect(true) }) });
    expect(lines.join('\n')).toMatch(/removed route \(301 in vercel.json\): \/en\/about/);
    expect(code).toBe(0);
  });
});

describe('SEO guard: baseline sources and fail closed', () => {
  it('fails closed (exit 2) when the live baseline cannot be fetched and nothing is cached', async () => {
    liveSnapshot();
    const r = await guard({}, offline);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/fail closed/);
  });

  it('refuses a response that is not a snapshot (the SPA shell, an empty object)', async () => {
    liveSnapshot();
    expect((await guard({}, serve('<!doctype html><html></html>'))).code).toBe(2);
    expect((await guard({}, serve({ format: LIVE_SNAPSHOT_FORMAT, intents: [], routes: {} }))).code).toBe(2);
    expect((await guard({}, serve({}, 404))).code).toBe(2);
  });

  it('falls back to the build-cache copy a passing build left behind', async () => {
    const live = liveSnapshot();
    expect((await guard({}, serve(live))).code).toBe(0);
    expect(existsSync(join(root, CACHE_PATH))).toBe(true);

    writeDist({ ...BASE, '/en/faq': { title: 'Changed while offline' } });
    const r = await guard({}, offline);
    expect(r.out).toMatch(/using the build-cache copy/);
    expect(r.code).toBe(1);
    writeDist(BASE);
    expect((await guard({}, offline)).code).toBe(0);
  });

  it('SEO_BASELINE compares against a local file (bare snapshots too) instead of fetching', async () => {
    const live = liveSnapshot();
    writeFileSync(join(root, 'baseline.json'), JSON.stringify(live.routes));
    writeDist(BASE);
    const r = await guard({ SEO_BASELINE: 'baseline.json' }, offline);
    expect(r.out).toMatch(/baseline .*baseline\.json/);
    expect(r.code).toBe(0);
    writeDist({ ...BASE, '/en/faq': { title: 'x' } });
    expect((await guard({ SEO_BASELINE: 'baseline.json' }, offline)).code).toBe(1);
    expect((await guard({ SEO_BASELINE: 'missing.json' }, serve(live))).code).toBe(2);
  });

  it('on Vercel production SEO_BASELINE is ignored: the baseline is always live', async () => {
    const live = liveSnapshot();
    writeDist({ ...BASE, '/en/faq': { title: 'x' } });
    writeFileSync(join(root, 'baseline.json'), JSON.stringify(collectSnapshot(dist)));
    const r = await guard({ SEO_BASELINE: 'baseline.json', VERCEL_ENV: 'production' }, serve(live));
    expect(r.out).toMatch(/SEO_BASELINE is ignored/);
    expect(r.code).toBe(1);
  });

  it('an invalid seo-intent.json fails closed', async () => {
    const live = liveSnapshot();
    writeFileSync(join(root, SEO_INTENT_FILE), '{"version":1,"intents":[{"id":"a"}]}');
    expect((await guard({}, serve(live))).code).toBe(2);
  });
});

describe('SEO guard: SEO_GUARD_BOOTSTRAP', () => {
  it('locally: skips the diff without touching the network and still writes the snapshot', async () => {
    writeDist({ ...BASE, '/en/faq': { title: 'anything' } });
    let fetched = false;
    const r = await guard({ SEO_GUARD_BOOTSTRAP: '1' }, (async () => { fetched = true; throw new Error('no'); }) as typeof fetch);
    expect(r.code).toBe(0);
    expect(fetched).toBe(false);
    expect(r.out).toMatch(/SKIPPED/);
    expect(existsSync(join(dist, SNAPSHOT_PATH))).toBe(true);
  });

  it('on production: applies only while no live baseline exists (first deploy)', async () => {
    writeDist({ ...BASE, '/en/faq': { title: 'anything' } });
    expect((await guard({ SEO_GUARD_BOOTSTRAP: '1', VERCEL_ENV: 'production' }, serve('', 404))).code).toBe(0);
  });

  it('on production with a live baseline: the forgotten flag is ignored and the guard enforces', async () => {
    const live = liveSnapshot();
    writeDist({ ...BASE, '/en/faq': { title: 'anything' } });
    const r = await guard({ SEO_GUARD_BOOTSTRAP: '1', VERCEL_ENV: 'production' }, serve(live));
    expect(r.out).toMatch(/BOOTSTRAP=1 ignored/);
    expect(r.code).toBe(1);
  });

  it('without the flag and without a committed baseline, production never skips', async () => {
    writeDist(BASE);
    expect((await guard({ VERCEL_ENV: 'production' }, serve('', 404))).code).toBe(2);
  });
});

describe('build wiring', () => {
  const pkg = JSON.parse(readFileSync(resolve(REPO, 'package.json'), 'utf8'));
  const steps: string[] = pkg.scripts.build.split('&&').map((s: string) => s.trim());

  it('runs the guard after check-prerender and before move-build-manifest, keeping every existing check', () => {
    const at = (s: string) => steps.indexOf(s);
    expect(at('tsx scripts/seo/guard.ts')).toBeGreaterThan(at('tsx scripts/seo/check-prerender.ts'));
    expect(at('tsx scripts/seo/guard.ts')).toBeLessThan(at('tsx scripts/move-build-manifest.ts'));
    for (const s of ['tsc -b', 'npm run typecheck:shared', 'tsx scripts/cms/validate-content.ts', 'tsx scripts/prerender.ts', 'tsx scripts/seo/check-prerender.ts']) {
      expect(steps, s).toContain(s);
    }
    expect(pkg.scripts.build).not.toMatch(/SEO_GUARD_BOOTSTRAP/);
  });

  it('serves /_seo/ noindex, never via the SPA fallback, and robots.txt disallows it in every group', () => {
    const vercel = JSON.parse(readFileSync(resolve(REPO, 'vercel.json'), 'utf8'));
    const h = vercel.headers.find((x: { source: string }) => x.source === '/_seo/(.*)');
    expect(h.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' });
    const re = new RegExp('^' + vercel.rewrites[0].source + '$');
    expect(re.test('/_seo/snapshot.json')).toBe(false);
    const robots = readFileSync(resolve(REPO, 'public/robots.txt'), 'utf8').replace(/\r\n/g, '\n');
    const groups = robots.split(/\n(?=User-agent:)/).filter((g) => g.startsWith('User-agent:'));
    expect(groups.length).toBeGreaterThan(1);
    for (const g of groups) expect(g, g.split('\n')[0]).toMatch(/^Disallow: \/_seo\/$/m);
  });
});

describe('SEO guard: the committed baseline (docs/design/stage/seo-baseline.json)', () => {
  /** Commits BASE as the baseline, built `days` before NOW (npm run seo:baseline). */
  function commitBaseline(days: number | null) {
    writeDist(BASE);
    const snap = committedBaselineOf(dist, root, new Date(NOW.getTime() - (days ?? 0) * 86_400_000), 'abc');
    const file = join(root, COMMITTED_BASELINE);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, JSON.stringify(days === null ? snap.routes : snap));
  }

  it('live 404 (not published yet): compares against the committed baseline, whatever its age, with a warning', async () => {
    commitBaseline(400);
    writeDist(BASE);
    const ok = await guard({ VERCEL_ENV: 'production' }, serve('', 404));
    expect(ok.out).toMatch(/WARNING: .*404.*committed baseline docs\/design\/stage\/seo-baseline\.json/);
    expect(ok.code).toBe(0);
    writeDist({ ...BASE, '/en/faq': { title: 'Unannounced' } });
    expect((await guard({ VERCEL_ENV: 'production' }, serve('', 404))).code).toBe(1);
  });

  it('live 5xx or unreachable, nothing cached: uses a committed baseline under 30 days old', async () => {
    commitBaseline(10);
    writeDist(BASE);
    const r = await guard({ VERCEL_ENV: 'production' }, serve('oops', 503));
    expect(r.out).toMatch(/WARNING: live baseline unavailable .*HTTP 503.*committed baseline/);
    expect(r.code).toBe(0);
    expect((await guard({}, offline)).code).toBe(0);
    writeDist({ ...BASE, '/en/faq': { title: 'Unannounced' } });
    expect((await guard({}, serve('oops', 503))).code).toBe(1);
  });

  it('live 5xx with a stale (over 30 days) or undated committed baseline: fails closed', async () => {
    commitBaseline(31);
    writeDist(BASE);
    const stale = await guard({ VERCEL_ENV: 'production' }, serve('oops', 503));
    expect(stale.out).toMatch(/31 days old \(max 30/);
    expect(stale.code).toBe(2);
    commitBaseline(null);
    writeDist(BASE);
    const undated = await guard({}, offline);
    expect(undated.out).toMatch(/no built_at date/);
    expect(undated.code).toBe(2);
  });

  it('the build-cache copy still comes before the committed baseline after a network error', async () => {
    commitBaseline(5);
    writeDist({ ...BASE, '/en/faq': { title: 'Changed after the baseline' } });
    mkdirSync(join(root, CACHE_PATH, '..'), { recursive: true });
    writeFileSync(join(root, CACHE_PATH), JSON.stringify({ format: LIVE_SNAPSHOT_FORMAT, built_at: 'x', commit: null, intents: [], routes: collectSnapshot(dist) }));
    const r = await guard({}, offline);
    expect(r.out).toMatch(/using the build-cache copy/);
    expect(r.code).toBe(0);
  });

  it('npm run seo:baseline records built_at, commit and the intent ids', () => {
    writeIntent([faqIntent('publish-9', newTitle())]);
    writeDist(BASE);
    const snap = committedBaselineOf(dist, root, NOW, 'abc');
    expect(snap).toMatchObject({ format: LIVE_SNAPSHOT_FORMAT, built_at: NOW.toISOString(), commit: 'abc', intents: ['publish-9'] });
    expect(Object.keys(snap.routes)).toHaveLength(3);
  });
});

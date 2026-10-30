// Spec §3: every URL that ever appeared in public/sitemap.xml must still
// land on a real, prerendered page (no SPA shell, no 404), in one hop.
// Needs dist/ from `npm run build`; skips with a message when it is absent.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveUrl, type VercelConfig } from '../../scripts/seo/resolveUrl';
import { generatedRedirects, mergeVercelRedirects } from '../../supabase/functions/publish-content/redirects';
import type { ContestRow } from '../../src/content/contests/types';

const root = process.cwd();
const DIST = resolve(root, 'dist');
const hasDist = existsSync(join(DIST, 'en.html')) && existsSync(join(DIST, 'en'));
if (!hasDist) {
  console.warn('[historicalUrls] dist/ is missing: run `npm run build` first. Skipping the historical URL checks.');
}

const vercelText = readFileSync(resolve(root, 'vercel.json'), 'utf8').replace(/\r\n/g, '\n');
const vercel = JSON.parse(vercelText) as VercelConfig;
const urls = readFileSync(resolve(root, 'tests/fixtures/historical-urls.txt'), 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

/** Clean URL of every prerendered page in dist/ (404.html excluded). */
function builtPaths(): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string, prefix: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name === 'en' || e.name === 'el' || prefix) walk(join(dir, e.name), `${prefix}/${e.name}`);
      } else if (e.name.endsWith('.html')) {
        const base = e.name.slice(0, -'.html'.length);
        if (!prefix && base === '404') continue;
        out.add(base === 'index' ? prefix || '/' : `${prefix}/${base}`);
      }
    }
  };
  walk(DIST, '');
  return out;
}

const UNPREFIXED_EN_ONLY = new Set(['/online-games', '/mobile-games']);

function contest(year: number, city_slug: string, stage: ContestRow['stage']): ContestRow {
  return {
    year,
    host_iso: null,
    city: city_slug,
    city_slug,
    semi1_date: null,
    semi2_date: null,
    final_date: null,
    stage,
    indexable: false,
    cancelled: false,
  };
}

describe('historical URLs fixture', () => {
  it('holds the 85 sitemap URLs, unique', () => {
    expect(urls).toHaveLength(85);
    expect(new Set(urls).size).toBe(85);
  });

  it('old 2026 predictions slug is not in the locale-detect slug lists (it would 308 to a 404)', () => {
    for (const r of vercel.redirects ?? []) {
      if (r.source.startsWith('/:slug(')) expect(r.source, r.source).not.toMatch(/\beurovision-2026-predictions\b/);
    }
  });
});

describe.skipIf(!hasDist)('every historical URL resolves to a built page', () => {
  const built = hasDist ? builtPaths() : new Set<string>();

  it('sanity: dist has the locale homes, the hub and the archive', () => {
    for (const p of ['/en', '/el', '/en/eurovision-2026', '/en/past-contests', '/el/countries/greece', '/en/eurovision-predictions']) {
      expect(built.has(p), p).toBe(true);
    }
  });

  it.each(urls)('%s (no Accept-Language)', (url) => {
    const r = resolveUrl(url, vercel, built);
    expect(r, JSON.stringify(r)).toMatchObject({ status: 200, via: 'file' });
    expect(built.has(r.final)).toBe(true);
    expect(r.hops).toBeLessThanOrEqual(1);
    // Unprefixed URLs must hit a real redirect, not the SPA shell.
    if (!/^\/(en|el)(\/|$)/.test(url)) expect(r.hops).toBe(1);
    // A prefixed URL keeps its locale.
    const loc = url.match(/^\/(en|el)(\/|$)/)?.[1];
    if (loc) expect(r.final.startsWith(`/${loc}`)).toBe(true);
  });

  it.each(urls)('%s (accept-language: el)', (url) => {
    const r = resolveUrl(url, vercel, built, { acceptLanguage: 'el-GR,el;q=0.9,en;q=0.8' });
    expect(r, JSON.stringify(r)).toMatchObject({ status: 200, via: 'file' });
    expect(r.hops).toBeLessThanOrEqual(1);
    const loc = url.match(/^\/(en|el)(\/|$)/)?.[1];
    const want = loc ?? (UNPREFIXED_EN_ONLY.has(url) ? 'en' : 'el');
    expect(r.final === `/${want}` || r.final.startsWith(`/${want}/`), r.final).toBe(true);
  });

  it('pins the old→new destinations', () => {
    const want: Array<[string, string]> = [
      ['/en/eurovision-2026-predictions', '/en/eurovision-predictions'],
      ['/el/eurovision-2026-predictions', '/el/eurovision-predictions'],
      ['/eurovision-2026-predictions', '/en/eurovision-predictions'],
      ['/en/eurovision-2026-songs', '/en/eurovision-2026/songs'],
      ['/el/eurovision-2026-schedule', '/el/eurovision-2026/schedule'],
      ['/el/eurovision-2026-semifinals', '/el/eurovision-2026/semifinals'],
      ['/el/eurovision-2026-programma', '/el/eurovision-2026/schedule'],
      ['/el/eurovision-2026-elliniko-tragoudi', '/el/countries/greece'],
      ['/el/eurovision-ellada', '/el/countries/greece'],
      ['/el/eurovision-kypros', '/el/countries/cyprus'],
      ['/en/eurovision-history', '/en/past-contests'],
      ['/en/eurovision-bingo', '/en/eurovision-games'],
      ['/en/eurovision-sweepstake', '/en/eurovision-games'],
      ['/en/best-eurovision-app', '/en/eurovision-games'],
      ['/el/compare/eurovision-games-vs-bingo', '/el/eurovision-games'],
      ['/en/eurovision-drinking-game', '/en/eurovision-party'],
      ['/en/printables', '/en/eurovision-party'],
      ['/el/glossary', '/el/faq'],
      ['/en/eurovision-quiz', '/en/eurovision-trivia'],
      ['/el/host-eurovision-party', '/el/eurovision-party'],
      ['/', '/en'],
    ];
    for (const [from, to] of want) expect(resolveUrl(from, vercel, built).final, from).toBe(to);
    expect(resolveUrl('/eurovision-2026-predictions', vercel, built, { acceptLanguage: 'el' }).final).toBe(
      '/el/eurovision-predictions',
    );
  });

  it('unprefixed Greek-word slugs redirect straight to /el/<new>, whatever the browser language', () => {
    const greek: Array<[string, string]> = [
      ['/eurovision-ellada', '/el/countries/greece'],
      ['/eurovision-kypros', '/el/countries/cyprus'],
      ['/eurovision-2026-elliniko-tragoudi', '/el/countries/greece'],
      ['/eurovision-2026-programma', '/el/eurovision-2026/schedule'],
    ];
    for (const [from, to] of greek) {
      for (const acceptLanguage of [undefined, 'en-US,en;q=0.9', 'el-GR']) {
        expect(resolveUrl(from, vercel, built, { acceptLanguage }), `${from} ${acceptLanguage}`).toEqual({
          final: to,
          hops: 1,
          status: 200,
          via: 'file',
        });
      }
      const r = (vercel.redirects ?? []).find((x) => x.source === from);
      expect(r?.has, from).toBeUndefined();
    }
  });

  it('other unprefixed old slugs redirect straight to /en/<new> (not via the SPA shell)', () => {
    const olds = [
      'eurovision-2026-schedule',
      'eurovision-2026-semifinals',
      'eurovision-2026-songs',
      'eurovision-history',
      'eurovision-bingo',
      'eurovision-drinking-game',
      'eurovision-sweepstake',
      'glossary',
      'printables',
      'best-eurovision-app',
      'compare/x-vs-y',
    ];
    for (const o of olds) {
      const r = resolveUrl(`/${o}`, vercel, built);
      expect(r, o).toMatchObject({ status: 200, via: 'file', hops: 1 });
      expect(r.final.startsWith('/en/'), o).toBe(true);
    }
  });

  it('an unbuilt, unredirected locale path is a hard 404', () => {
    expect(resolveUrl('/en/eurovision-1066', vercel, built)).toMatchObject({ status: 404 });
    expect(resolveUrl('/el/no-such-page', vercel, built)).toMatchObject({ status: 404 });
  });

  describe('after Archive 2026 (vienna)', () => {
    const contests = [contest(2025, 'basel', 'archived'), contest(2026, 'vienna', 'archived'), contest(2027, 'burgas', 'current')];
    const archived = JSON.parse(mergeVercelRedirects(vercelText, generatedRedirects(contests))) as VercelConfig;
    const builtArchived = new Set([...built, '/en/past-contests/eurovision-2026-vienna', '/el/past-contests/eurovision-2026-vienna']);
    const page = '/en/past-contests/eurovision-2026-vienna';

    it.each([
      ['/en/eurovision-2026', 1],
      ['/en/eurovision-2026/songs', 1],
      ['/en/eurovision-2026/schedule', 1],
      ['/eurovision-2026', 1],
      ['/en/eurovision-2026-songs', 2],
      ['/en/eurovision-2026-semifinals', 2],
    ] as const)('%s → the archive page in %i hop(s)', (url, hops) => {
      expect(resolveUrl(url, archived, builtArchived)).toEqual({ final: page, hops, status: 200, via: 'file' });
    });

    it('Greek hub URLs go to the Greek archive page', () => {
      expect(resolveUrl('/el/eurovision-2026/semifinals', archived, builtArchived).final).toBe(
        '/el/past-contests/eurovision-2026-vienna',
      );
      expect(resolveUrl('/el/eurovision-2026-programma', archived, builtArchived)).toMatchObject({
        final: '/el/past-contests/eurovision-2026-vienna',
        hops: 2,
      });
    });

    it.each(urls)('%s still resolves to a built page within 2 hops', (url) => {
      const r = resolveUrl(url, archived, builtArchived);
      expect(r, JSON.stringify(r)).toMatchObject({ status: 200, via: 'file' });
      expect(r.hops).toBeLessThanOrEqual(2);
    });
  });
});

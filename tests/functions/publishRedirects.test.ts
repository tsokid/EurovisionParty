// publish-content/redirects.ts: archived-year hub redirects in vercel.json.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatedRedirects, mergeVercelRedirects } from '../../supabase/functions/publish-content/redirects';
import type { ContestRow } from '../../src/content/contests/types';
import { localInput } from '../../scripts/snapshot/build-local';
import { resolveUrl, type VercelConfig } from '../../scripts/seo/resolveUrl';

// LF as in the repo blob, whatever core.autocrlf did to the working copy.
const vercelJson = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8').replace(/\r\n/g, '\n');

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

const archived2026 = [contest(2025, 'basel', 'archived'), contest(2026, 'vienna', 'archived'), contest(2027, 'burgas', 'current')];
const live2026 = [contest(2025, 'basel', 'archived'), contest(2026, 'vienna', 'finalized'), contest(2027, 'burgas', 'upcoming')];

// The hub shape only: static flat-slug redirects such as /eurovision-2026-songs
// (Task 9) share the prefix but are not generated.
const yearSources = (json: string, year: number) =>
  (JSON.parse(json).redirects as Array<{ source: string }>).filter((r) =>
    new RegExp(`/eurovision-${year}(/|$)`).test(r.source),
  );

const EL = [{ type: 'header', key: 'accept-language', value: '(?<l>.*\\bel\\b.*)' }];

describe('generatedRedirects', () => {
  it('emits three redirect shapes per archived year by year, then the live hub locale-detect redirects (M8)', () => {
    const r = generatedRedirects(archived2026);
    expect(r).toEqual([
      { source: '/:locale(en|el)/eurovision-2025', destination: '/:locale/past-contests/eurovision-2025-basel', permanent: true },
      { source: '/:locale(en|el)/eurovision-2025/:sub(schedule|semifinals|songs)', destination: '/:locale/past-contests/eurovision-2025-basel', permanent: true },
      { source: '/eurovision-2025', destination: '/en/past-contests/eurovision-2025-basel', permanent: true },
      { source: '/:locale(en|el)/eurovision-2026', destination: '/:locale/past-contests/eurovision-2026-vienna', permanent: true },
      { source: '/:locale(en|el)/eurovision-2026/:sub(schedule|semifinals|songs)', destination: '/:locale/past-contests/eurovision-2026-vienna', permanent: true },
      { source: '/eurovision-2026', destination: '/en/past-contests/eurovision-2026-vienna', permanent: true },
      { source: '/eurovision-2027', has: EL, destination: '/el/eurovision-2027', permanent: true },
      { source: '/eurovision-2027', destination: '/en/eurovision-2027', permanent: true },
      { source: '/eurovision-2027/:sub(schedule|semifinals|songs)', has: EL, destination: '/el/eurovision-2027/:sub', permanent: true },
      { source: '/eurovision-2027/:sub(schedule|semifinals|songs)', destination: '/en/eurovision-2027/:sub', permanent: true },
    ]);
  });

  it('live hub: the current or finalized year, else the latest upcoming, else none', () => {
    const live = (cs: ContestRow[]) =>
      generatedRedirects(cs).filter((r) => !r.destination.includes('past-contests')).map((r) => r.destination);
    expect(live(live2026)).toEqual(['/el/eurovision-2026', '/en/eurovision-2026', '/el/eurovision-2026/:sub', '/en/eurovision-2026/:sub']);
    expect(live([contest(2025, 'basel', 'archived'), contest(2026, 'x', 'upcoming'), contest(2027, 'y', 'upcoming')])[0]).toBe(
      '/el/eurovision-2027',
    );
    expect(live([contest(2025, 'basel', 'archived')])).toEqual([]);
  });

  it('ignores input order', () => {
    expect(generatedRedirects([...archived2026].reverse())).toEqual(generatedRedirects(archived2026));
  });
});

describe('mergeVercelRedirects', () => {
  // The repo state before Archive 2026: 2025 archived, 2026 live.
  const live = mergeVercelRedirects(vercelJson, generatedRedirects(live2026));
  type R = { source: string; destination: string; has?: unknown };
  const redirectsOf = (json: string) => JSON.parse(json).redirects as R[];
  const isYearSource = (r: R) => /\/eurovision-\d{4}(\/|$)/.test(r.source);

  it('archiving 2026 replaces its live-hub redirects with three archive redirects, after the others', () => {
    expect(yearSources(live, 2026).map((r) => r.source)).toEqual([
      '/eurovision-2026',
      '/eurovision-2026',
      '/eurovision-2026/:sub(schedule|semifinals|songs)',
      '/eurovision-2026/:sub(schedule|semifinals|songs)',
    ]);
    const out = mergeVercelRedirects(live, generatedRedirects(archived2026));
    expect(yearSources(out, 2026).map((r) => r.source)).toEqual([
      '/:locale(en|el)/eurovision-2026',
      '/:locale(en|el)/eurovision-2026/:sub(schedule|semifinals|songs)',
      '/eurovision-2026',
    ]);
    const kept = redirectsOf(live).filter((r) => !isYearSource(r));
    expect(redirectsOf(out).slice(0, kept.length).map((r) => r.source)).toEqual(kept.map((r) => r.source));
    expect(redirectsOf(out)).toHaveLength(kept.length + 3 * 2 + 4);
  });

  it('archiving 2026 repoints static redirects into its hub to the archive page (M2); un-archiving points them back', () => {
    const hubDest = /\/eurovision-2026(\/|$)/;
    const intoHub = redirectsOf(live).filter((r) => hubDest.test(r.destination) && !isYearSource(r));
    expect(intoHub.length).toBeGreaterThanOrEqual(8); // flat legacy slugs, prefixed and not
    const out = mergeVercelRedirects(live, generatedRedirects(archived2026));
    for (const r of redirectsOf(out)) expect(r.destination, r.source).not.toMatch(hubDest);
    const bySource = (json: string, source: string) => redirectsOf(json).find((r) => r.source === source && !r.has)!.destination;
    expect(bySource(out, '/:locale(en|el)/eurovision-2026-schedule')).toBe('/:locale/past-contests/eurovision-2026-vienna');
    expect(bySource(out, '/eurovision-2026-songs')).toBe('/en/past-contests/eurovision-2026-vienna');
    expect(bySource(out, '/eurovision-2026-programma')).toBe('/el/past-contests/eurovision-2026-vienna');
    // Un-archive: back to the hub root (the subpage is not recorded); no dead archive targets.
    const back = mergeVercelRedirects(out, generatedRedirects(live2026));
    expect(bySource(back, '/:locale(en|el)/eurovision-2026-schedule')).toBe('/:locale/eurovision-2026');
    expect(bySource(back, '/eurovision-2026-songs')).toBe('/en/eurovision-2026');
    for (const r of redirectsOf(back)) expect(r.destination, r.source).not.toMatch(/eurovision-2026-vienna/);
  });

  it('un-archiving 2026 removes its archive redirects again', () => {
    const archived = mergeVercelRedirects(live, generatedRedirects(archived2026));
    const unarchived = mergeVercelRedirects(archived, generatedRedirects(live2026));
    const y2026 = yearSources(unarchived, 2026);
    expect(y2026).toHaveLength(4); // the live-hub redirects only
    expect(y2026.every((r) => r.source.startsWith('/eurovision-2026'))).toBe(true);
    expect(yearSources(unarchived, 2025)).toHaveLength(3);
  });

  it('is idempotent', () => {
    const once = mergeVercelRedirects(vercelJson, generatedRedirects(archived2026));
    expect(mergeVercelRedirects(once, generatedRedirects(archived2026))).toBe(once);
  });

  it('leaves non-year redirects and every other key untouched, including look-alike slugs', () => {
    const base = JSON.parse(vercelJson);
    // The committed file already holds generated year redirects; merging with none drops them.
    const generatedInBase = base.redirects.filter((r: { source: string }) => /\/eurovision-\d{4}(\/|$)/.test(r.source)).length;
    expect(generatedInBase).toBe(70 * 3 + 4);
    base.redirects.push(
      { source: '/:locale(en|el)/eurovision-2026-predictions', destination: '/:locale/eurovision-predictions', permanent: true },
      { source: '/eurovision-history', destination: '/en/past-contests', permanent: true },
      { source: '/el/eurovision-2026-programma', destination: '/el/eurovision-2026/schedule', permanent: true },
      { source: '/:locale(en|el)/eurovision-1999/songs', destination: '/stale', permanent: true },
    );
    const input = JSON.stringify(base, null, 2) + '\n';
    const out = JSON.parse(mergeVercelRedirects(input, []));
    const sources = out.redirects.map((r: { source: string }) => r.source);
    expect(sources).toContain('/:locale(en|el)/eurovision-2026-predictions');
    expect(sources).toContain('/eurovision-history');
    expect(sources).toContain('/el/eurovision-2026-programma');
    expect(sources).not.toContain('/:locale(en|el)/eurovision-1999/songs');
    expect(out.redirects).toHaveLength(base.redirects.length - generatedInBase - 1);
    const { redirects: _a, ...restOut } = out;
    const { redirects: _b, ...restBase } = base;
    expect(restOut).toEqual(restBase);
    expect(Object.keys(out)).toEqual(Object.keys(base));
  });

  it('writes 2-space JSON with a trailing newline', () => {
    const out = mergeVercelRedirects(vercelJson, generatedRedirects(archived2026));
    expect(out).toBe(JSON.stringify(JSON.parse(out), null, 2) + '\n');
  });
});

describe('committed vercel.json', () => {
  it('is 2-space JSON with a trailing newline (the format publish writes)', () => {
    expect(vercelJson).toBe(JSON.stringify(JSON.parse(vercelJson), null, 2) + '\n');
  });

  it('equals what Publish writes for the local snapshot (M1: build-local merges the generated redirects)', () => {
    const contests = localInput().contests;
    expect(vercelJson).toBe(mergeVercelRedirects(vercelJson, generatedRedirects(contests)));
    const archivedYears = contests.filter((c) => c.stage === 'archived').length;
    expect(archivedYears).toBe(70);
    expect(generatedRedirects(contests)).toHaveLength(archivedYears * 3 + 4);
    expect(yearSources(vercelJson, 1999)).toHaveLength(3);
  });

  it("stays under Vercel's 1024-route limit", () => {
    const cfg = JSON.parse(vercelJson);
    expect(cfg.redirects.length + cfg.rewrites.length + cfg.headers.length).toBeLessThan(1024);
  });

  it.each([
    ['/eurovision-2026', undefined, '/en/eurovision-2026'],
    ['/eurovision-2026', 'el-GR,el;q=0.9', '/el/eurovision-2026'],
    ['/eurovision-2026/semifinals', undefined, '/en/eurovision-2026/semifinals'],
    ['/eurovision-2026/songs', 'el', '/el/eurovision-2026/songs'],
    ['/past-contests', undefined, '/en/past-contests'],
    ['/past-contests', 'el', '/el/past-contests'],
    ['/countries', undefined, '/en/countries'],
    ['/countries', 'el-GR', '/el/countries'],
    ['/eurovision-predictions', undefined, '/en/eurovision-predictions'],
    ['/eurovision-predictions', 'el', '/el/eurovision-predictions'],
  ])('M8: unprefixed %s (accept-language %s) redirects to %s in one hop', (from, acceptLanguage, to) => {
    const built = new Set([to]);
    expect(resolveUrl(from, JSON.parse(vercelJson) as VercelConfig, built, { acceptLanguage })).toEqual({
      final: to,
      hops: 1,
      status: 200,
      via: 'file',
    });
  });
});

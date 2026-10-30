// publish-content/redirects.ts: archived-year hub redirects in vercel.json.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatedRedirects, mergeVercelRedirects } from '../../supabase/functions/publish-content/redirects';
import type { ContestRow } from '../../src/content/contests/types';

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

describe('generatedRedirects', () => {
  it('emits three redirect shapes for an archived year, none for others, by year', () => {
    const r = generatedRedirects(archived2026);
    expect(r).toEqual([
      { source: '/:locale(en|el)/eurovision-2025', destination: '/:locale/past-contests/eurovision-2025-basel', permanent: true },
      { source: '/:locale(en|el)/eurovision-2025/:sub(schedule|semifinals|songs)', destination: '/:locale/past-contests/eurovision-2025-basel', permanent: true },
      { source: '/eurovision-2025', destination: '/en/past-contests/eurovision-2025-basel', permanent: true },
      { source: '/:locale(en|el)/eurovision-2026', destination: '/:locale/past-contests/eurovision-2026-vienna', permanent: true },
      { source: '/:locale(en|el)/eurovision-2026/:sub(schedule|semifinals|songs)', destination: '/:locale/past-contests/eurovision-2026-vienna', permanent: true },
      { source: '/eurovision-2026', destination: '/en/past-contests/eurovision-2026-vienna', permanent: true },
    ]);
  });

  it('ignores input order', () => {
    expect(generatedRedirects([...archived2026].reverse())).toEqual(generatedRedirects(archived2026));
  });
});

describe('mergeVercelRedirects', () => {
  it('archiving 2026 adds its three redirects after the existing ones', () => {
    const out = mergeVercelRedirects(vercelJson, generatedRedirects(archived2026));
    expect(yearSources(out, 2026).map((r) => r.source)).toEqual([
      '/:locale(en|el)/eurovision-2026',
      '/:locale(en|el)/eurovision-2026/:sub(schedule|semifinals|songs)',
      '/eurovision-2026',
    ]);
    const before = JSON.parse(vercelJson).redirects;
    const after = JSON.parse(out).redirects;
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after).toHaveLength(before.length + 6);
  });

  it('un-archiving 2026 removes its redirects again', () => {
    const archived = mergeVercelRedirects(vercelJson, generatedRedirects(archived2026));
    const unarchived = mergeVercelRedirects(archived, generatedRedirects(live2026));
    expect(yearSources(unarchived, 2026)).toEqual([]);
    expect(yearSources(unarchived, 2025)).toHaveLength(3);
  });

  it('is idempotent and reproduces the committed file when nothing is archived', () => {
    const once = mergeVercelRedirects(vercelJson, generatedRedirects(archived2026));
    expect(mergeVercelRedirects(once, generatedRedirects(archived2026))).toBe(once);
    expect(mergeVercelRedirects(vercelJson, [])).toBe(vercelJson);
  });

  it('leaves non-year redirects and every other key untouched, including look-alike slugs', () => {
    const base = JSON.parse(vercelJson);
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
    expect(out.redirects).toHaveLength(base.redirects.length - 1);
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
});

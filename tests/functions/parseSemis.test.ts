import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSemis, semiProblem, semiUrl, type SemiRow } from '../../supabase/functions/eurovision-parse/parseSemis';

const here = path.dirname(fileURLToPath(import.meta.url));
const SF1 = readFileSync(path.join(here, 'fixtures/semi-basel-2025-sf1.html'), 'utf8');

describe('parseSemis on the Basel 2025 first semi-final', () => {
  const rows = parseSemis(SF1);

  it('finds the 15 entries once each, with places 1-15', () => {
    expect(rows).toHaveLength(15);
    expect(new Set(rows.map((r) => r.iso)).size).toBe(15);
    expect(rows.map((r) => r.place).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it('splits 10 qualifiers from 5 non-qualifiers by section heading', () => {
    const q = rows.filter((r) => r.qualified === true).map((r) => r.iso);
    const nq = rows.filter((r) => r.qualified === false).map((r) => r.iso);
    expect(q).toEqual(['UA', 'AL', 'NL', 'SE', 'EE', 'IS', 'PL', 'NO', 'PT', 'SM']);
    expect(nq).toEqual(['CY', 'HR', 'SI', 'BE', 'AZ']);
  });

  it('matches the Ukraine row exactly', () => {
    expect(rows[0]).toEqual({
      iso: 'UA', country: 'Ukraine', artist: 'Ziferblat', song: 'Bird of Pray',
      runningOrder: 5, place: 1, points: 137, qualified: true,
    });
  });

  it('reads an artist that is not a link, and the last place', () => {
    expect(rows.find((r) => r.iso === 'AZ')).toEqual({
      iso: 'AZ', country: 'Azerbaijan', artist: 'Mamagama', song: 'Run With U',
      runningOrder: 10, place: 15, points: 7, qualified: false,
    });
  });

  it('trims names and keeps points of the non-qualifiers', () => {
    expect(rows.find((r) => r.iso === 'AL')).toMatchObject({ artist: 'Shkodra Elektronike', place: 2, points: 122, runningOrder: 12 });
    expect(rows.find((r) => r.iso === 'NL')).toMatchObject({ song: "C'est La Vie", place: 3, points: 121 });
    expect(rows.filter((r) => !r.qualified).map((r) => [r.iso, r.place, r.points])).toEqual([
      ['CY', 11, 44], ['HR', 12, 28], ['SI', 13, 23], ['BE', 14, 23], ['AZ', 15, 7],
    ]);
  });

  it('gives the same rows when every tag carries realistic class and data attributes', () => {
    // Tailwind-like classes (with '>' inside arbitrary variants, as real
    // pages have) and data-* attributes on every opening tag, before the
    // tag's own attributes.
    const cls =
      'flex flex-col items-center justify-between gap-2 rounded-lg bg-white/5 px-4 py-3 text-sm font-semibold ' +
      'leading-tight tracking-tight md:flex-row md:gap-4 lg:px-6 [&>svg]:size-4 [&>p]:truncate hover:bg-white/10';
    expect(cls.length).toBeGreaterThan(100);
    let n = 0;
    const noisy = SF1.replace(
      /<([a-zA-Z][a-zA-Z0-9]*)(?=[\s>])/g,
      (_, tag: string) => `<${tag} class="${cls}" data-v-7a1c="" data-testid="node-${n++}" data-points="99 points"`,
    );
    expect(noisy.length).toBeGreaterThan(SF1.length * 5);
    expect(parseSemis(noisy)).toEqual(rows);
  });

  it('finds artist and song when the country text differs from the aria-label', () => {
    const odd = SF1.replace('data-country-name="">Ukraine</p>', 'data-country-name=""> UKRAINE <span>🇺🇦</span></p>');
    expect(parseSemis(odd)[0]).toMatchObject({ iso: 'UA', artist: 'Ziferblat', song: 'Bird of Pray' });
  });

  it('dedupes an entry that appears twice', () => {
    expect(parseSemis(SF1 + SF1)).toHaveLength(15);
  });

  it('returns no rows for a page without a scoreboard, such as a Cloudflare challenge', () => {
    expect(parseSemis('<html><title>Just a moment...</title></html>')).toEqual([]);
  });

  it('leaves qualified null when no section heading precedes an entry', () => {
    const one = SF1.slice(SF1.indexOf('<div data-entry-id'));
    expect(parseSemis(one)[0]).toMatchObject({ iso: 'UA', qualified: null });
  });

  it('raises on a country it cannot map', () => {
    expect(() => parseSemis(SF1.replace(/Scoreboard entry for Ukraine/, 'Scoreboard entry for Atlantis'))).toThrow(
      /unknown country Atlantis/,
    );
  });
});

describe('semiProblem (sanity gate before the upsert)', () => {
  const rows = parseSemis(SF1);

  it('passes the real page', () => {
    expect(semiProblem(rows)).toBeNull();
  });

  it('refuses fewer than 10 rows', () => {
    expect(semiProblem(rows.slice(0, 9))).toMatch(/only 9 entries parsed/);
    expect(semiProblem([])).toMatch(/only 0 entries parsed/);
  });

  it('refuses a row with a null place, points or running order', () => {
    for (const key of ['place', 'points', 'runningOrder'] as const) {
      const broken: SemiRow[] = rows.map((r, i) => (i === 3 ? { ...r, [key]: null } : r));
      expect(semiProblem(broken)).toMatch(new RegExp(`SE has no ${key === 'runningOrder' ? 'running order' : key}`));
    }
  });

  it('refuses a page without any qualifier', () => {
    expect(semiProblem(rows.map((r) => ({ ...r, qualified: null })))).toMatch(/no qualifiers/);
    expect(semiProblem(rows.map((r) => ({ ...r, qualified: false })))).toMatch(/no qualifiers/);
  });
});

describe('semiUrl', () => {
  it('derives the eurovision.com semi-final URLs from the city slug', () => {
    expect(semiUrl('basel', 2025, 1)).toBe(
      'https://www.eurovision.com/eurovision-song-contest/basel-2025/basel-2025-first-semi-final/',
    );
    expect(semiUrl('vienna', 2026, 2)).toBe(
      'https://www.eurovision.com/eurovision-song-contest/vienna-2026/vienna-2026-second-semi-final/',
    );
  });
});

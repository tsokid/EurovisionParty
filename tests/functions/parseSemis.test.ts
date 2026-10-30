import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSemis, semiUrl } from '../../supabase/functions/eurovision-parse/parseSemis';

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

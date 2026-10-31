// @vitest-environment node
// Invariants over the committed import output data/history/*.json. These are
// the gate for the Wikipedia import: a parse regression or a bad manual edit
// fails here before it reaches migration 073.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContestRecord } from '../../../scripts/history/parseContest';
import { toIso } from '../../../scripts/history/countryNames';
import { buildMigration, loadRecords, slugify } from '../../../scripts/history/import';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../..');
const DATA = path.join(ROOT, 'data/history');

const files = readdirSync(DATA).filter((f) => f.endsWith('.json')).sort();
const records: ContestRecord[] = files.map((f) => JSON.parse(readFileSync(path.join(DATA, f), 'utf8')));
const byYear = new Map(records.map((r) => [r.year, r]));
const played = records.filter((r) => !r.cancelled);

// ISOs seeded by migration 070.
const seed070 = readFileSync(path.join(ROOT, 'supabase/migrations/070_contests_core.sql'), 'utf8');
const countriesBlock = seed070.slice(seed070.indexOf('insert into public.countries'), seed070.indexOf('on conflict (iso)'));
const SEEDED = new Set([...countriesBlock.matchAll(/\('([A-Z]{2})',/g)].map((m) => m[1]));

/** The one entry the 2024 final table strikes through (disqualified before the show). */
const DISQUALIFIED = new Set(['2024:NL']);

// Entries per year (finalists + semi-finalists), verified against the
// historical participant counts. A parse change that drops or adds a row
// fails here.
const EXPECTED_ENTRIES: Record<number, number> = {
  1956: 7, 1957: 10, 1958: 10, 1959: 11, 1960: 13, 1961: 16, 1962: 16, 1963: 16,
  1964: 16, 1965: 18, 1966: 18, 1967: 17, 1968: 17, 1969: 16, 1970: 12, 1971: 18,
  1972: 18, 1973: 17, 1974: 17, 1975: 19, 1976: 18, 1977: 18, 1978: 20, 1979: 19,
  1980: 19, 1981: 20, 1982: 18, 1983: 20, 1984: 19, 1985: 19, 1986: 20, 1987: 22,
  1988: 21, 1989: 22, 1990: 22, 1991: 22, 1992: 23, 1993: 25, 1994: 25, 1995: 23,
  1996: 23, 1997: 25, 1998: 25, 1999: 23, 2000: 24, 2001: 23, 2002: 24, 2003: 26,
  2004: 36, 2005: 39, 2006: 37, 2007: 42, 2008: 43, 2009: 42, 2010: 39, 2011: 43,
  2012: 42, 2013: 39, 2014: 37, 2015: 40, 2016: 42, 2017: 42, 2018: 43, 2019: 41,
  2020: 41, 2021: 39, 2022: 40, 2023: 37, 2024: 37, 2025: 37,
};

/**
 * 2026 is imported with --snapshot-only (data/history only, never 073):
 * 35 entries, 25 finalists.
 */
const EXPECTED_2026 = 35;

/**
 * Competition ranking: sorted by place, places run 1..N, a shared place
 * needs equal points, and points never increase down the ranking.
 */
function expectRanking(label: string, rows: { iso: string; place: number | null; points: number | null }[]): void {
  const ranked = [...rows].sort((a, b) => a.place! - b.place!);
  ranked.forEach((e, i) => {
    expect(e.place, `${label} ${e.iso} place`).not.toBeNull();
    expect(e.points, `${label} ${e.iso} points`).not.toBeNull();
    if (i === 0) return expect(e.place, label).toBe(1);
    const prev = ranked[i - 1];
    expect(prev.points!, `${label} ${e.iso}`).toBeGreaterThanOrEqual(e.points!);
    if (e.place === prev.place) expect(e.points, `${label} ${e.iso} shared place`).toBe(prev.points);
    else expect(e.place, `${label} ${e.iso}`).toBe(i + 1);
  });
}

describe('history data: coverage', () => {
  it('has the pinned number of entries per year', () => {
    expect(Object.keys(EXPECTED_ENTRIES)).toHaveLength(70);
    expect(Object.fromEntries(records.map((r) => [r.year, r.entries.length]))).toEqual({
      ...EXPECTED_ENTRIES,
      2026: EXPECTED_2026,
    });
    expect(byYear.get(2026)!.entries.filter((e) => e.in_final)).toHaveLength(25);
  });

  it('has exactly one file per year 1956–2026', () => {
    expect(files).toEqual(Array.from({ length: 71 }, (_, i) => `${1956 + i}.json`));
    for (const r of records) expect(files).toContain(`${r.year}.json`);
  });

  it('seeds the 52 countries this test checks against', () => {
    expect(SEEDED.size).toBe(52);
  });

  it('marks only 2020 as cancelled, with no results', () => {
    expect(records.filter((r) => r.cancelled).map((r) => r.year)).toEqual([2020]);
    const c2020 = byYear.get(2020)!;
    expect(c2020.entries.length).toBeGreaterThan(0);
    for (const e of c2020.entries) {
      expect(e).toMatchObject({
        final_place: null, total_points: null, jury_points: null, televote_points: null,
        semi_place: null, semi_points: null, qualified: null, in_final: false,
      });
    }
  });
});

describe('history data: per-year invariants', () => {
  it.each(records.map((r) => [r.year, r] as const))('%i: ISOs are seeded and unique, city slug is valid', (_, r) => {
    expect(SEEDED.has(r.host_iso)).toBe(true);
    const isos = r.entries.map((e) => e.iso);
    expect(new Set(isos).size).toBe(isos.length);
    for (const iso of isos) expect(SEEDED.has(iso), `${r.year} ${iso}`).toBe(true);
    expect(slugify(r.city)).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(r.final_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const e of r.entries) {
      expect(e.artist, `${r.year} ${e.iso} artist`).toBeTruthy();
      expect(e.song, `${r.year} ${e.iso} song`).toBeTruthy();
      expect(`${e.artist} ${e.song}`).not.toMatch(/[{}[\]|<>]|''/);
    }
  });

  it.each(played.map((r) => [r.year, r] as const))('%i: final places run 1..N in points order', (_, r) => {
    const finalists = r.entries.filter((e) => e.in_final);
    expect(finalists.length).toBeGreaterThan(0);
    expect(finalists.filter((e) => e.final_place === 1).length).toBeGreaterThanOrEqual(1);

    // 1956: only the winner was announced.
    if (r.year === 1956) {
      expect(finalists.filter((e) => e.final_place !== null).map((e) => e.iso)).toEqual(['CH']);
      return;
    }
    const ranked = [...finalists].sort((a, b) => a.final_place! - b.final_place!);
    ranked.forEach((e, i) => {
      expect(e.final_place, `${r.year} ${e.iso}`).not.toBeNull();
      expect(e.total_points, `${r.year} ${e.iso}`).not.toBeNull();
      if (i === 0) return expect(e.final_place).toBe(1);
      const prev = ranked[i - 1];
      expect(prev.total_points!).toBeGreaterThanOrEqual(e.total_points!);
      if (e.final_place === prev.final_place) {
        // A shared place needs equal points.
        expect(e.total_points).toBe(prev.total_points);
      } else {
        // Competition ranking: after k entries the next place is k + 1.
        expect(e.final_place).toBe(i + 1);
      }
    });
    // Ties for the win only in 1969.
    if (r.year !== 1969) expect(ranked.filter((e) => e.final_place === 1)).toHaveLength(1);
  });

  it.each(played.map((r) => [r.year, r] as const))('%i: final running orders are unique', (_, r) => {
    const finalists = r.entries.filter((e) => e.in_final);
    const orders = finalists.map((e) => e.final_running_order).filter((o): o is number => o !== null);
    expect(new Set(orders).size).toBe(orders.length);
    // Every finalist has one, except 1956's merged two-song rows (only the
    // winner, CH, keeps its order). NL 2024 is not a finalist and has none.
    const missing = finalists.filter((e) => e.final_running_order === null).map((e) => e.iso);
    if (r.year === 1956) expect(missing).toEqual(['BE', 'DE', 'FR', 'IT', 'LU', 'NL']);
    else expect(missing).toEqual([]);
    // Orders run 1..N; 2024 skips slot 5, NL's slot before its disqualification.
    const expected =
      r.year === 1956 ? [9]
      : r.year === 2024 ? Array.from({ length: 26 }, (_, i) => i + 1).filter((o) => o !== 5)
      : Array.from({ length: orders.length }, (_, i) => i + 1);
    expect([...orders].sort((a, b) => a - b)).toEqual(expected);
  });

  it.each(played.filter((r) => r.year >= 2004).map((r) => [r.year, r] as const))(
    '%i: semi places run 1..N in points order',
    (_, r) => {
      for (const n of [1, 2] as const) {
        const semi = r.entries.filter((e) => e.semi === n);
        if (semi.length === 0) continue;
        expectRanking(`${r.year} semi ${n}`, semi.map((e) => ({ iso: e.iso, place: e.semi_place, points: e.semi_points })));
      }
    },
  );

  it.each(played.map((r) => [r.year, r] as const))('%i: jury + televote = total where known', (_, r) => {
    for (const e of r.entries) {
      expect(e.jury_points === null, `${r.year} ${e.iso}`).toBe(e.televote_points === null);
      if (e.jury_points !== null) expect(e.jury_points + e.televote_points!).toBe(e.total_points);
      if (!e.in_final) expect(e.jury_points).toBeNull();
    }
  });

  it.each(played.map((r) => [r.year, r] as const))('%i: semi data is consistent', (_, r) => {
    const semis = r.entries.filter((e) => e.semi !== null);
    if (r.year < 2004) {
      expect(semis).toHaveLength(0);
      for (const e of r.entries) expect(e).toMatchObject({ in_final: true, qualified: null });
      return;
    }
    // From 2004: semi and qualified are required for every semi entry.
    expect(semis.length).toBeGreaterThan(0);
    expect(r.entries.filter((e) => e.semi === 2).length > 0).toBe(r.year >= 2008);
    for (const e of semis) {
      expect(typeof e.qualified, `${r.year} ${e.iso}`).toBe('boolean');
      if (DISQUALIFIED.has(`${r.year}:${e.iso}`)) {
        expect(e).toMatchObject({ qualified: true, in_final: false, final_place: null });
      } else {
        expect(e.in_final, `${r.year} ${e.iso}`).toBe(e.qualified);
      }
      expect(e.semi_place).not.toBeNull();
      expect(e.semi_points).not.toBeNull();
    }
    for (const n of [1, 2] as const) {
      const s = semis.filter((e) => e.semi === n);
      if (s.length) expect(s.filter((e) => e.qualified)).toHaveLength(10);
    }
    // Everyone else is a pre-qualified finalist.
    for (const e of r.entries.filter((x) => x.semi === null)) expect(e).toMatchObject({ in_final: true, qualified: null });
  });
});

// Hand-checked reference list (formerly hardcoded in the winners page copy,
// which now renders from the snapshot): an independent cross-check of the import.
const KNOWN_WINNERS = [
  ['2025', 'Austria', 'JJ', 'Wasted Love', '436'],
  ['2024', 'Switzerland', 'Nemo', 'The Code', '591'],
  ['2023', 'Sweden', 'Loreen', 'Tattoo', '583'],
  ['2022', 'Ukraine', 'Kalush Orchestra', 'Stefania', '631'],
  ['2021', 'Italy', 'Måneskin', 'Zitti e buoni', '524'],
  ['2019', 'Netherlands', 'Duncan Laurence', 'Arcade', '498'],
  ['2018', 'Israel', 'Netta', 'Toy', '529'],
  ['2017', 'Portugal', 'Salvador Sobral', 'Amar pelos dois', '758'],
  ['2016', 'Ukraine', 'Jamala', '1944', '534'],
  ['2015', 'Sweden', 'Måns Zelmerlöw', 'Heroes', '365'],
  ['2014', 'Austria', 'Conchita Wurst', 'Rise Like a Phoenix', '290'],
  ['2013', 'Denmark', 'Emmelie de Forest', 'Only Teardrops', '281'],
  ['2012', 'Sweden', 'Loreen', 'Euphoria', '372'],
  ['2011', 'Azerbaijan', 'Ell & Nikki', 'Running Scared', '221'],
  ['2010', 'Germany', 'Lena', 'Satellite', '246'],
] as const;

describe('history data: winners 2010–2025 match the reference list', () => {
  it.each(KNOWN_WINNERS.map((row) => [Number(row[0]), row] as const))('%i', (year, row) => {
    const [, country, , song, points] = row;
    const winners = byYear.get(year)!.entries.filter((e) => e.final_place === 1);
    expect(winners).toHaveLength(1);
    expect(winners[0]).toMatchObject({ iso: toIso(country), song, total_points: Number(points) });
  });

  it('covers every year 2010–2025 except 2020', () => {
    expect(KNOWN_WINNERS.map((r) => Number(r[0])).sort()).toEqual(
      Array.from({ length: 16 }, (_, i) => 2010 + i).filter((y) => y !== 2020),
    );
  });
});

describe('history data: 073 never includes 2026', () => {
  it('regenerating 073 from data/history gives the committed migration, 1956–2025 only', () => {
    const loaded = loadRecords();
    expect(loaded.map((r) => r.year)).toEqual(Array.from({ length: 70 }, (_, i) => 1956 + i));
    const committed = readFileSync(path.join(ROOT, 'supabase/migrations/073_history_import.sql'), 'utf8').replace(/\r\n/g, '\n');
    expect(buildMigration(loaded)).toBe(committed);
  });
});

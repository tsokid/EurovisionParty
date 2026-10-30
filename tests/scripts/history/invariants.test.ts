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
import { slugify } from '../../../scripts/history/import';
import { recentWinners } from '../../../src/pages/seo/content/winnersCopy';

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

describe('history data: coverage', () => {
  it('has exactly one file per year 1956–2025', () => {
    expect(files).toEqual(Array.from({ length: 70 }, (_, i) => `${1956 + i}.json`));
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

describe('history data: winners 2010–2025 match winnersCopy', () => {
  it.each(recentWinners.en.map((row) => [Number(row[0]), row] as const))('%i', (year, row) => {
    const [, country, , song, points] = row;
    const winners = byYear.get(year)!.entries.filter((e) => e.final_place === 1);
    expect(winners).toHaveLength(1);
    expect(winners[0]).toMatchObject({ iso: toIso(country), song, total_points: Number(points) });
  });

  it('covers every year 2010–2025 except 2020', () => {
    expect(recentWinners.en.map((r) => Number(r[0])).sort()).toEqual(
      Array.from({ length: 16 }, (_, i) => 2010 + i).filter((y) => y !== 2020),
    );
  });
});

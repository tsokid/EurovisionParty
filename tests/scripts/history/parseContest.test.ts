// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContest, type ContestRecord, type EntryRecord } from '../../../scripts/history/parseContest';
import { toIso } from '../../../scripts/history/countryNames';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (year: number) => readFileSync(path.join(here, 'fixtures', `${year}.wikitext`), 'utf8');
const parse = (year: number): ContestRecord => parseContest(year, fixture(year));
const byIso = (c: ContestRecord, iso: string): EntryRecord => {
  const e = c.entries.find((x) => x.iso === iso);
  if (!e) throw new Error(`${c.year}: no entry for ${iso}`);
  return e;
};
const winners = (c: ContestRecord) => c.entries.filter((e) => e.final_place === 1).map((e) => e.iso).sort();

describe('toIso', () => {
  it('maps historical spellings', () => {
    expect(toIso('Macedonia')).toBe('MK');
    expect(toIso('F.Y.R. Macedonia')).toBe('MK');
    expect(toIso('North Macedonia')).toBe('MK');
    expect(toIso('Yugoslavia')).toBe('YU');
    expect(toIso('Serbia and Montenegro')).toBe('CS');
    expect(toIso('Bosnia & Herzegovina')).toBe('BA');
    expect(toIso('Bosnia and Herzegovina')).toBe('BA');
    expect(toIso('Türkiye')).toBe('TR');
    expect(toIso('Turkey')).toBe('TR');
    expect(toIso('Czech Republic')).toBe('CZ');
    expect(toIso('Czechia')).toBe('CZ');
    expect(toIso('West Germany')).toBe('DE');
    expect(toIso('United Kingdom')).toBe('GB');
  });

  it('throws on unknown names', () => {
    expect(() => toIso('Atlantis')).toThrow(/Atlantis/);
  });
});

describe('parseContest 1969', () => {
  const c = parse(1969);

  it('has a four-way tie for first place', () => {
    expect(winners(c)).toEqual(['ES', 'FR', 'GB', 'NL']);
    expect(c.entries).toHaveLength(16);
    expect(byIso(c, 'ES').total_points).toBe(18);
  });

  it('reads host, city and date from the infobox', () => {
    expect(c.host_iso).toBe('ES');
    expect(c.city).toBe('Madrid');
    expect(c.final_date).toBe('1969-03-29');
    expect(c.semi1_date).toBeNull();
    expect(c.cancelled).toBe(false);
  });
});

describe('parseContest 1975', () => {
  const c = parse(1975);

  it('has 19 finalists, no semis, NL winning with 152', () => {
    expect(c.entries).toHaveLength(19);
    expect(winners(c)).toEqual(['NL']);
    const nl = byIso(c, 'NL');
    expect(nl).toMatchObject({
      artist: 'Teach-In',
      song: 'Ding-a-dong',
      total_points: 152,
      final_running_order: 1,
      in_final: true,
      semi: null,
      qualified: null,
      jury_points: null,
      televote_points: null,
    });
    expect(c.entries.every((e) => e.semi === null && e.in_final)).toBe(true);
  });

  it('cleans artist and song markup', () => {
    expect(byIso(c, 'DE')).toMatchObject({ artist: 'Joy Fleming', song: 'Ein Lied kann eine Brücke sein', final_place: 17 });
    expect(byIso(c, 'IE')).toMatchObject({ artist: 'The Swarbriggs', song: "That's What Friends Are For" });
    expect(byIso(c, 'YU').artist).toBe('Pepel in kri');
    expect(c.host_iso).toBe('SE');
    expect(c.city).toBe('Stockholm');
  });
});

describe('parseContest 2005', () => {
  const c = parse(2005);

  it('has one semi of 25 with 10 qualifiers', () => {
    const semi = c.entries.filter((e) => e.semi === 1);
    expect(semi).toHaveLength(25);
    expect(semi.filter((e) => e.qualified === true)).toHaveLength(10);
    expect(semi.filter((e) => e.qualified === false)).toHaveLength(15);
    expect(c.entries.some((e) => e.semi === 2)).toBe(false);
    for (const e of semi) expect(e.in_final).toBe(e.qualified);
    expect(semi.every((e) => e.semi_place !== null && e.semi_points !== null)).toBe(true);
  });

  it('has 14 pre-qualified finalists', () => {
    const pre = c.entries.filter((e) => e.semi === null);
    expect(pre).toHaveLength(14);
    expect(pre.every((e) => e.in_final && e.qualified === null)).toBe(true);
    expect(c.entries.filter((e) => e.in_final)).toHaveLength(24);
  });

  it('has GR winning and the semi-final date', () => {
    expect(winners(c)).toEqual(['GR']);
    expect(byIso(c, 'GR').total_points).toBe(230);
    expect(c.semi1_date).toBe('2005-05-19');
    expect(c.semi2_date).toBeNull();
    expect(c.final_date).toBe('2005-05-21');
    expect(c.host_iso).toBe('UA');
    expect(c.city).toBe('Kyiv');
  });
});

describe('parseContest 2019', () => {
  const c = parse(2019);

  it('has two semis and NL winning with 498', () => {
    expect(c.entries).toHaveLength(41);
    expect(c.entries.filter((e) => e.semi === 1)).toHaveLength(17);
    expect(c.entries.filter((e) => e.semi === 2)).toHaveLength(18);
    expect(c.entries.filter((e) => e.in_final)).toHaveLength(26);
    expect(winners(c)).toEqual(['NL']);
    expect(byIso(c, 'NL')).toMatchObject({
      artist: 'Duncan Laurence',
      song: 'Arcade',
      total_points: 498,
      jury_points: 237,
      televote_points: 261,
      semi: 2,
      qualified: true,
    });
  });

  it('has jury and televote splits that add up for every finalist', () => {
    for (const e of c.entries.filter((x) => x.in_final)) {
      expect(e.jury_points! + e.televote_points!).toBe(e.total_points);
    }
    expect(byIso(c, 'MK').jury_points).toBe(247);
    expect(byIso(c, 'NO').televote_points).toBe(291);
  });

  it('reads semi results', () => {
    expect(byIso(c, 'CZ')).toMatchObject({ semi: 1, semi_place: 2, semi_points: 242, qualified: true });
    expect(byIso(c, 'FI')).toMatchObject({ semi: 1, semi_place: 17, semi_points: 23, qualified: false, in_final: false, final_place: null });
    expect(byIso(c, 'PL').song).toBe('Fire of Love (Pali się)');
    expect(byIso(c, 'SI').artist).toBe('Zala Kralj and Gašper Šantl');
    expect(byIso(c, 'DE').final_place).toBe(25);
    expect(c.host_iso).toBe('IL');
    expect(c.city).toBe('Tel Aviv');
    expect(c.final_date).toBe('2019-05-18');
    expect(c.semi1_date).toBe('2019-05-14');
    expect(c.semi2_date).toBe('2019-05-16');
  });
});

describe('parseContest 2023', () => {
  const c = parse(2023);

  it('has SE winning with 583', () => {
    expect(winners(c)).toEqual(['SE']);
    expect(byIso(c, 'SE')).toMatchObject({ artist: 'Loreen', song: 'Tattoo', total_points: 583, jury_points: 340, televote_points: 243 });
    expect(byIso(c, 'FI').televote_points).toBe(376);
  });

  it('has the UK hosting in Liverpool with 37 entries', () => {
    expect(c.host_iso).toBe('GB');
    expect(c.city).toBe('Liverpool');
    expect(c.entries).toHaveLength(37);
    expect(c.entries.filter((e) => e.in_final)).toHaveLength(26);
    const places = c.entries.filter((e) => e.in_final).map((e) => e.final_place).sort((a, b) => a! - b!);
    expect(places).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
  });
});

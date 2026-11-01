// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { factTokensIn, replaceFacts, parseFact } from '../../supabase/functions/_shared/cms/facts';
import { factNeeds, factValues, joinList, resolveFacts, unresolvedFacts, type FactTables } from '../../src/lib/cms/facts';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import type { ContestIndex, SiteSnapshot } from '../../src/content/contests/types';

const read = (rel: string) => JSON.parse(readFileSync(resolve(__dirname, '../../content', rel), 'utf8'));
const real: FactTables = { contests: read('contests/index.json'), countries: read('countries/index.json'), site: read('site.json') };

const win = (iso: string, name: string, points: number | null = 100) => ({ iso, name_en: name, name_el: `${name}-el`, artist: `${name} artist`, song: `${name} song`, points });
const row = (city: string, host: string, w: ReturnType<typeof win> | null, extra: Partial<ContestIndex[string]> = {}): ContestIndex[string] => ({
  city, city_slug: city.toLowerCase(), host_iso: host, stage: 'archived', indexable: true, cancelled: false, final_date: null, winner: w, co_winners: [], ...extra,
});
const site = (year: number): SiteSnapshot => ({
  current_year: year, live_stage: 'current', generated_at: '1970-01-01T00:00:00Z',
  current: { year, city: 'Vienna', city_slug: 'vienna', dates: { final: `${year}-05-16`, semi1: null, semi2: null }, entry_count: 0, finalist_count: 0, host: { iso: 'AT', name_en: 'Austria', name_el: 'Αυστρία' }, stage: 'current' },
});

describe('fact token grammar', () => {
  it('parses scopes and fields, and names what is wrong', () => {
    expect(parseFact('2014', 'song')).toEqual({ scope: 'year', year: 2014, field: 'song' });
    expect(parseFact('stats', 'topWins')).toEqual({ scope: 'stats', field: 'topWins' });
    expect(parseFact('stats', 'nope')).toMatch(/unknown field "nope"/);
    expect(parseFact('cuurent', 'city')).toMatch(/unknown scope/);
  });

  it('leaves placeholders, escapes and stray braces alone', () => {
    expect(factTokensIn('{year} {{2014.song}} {2014.song} { x }').map((t) => t.token)).toEqual(['{2014.song}']);
    expect(replaceFacts('a {2014.song} {2014.zzz} b', () => 'X')).toBe('a X {2014.zzz} b');
  });

  it('validateDocument rejects an invalid token, and a token does not trip the hardcoded-year warning', () => {
    const doc = read('pages/eurovision-trivia.json');
    doc.en.questions[0].q = 'Who won {2014.winner}?';
    const r = validateDocument('eurovision-trivia', doc);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.message).join()).toMatch(/\{2014\.winner\}: unknown field/);
    const ok = read('pages/eurovision-trivia.json');
    ok.en.questions[0].q = 'Who won in {2026.city}?';
    expect(validateDocument('eurovision-trivia', ok, { year: 2026, cities: ['Vienna'] }).warnings.filter((w) => w.path === 'questions.0.q')).toEqual([]);
  });
});

describe('fact values', () => {
  const contests: ContestIndex = {
    1990: row('Zagreb', 'YU', win('IT', 'Italy')),
    1991: row('Rome', 'IT', win('SE', 'Sweden', 146)),
    1992: row('Malmo', 'SE', win('IE', 'Ireland', 155)),
    1993: row('Millstreet', 'IE', win('IE', 'Ireland', 187)),
    1994: row('Dublin', 'IE', win('IE', 'Ireland', 226)),
    1995: row('Dublin', 'IE', null, { cancelled: true }),
    1996: row('Oslo', 'NO', win('SE', 'Sweden', 500)),
    1997: row('Dublin', 'IE', win('SE', 'Sweden', 200)),
  };
  const t: FactTables = { contests, countries: null, site: site(1998) };
  const v = factValues(t, 'en');
  const f = (s: string) => resolveFacts(s, v);

  it('computes the records from the table, so a new contest updates them', () => {
    expect(f('{stats.topWins} {stats.topCountries} {stats.topWinsYear}')).toBe('3 Ireland and Sweden 1997');
    expect(f('{stats.streakCountry} {stats.streakWins} {stats.streakFrom}-{stats.streakTo}')).toBe('Ireland 3 1992-1994');
    expect(f('{stats.recordPoints} {stats.recordYear} {stats.recordArtist}')).toBe('500 1996 Sweden artist');
    expect(f('{stats.finals} {stats.firstYear} {stats.cancelled}')).toBe('7 1990 1995');
    expect(f('{latest.year} {latest.song} {1993.wins}')).toBe('1997 Sweden song 2');
    expect(f('{current.year} {current.city} {current.host}')).toBe('1998 Vienna Austria');
  });

  it('leaves a token with no value as written and reports it', () => {
    expect(f('{1995.song} {2001.city}')).toBe('{1995.song} {2001.city}');
    expect(unresolvedFacts({ a: ['{1995.song}', '{stats.noWinCountry}'] }, v)).toEqual([
      '{1995.song}: no value in the contest tables',
      '{stats.noWinCountry}: no value in the contest tables',
    ]);
  });

  it('localizes names, cities and lists', () => {
    const el = factValues(real, 'el');
    expect(resolveFacts('{stats.topCountries} · {1956.city} · {1956.date}', el)).toBe('Ιρλανδία και Σουηδία · Λουγκάνο · 24 Μαΐου 1956');
    expect(joinList(['A', 'B', 'C'], 'en')).toBe('A, B and C');
  });

  it('factNeeds loads countries/index.json only for the facts that need it', () => {
    expect(factNeeds({ a: 'no tokens' })).toEqual({ any: false, countries: false });
    expect(factNeeds({ a: ['{stats.topWins}'] })).toEqual({ any: true, countries: false });
    expect(factNeeds({ a: '{stats.noWinCountry}' })).toEqual({ any: true, countries: true });
  });

  it('every published page doc resolves all its tokens in both locales', () => {
    for (const file of readdirSync(resolve(__dirname, '../../content/pages')).filter((x) => x !== 'index.json')) {
      const doc = read(`pages/${file}`);
      for (const l of ['en', 'el'] as const) expect(unresolvedFacts(doc[l], factValues(real, l)), `${file} ${l}`).toEqual([]);
    }
  });
});

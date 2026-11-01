/**
 * Values of the contest fact tokens ({2014.song}, {stats.topCountries}...,
 * grammar in supabase/functions/_shared/cms/facts.ts) from the contest
 * tables: contests/index.json, site.json and, only for the facts that need
 * it, countries/index.json. Pure; the page doc hook (usePageContent) loads
 * the tables and resolves the doc with resolveFacts().
 */
import type { ContestIndex, CountryIndex, IndexWinner, SiteSnapshot } from '../../content/contests/types';
import { factTokensIn, replaceFacts, type Fact } from '../../../supabase/functions/_shared/cms/facts';
import { cityName, formatDate } from '../../pages/contest/content/hubCopy';
import type { Locale } from '../seo/locale';

export type FactTables = { contests: ContestIndex; countries: CountryIndex | null; site: SiteSnapshot };

/** What resolving a value needs: any fact tokens at all, and whether one needs countries/index.json. */
export type FactNeeds = { any: boolean; countries: boolean };

const needsCountries = (f: Fact) => (f.scope === 'stats' ? f.field.startsWith('noWin') : f.field === 'host' && f.scope !== 'current');

function* strings(v: unknown): Generator<string> {
  if (typeof v === 'string') yield v;
  else if (Array.isArray(v)) for (const x of v) yield* strings(x);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* strings(x);
}

const needsCache = new WeakMap<object, FactNeeds>();

/** The fact tokens `value` uses (memoized per object). */
export function factNeeds(value: unknown): FactNeeds {
  if (!value || typeof value !== 'object') return { any: false, countries: false };
  let needs = needsCache.get(value);
  if (!needs) {
    needs = { any: false, countries: false };
    for (const s of strings(value)) {
      for (const { fact } of factTokensIn(s)) {
        if (typeof fact === 'string') continue;
        needs.any = true;
        if (needsCountries(fact)) needs.countries = true;
      }
    }
    needsCache.set(value, needs);
  }
  return needs;
}

const LIST_AND: Record<Locale, string> = { en: ' and ', el: ' και ' };

/** "A", "A and B", "A, B and C" ("και" in Greek). */
export function joinList(items: string[], locale: Locale): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')}${LIST_AND[locale]}${items[items.length - 1]}`;
}

type Win = { year: number; winners: IndexWinner[] };

/** Every fact value for one set of tables and locale; undefined where the tables have no value. */
export function factValues(t: FactTables, locale: Locale): (fact: Fact) => string | undefined {
  const name = (w: { name_en: string; name_el: string }) => (locale === 'el' ? w.name_el : w.name_en);
  const years = Object.keys(t.contests).map(Number).sort((a, b) => a - b);
  const wins: Win[] = years.flatMap((year) => {
    const c = t.contests[year];
    return c.winner ? [{ year, winners: [c.winner, ...c.co_winners] }] : [];
  });

  // Country names by ISO: winners, then the countries table, then the live host.
  const names = new Map<string, { name_en: string; name_el: string }>();
  for (const w of wins) for (const x of w.winners) names.set(x.iso, x);
  for (const c of Object.values(t.countries ?? {})) names.set(c.iso, c);
  if (t.site.current.host) names.set(t.site.current.host.iso, t.site.current.host);

  const winsThrough = (iso: string, year: number) => wins.filter((w) => w.year <= year && w.winners.some((x) => x.iso === iso)).length;

  function yearValue(year: number, field: Fact['field']): string | undefined {
    const c = t.contests[year];
    if (!c) return undefined;
    const w = c.winner;
    switch (field) {
      case 'year': return String(year);
      case 'date': return c.final_date ? formatDate(c.final_date, locale) : undefined;
      case 'city': return cityName(locale, c.city_slug, c.city).name;
      case 'host': { const h = c.host_iso ? names.get(c.host_iso) : undefined; return h && name(h); }
      case 'country': return w ? joinList([w, ...c.co_winners].map(name), locale) : undefined;
      case 'artist': return w?.artist ?? undefined;
      case 'song': return w?.song ?? undefined;
      case 'points': return w?.points != null ? String(w.points) : undefined;
      case 'wins': return w ? String(winsThrough(w.iso, year)) : undefined;
      default: return undefined;
    }
  }

  let stats: Record<string, string | undefined> | null = null;
  function statsValue(field: string): string | undefined {
    stats ??= computeStats();
    return stats[field];
  }

  function computeStats(): Record<string, string | undefined> {
    const s: Record<string, string | undefined> = {};
    s.firstYear = years.length ? String(years[0]) : undefined;
    s.finals = String(wins.length);
    s.cancelled = joinList(years.filter((y) => t.contests[y].cancelled).map(String), locale);

    const tally = new Map<string, number[]>();
    for (const w of wins) for (const x of w.winners) tally.set(x.iso, [...(tally.get(x.iso) ?? []), w.year]);
    const top = Math.max(0, ...[...tally.values()].map((v) => v.length));
    const leaders = [...tally.entries()].filter(([, v]) => v.length === top);
    if (top > 0) {
      // In the order they reached the record, so the latest to get there is last.
      leaders.sort((a, b) => a[1][top - 1] - b[1][top - 1]);
      s.topCountries = joinList(leaders.map(([iso]) => name(names.get(iso)!)), locale);
      s.topWins = String(top);
      s.topWinsYear = String(leaders[leaders.length - 1][1][top - 1]);
    }

    // Longest run of consecutive contests (cancelled years skipped) won by one country; the earliest on a tie.
    type Run = { iso: string; from: number; to: number; n: number };
    let best = null as Run | null;
    let run = null as Run | null;
    for (const w of wins) {
      const iso = w.winners.length === 1 ? w.winners[0].iso : null;
      run = iso && run?.iso === iso ? { ...run, to: w.year, n: run.n + 1 } : iso ? { iso, from: w.year, to: w.year, n: 1 } : null;
      if (run && (!best || run.n > best.n)) best = run;
    }
    if (best) {
      s.streakCountry = name(names.get(best.iso)!);
      s.streakWins = String(best.n);
      s.streakFrom = String(best.from);
      s.streakTo = String(best.to);
    }

    let record: { year: number; w: IndexWinner } | null = null;
    for (const w of wins) {
      const p = w.winners[0].points;
      if (p != null && (!record || p > record.w.points!)) record = { year: w.year, w: w.winners[0] };
    }
    if (record) {
      s.recordPoints = String(record.w.points);
      s.recordYear = String(record.year);
      s.recordCountry = name(record.w);
      s.recordArtist = record.w.artist ?? undefined;
      s.recordSong = record.w.song ?? undefined;
    }

    if (t.countries) {
      const winless = Object.values(t.countries).filter((c) => c.wins === 0);
      const most = Math.max(0, ...winless.map((c) => c.participations));
      if (most > 0) {
        s.noWinCountry = joinList(winless.filter((c) => c.participations === most).map(name).sort(), locale);
        s.noWinEntries = String(most);
      }
    }
    return s;
  }

  const latest = wins.length ? wins[wins.length - 1].year : null;
  return (fact) => {
    if (fact.scope === 'stats') return statsValue(fact.field);
    if (fact.scope === 'year') return yearValue(fact.year, fact.field);
    if (fact.scope === 'latest') return latest === null ? undefined : yearValue(latest, fact.field);
    // current: the live contest from site.json (its row may not have a winner yet).
    const cur = t.site.current;
    if (fact.field === 'year') return String(cur.year);
    if (fact.field === 'city') return cityName(locale, cur.city_slug, cur.city).name;
    if (fact.field === 'host') return cur.host ? name(cur.host) : undefined;
    if (fact.field === 'date') return cur.dates.final ? formatDate(cur.dates.final, locale) : undefined;
    return yearValue(cur.year, fact.field);
  };
}

/** `value` with every fact token in its strings resolved; an unresolvable token stays as written. */
export function resolveFacts<T>(value: T, facts: (fact: Fact) => string | undefined): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return replaceFacts(v, facts);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/** Fact tokens in `value` that are invalid or have no value in the tables, as "token: reason". */
export function unresolvedFacts(value: unknown, facts: (fact: Fact) => string | undefined): string[] {
  const out: string[] = [];
  for (const s of strings(value)) {
    for (const { token, fact } of factTokensIn(s)) {
      if (typeof fact === 'string') out.push(`${token}: ${fact}`);
      else if (facts(fact) === undefined) out.push(`${token}: no value in the contest tables`);
    }
  }
  return out;
}

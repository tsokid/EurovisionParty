// Contest fact tokens for CMS copy: any string field may name a value from
// the contest tables instead of writing it by hand, so winners, songs, cities
// and records stay right when the tables change (a new contest, a correction).
//
// Syntax: {scope.field}
//   scope  a 4-digit year (e.g. 2014), `current` (site.json's live contest),
//          `latest` (the latest contest with a winner) or `stats`
//   year/current/latest fields:
//     year, date (grand final), city, host (host country), country (winner),
//     artist, song, points, wins (the winner country's win count up to and
//     including that year)
//   stats fields: see STATS_FIELDS
// `{{` / `}}` stay literal braces, as for placeholders. Resolution happens at
// render time (src/lib/cms/facts.ts); content/ keeps the tokens.
// Deno-free and dependency-free.

export const YEAR_FIELDS = ['year', 'date', 'city', 'host', 'country', 'artist', 'song', 'points', 'wins'] as const;

export const STATS_FIELDS = [
  'firstYear', // first contest year
  'finals', // grand finals held (cancelled years excluded)
  'cancelled', // cancelled years, as a list
  'topCountries', // the countries with the most wins, as a list
  'topWins', // their win count
  'topWinsYear', // the year the last of them reached that count
  'streakCountry', // longest run of consecutive wins: country
  'streakWins', // … its length
  'streakFrom', // … first year
  'streakTo', // … last year
  'recordPoints', // highest winning score
  'recordYear',
  'recordCountry',
  'recordArtist',
  'recordSong',
  'noWinCountry', // most participations without a win: country (list on a tie)
  'noWinEntries', // … its participations
] as const;

export type YearField = (typeof YEAR_FIELDS)[number];
export type StatsField = (typeof STATS_FIELDS)[number];

export type Fact =
  | { scope: 'year'; year: number; field: YearField }
  | { scope: 'current' | 'latest'; field: YearField }
  | { scope: 'stats'; field: StatsField };

/** A fact-shaped token: `{scope.field}`, not part of a `{{` / `}}` escape. */
const TOKEN = /(?<!\{)\{([a-z0-9]+)\.([a-zA-Z]+)\}(?!\})/g;

const isYearField = (f: string): f is YearField => (YEAR_FIELDS as readonly string[]).includes(f);
const isStatsField = (f: string): f is StatsField => (STATS_FIELDS as readonly string[]).includes(f);

/** The fact a token's parts name, or an error message. */
export function parseFact(scope: string, field: string): Fact | string {
  if (/^\d{4}$/.test(scope)) return isYearField(field) ? { scope: 'year', year: Number(scope), field } : `unknown field "${field}" (year fields: ${YEAR_FIELDS.join(', ')})`;
  if (scope === 'current' || scope === 'latest') return isYearField(field) ? { scope, field } : `unknown field "${field}" (${scope} fields: ${YEAR_FIELDS.join(', ')})`;
  if (scope === 'stats') return isStatsField(field) ? { scope, field } : `unknown field "${field}" (stats fields: ${STATS_FIELDS.join(', ')})`;
  return `unknown scope "${scope}" (a year, current, latest or stats)`;
}

export type FactToken = { token: string; fact: Fact | string };

/** Fact tokens in `s`, in order (repeats included); `fact` is an error message when the token is invalid. */
export function factTokensIn(s: string): FactToken[] {
  if (!s.includes('{')) return [];
  return [...s.matchAll(TOKEN)].map((m) => ({ token: m[0], fact: parseFact(m[1], m[2]) }));
}

/** `s` with each valid fact token replaced by `value(fact)`; a token it returns undefined for stays as written. */
export function replaceFacts(s: string, value: (fact: Fact) => string | undefined): string {
  if (!s.includes('{')) return s;
  return s.replace(TOKEN, (token, scope: string, field: string) => {
    const fact = parseFact(scope, field);
    return typeof fact === 'string' ? token : value(fact) ?? token;
  });
}

// Builds the public content snapshot (spec §4.1) from contest table rows.
//
// Pure and Deno-free: imported by the publish-content edge function (Deno)
// and by vitest and scripts/snapshot/build-local.ts (Node). No URL imports,
// no Deno or Node APIs; the only import is type-only.
//
// Output: { 'content/site.json', 'content/contests/{year}.json',
// 'content/countries/{iso}.json', 'content/contests/index.json',
// 'content/countries/index.json' } → file text. The index files are small
// summaries (keyed by year / by slug) so list pages and slug lookups never
// need the whole snapshot on the client. JSON is deterministic: keys
// sorted at every level, 2-space indent, trailing newline; contests by year,
// entries by ISO, participations by year. Input row order does not matter.
import type {
  ContestIndex,
  ContestRow,
  CountryIndex,
  ContestSnapshot,
  CountryParticipation,
  CountryRow,
  CountrySnapshot,
  EntryRow,
  EntrySnapshot,
  IndexWinner,
  SiteSnapshot,
} from '../../../src/content/contests/types.ts';

export type SnapshotInput = {
  contests: ContestRow[];
  countries: CountryRow[];
  entries: EntryRow[];
  /** ISO timestamp written to site.json; passed in so output is reproducible. */
  generated_at: string;
};

/** JSON with object keys sorted at every level, 2-space indent, trailing newline. */
export function stableJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sort(o[k])]));
    }
    return v;
  };
  return JSON.stringify(sort(value), null, 2) + '\n';
}

/** A country page is indexable from this many non-cancelled participations (mirrors src/lib/seo/dynamicPages.ts, which Deno cannot import). */
export const COUNTRY_INDEXABLE_MIN = 3;

const byIso = (a: { iso: string }, b: { iso: string }) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0);

/** The site's current year: the live contest (current or finalized), else the latest non-archived, else the latest. */
function siteSnapshot(contests: ContestRow[], generated_at: string): SiteSnapshot {
  if (contests.length === 0) throw new Error('buildSnapshotFiles: no contests');
  const live = contests.filter((c) => c.stage === 'current' || c.stage === 'finalized');
  if (live.length > 1) {
    throw new Error(`buildSnapshotFiles: ${live.length} live contests (${live.map((c) => c.year).join(', ')}); expected at most one`);
  }
  const latest = (xs: ContestRow[]) => xs.reduce((a, b) => (b.year > a.year ? b : a));
  const notArchived = contests.filter((c) => c.stage !== 'archived');
  const pick = live[0] ?? (notArchived.length ? latest(notArchived) : latest(contests));
  return { current_year: pick.year, live_stage: pick.stage, generated_at };
}

export function buildSnapshotFiles(input: SnapshotInput): Record<string, string> {
  const countries = new Map<string, CountryRow>();
  for (const c of input.countries) {
    if (countries.has(c.iso)) throw new Error(`buildSnapshotFiles: duplicate country ${c.iso}`);
    countries.set(c.iso, c);
  }
  const contests = new Map<number, ContestRow>();
  for (const c of input.contests) {
    if (contests.has(c.year)) throw new Error(`buildSnapshotFiles: duplicate contest ${c.year}`);
    contests.set(c.year, c);
  }

  const entriesByYear = new Map<number, EntryRow[]>();
  const entriesByIso = new Map<string, EntryRow[]>();
  const seen = new Set<string>();
  for (const e of input.entries) {
    if (!contests.has(e.year)) throw new Error(`buildSnapshotFiles: entry ${e.year}/${e.iso} has no contest ${e.year}`);
    if (!countries.has(e.iso)) throw new Error(`buildSnapshotFiles: entry ${e.year}/${e.iso} has unknown country ${e.iso}`);
    const key = `${e.year}/${e.iso}`;
    if (seen.has(key)) throw new Error(`buildSnapshotFiles: duplicate entry ${key}`);
    seen.add(key);
    entriesByYear.set(e.year, [...(entriesByYear.get(e.year) ?? []), e]);
    entriesByIso.set(e.iso, [...(entriesByIso.get(e.iso) ?? []), e]);
  }

  const files: Record<string, string> = {};
  const contestIndex: ContestIndex = {};
  const countryIndex: CountryIndex = {};

  for (const c of [...contests.values()].sort((a, b) => a.year - b.year)) {
    const entries: EntrySnapshot[] = [...(entriesByYear.get(c.year) ?? [])].sort(byIso).map((e) => {
      const co = countries.get(e.iso)!;
      return { ...e, name_en: co.name_en, name_el: co.name_el, country_slug: co.slug };
    });
    const snapshot: ContestSnapshot = {
      year: c.year,
      city: c.city,
      city_slug: c.city_slug,
      host_iso: c.host_iso,
      dates: { semi1: c.semi1_date, semi2: c.semi2_date, final: c.final_date },
      stage: c.stage,
      indexable: c.indexable,
      cancelled: c.cancelled,
      entries,
    };
    files[`content/contests/${c.year}.json`] = stableJson(snapshot);

    const first: IndexWinner[] = c.cancelled
      ? []
      : entries.filter((e) => e.final_place === 1).map((e) => ({
          iso: e.iso,
          name_en: e.name_en,
          name_el: e.name_el,
          artist: e.artist,
          song: e.song,
          points: e.total_points,
        }));
    contestIndex[String(c.year)] = {
      city: c.city,
      city_slug: c.city_slug,
      host_iso: c.host_iso,
      stage: c.stage,
      indexable: c.indexable,
      cancelled: c.cancelled,
      final_date: c.final_date,
      winner: first[0] ?? null,
      co_winners: first.slice(1),
    };
  }
  files['content/contests/index.json'] = stableJson(contestIndex);

  for (const co of [...countries.values()].sort(byIso)) {
    const participations: CountryParticipation[] = [...(entriesByIso.get(co.iso) ?? [])]
      .sort((a, b) => a.year - b.year)
      .map((e) => ({
        year: e.year,
        city_slug: contests.get(e.year)!.city_slug,
        cancelled: contests.get(e.year)!.cancelled,
        final_place: e.final_place,
        semi: e.semi,
        semi_place: e.semi_place,
        semi_points: e.semi_points,
        qualified: e.qualified,
        artist: e.artist,
        song: e.song,
        points: e.total_points,
      }));
    const snapshot: CountrySnapshot = {
      iso: co.iso,
      slug: co.slug,
      name_en: co.name_en,
      name_el: co.name_el,
      related_iso: co.related_iso,
      participations,
    };
    files[`content/countries/${co.iso}.json`] = stableJson(snapshot);

    if (participations.length > 0) {
      const counted = participations.filter((p) => !p.cancelled);
      const places = counted.map((p) => p.final_place).filter((n): n is number => n !== null);
      countryIndex[co.slug] = {
        iso: co.iso,
        name_en: co.name_en,
        name_el: co.name_el,
        participations: counted.length,
        wins: places.filter((n) => n === 1).length,
        best_place: places.length ? Math.min(...places) : null,
        indexable: counted.length >= COUNTRY_INDEXABLE_MIN,
      };
    }
  }
  files['content/countries/index.json'] = stableJson(countryIndex);

  files['content/site.json'] = stableJson(siteSnapshot(input.contests, input.generated_at));
  return files;
}

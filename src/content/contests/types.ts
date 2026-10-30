// Contest data shapes (spec §4.1, §5).
//
// *Row types mirror the Supabase tables (migration 070) as the publish-content
// edge function reads them. *Snapshot types are the committed JSON under
// content/, which the public site reads at build time. This file is
// type-only and Deno-free: supabase/functions/publish-content/snapshot.ts
// imports it relatively.

export type ContestStage = 'upcoming' | 'current' | 'finalized' | 'archived';

/** public.contests, minus the bookkeeping timestamps. */
export type ContestRow = {
  year: number;
  host_iso: string | null;
  city: string;
  city_slug: string;
  semi1_date: string | null;
  semi2_date: string | null;
  final_date: string | null;
  stage: ContestStage;
  indexable: boolean;
  cancelled: boolean;
};

/** public.countries. */
export type CountryRow = {
  iso: string;
  name_en: string;
  name_el: string;
  slug: string;
  related_iso: string[];
};

/** public.contest_entries, minus updated_at. */
export type EntryRow = {
  year: number;
  iso: string;
  artist: string | null;
  song: string | null;
  language: string | null;
  semi: 1 | 2 | null;
  semi_running_order: number | null;
  semi_place: number | null;
  semi_points: number | null;
  qualified: boolean | null;
  in_final: boolean;
  final_running_order: number | null;
  final_place: number | null;
  total_points: number | null;
  jury_points: number | null;
  televote_points: number | null;
  source: string | null;
};

/** One entry of a contest, with its country's names. */
export type EntrySnapshot = EntryRow & {
  name_en: string;
  name_el: string;
  country_slug: string;
};

/** content/contests/{year}.json. Entries are sorted by ISO. */
export type ContestSnapshot = {
  year: number;
  city: string;
  city_slug: string;
  host_iso: string | null;
  dates: { semi1: string | null; semi2: string | null; final: string | null };
  stage: ContestStage;
  indexable: boolean;
  cancelled: boolean;
  entries: EntrySnapshot[];
};

/**
 * One year a country took part in. `points` is the grand-final total,
 * `semi_points` the semi-final total (non-qualifiers have only that).
 * `cancelled` is the contest's flag (2020: selected, never performed).
 */
export type CountryParticipation = {
  year: number;
  city_slug: string;
  cancelled: boolean;
  final_place: number | null;
  semi: 1 | 2 | null;
  semi_place: number | null;
  semi_points: number | null;
  qualified: boolean | null;
  artist: string | null;
  song: string | null;
  points: number | null;
};

/** content/countries/{iso}.json. Participations are sorted by year. */
export type CountrySnapshot = {
  iso: string;
  slug: string;
  name_en: string;
  name_el: string;
  related_iso: string[];
  participations: CountryParticipation[];
};

/** content/site.json. */
export type SiteSnapshot = {
  /** The contest in stage current or finalized (else the latest non-archived, else the latest). */
  current_year: number;
  /** That contest's stage. */
  live_stage: ContestStage;
  generated_at: string;
};

/** A contest winner as listed in content/contests/index.json. */
export type IndexWinner = {
  iso: string;
  name_en: string;
  name_el: string;
  artist: string | null;
  song: string | null;
  /** Grand-final total; null where the result was never published (1956). */
  points: number | null;
};

/** One row of content/contests/index.json. */
export type ContestIndexEntry = {
  city: string;
  city_slug: string;
  host_iso: string | null;
  stage: ContestStage;
  indexable: boolean;
  cancelled: boolean;
  final_date: string | null;
  /** First place (lowest ISO on a shared first place); null when cancelled or not decided. */
  winner: IndexWinner | null;
  /** The other countries sharing first place (1969), by ISO; usually empty. */
  co_winners: IndexWinner[];
};

/** content/contests/index.json, keyed by year. */
export type ContestIndex = Record<string, ContestIndexEntry>;

/**
 * One row of content/countries/index.json. Counts skip cancelled contests (2020);
 * wins and best_place count completed contests (stage finalized or archived), like /winners.
 */
export type CountryIndexEntry = {
  iso: string;
  name_en: string;
  name_el: string;
  participations: number;
  wins: number;
  best_place: number | null;
  /** Same rule as dynamicPages.isCountryIndexable. */
  indexable: boolean;
};

/** content/countries/index.json, keyed by slug; only countries with a page (≥ 1 participation). */
export type CountryIndex = Record<string, CountryIndexEntry>;

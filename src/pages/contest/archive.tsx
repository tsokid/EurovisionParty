/**
 * Shared helpers for the archive and country pages: index lookups, links to a
 * year's page and to a country's page.
 */
import type { ReactNode } from 'react';
import type { ContestIndex, ContestIndexEntry, CountryIndex, EntrySnapshot } from '../../content/contests/types';
import type { Locale } from '../../lib/seo/locale';
import { archivePath, countryPath, hubPath } from '../../lib/seo/dynamicPages';
import LocaleLink from '../../components/seo/LocaleLink';
import { countryName } from './content/hubCopy';

export const CONTEST_INDEX = 'contests/index.json';
export const COUNTRY_INDEX = 'countries/index.json';

const ARCHIVE_SLUG = /^eurovision-(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** `eurovision-2019-tel-aviv` → { year: 2019, citySlug: 'tel-aviv' }; anything else → null. */
export function parseArchiveSlug(slug: string | undefined): { year: number; citySlug: string } | null {
  const m = slug ? ARCHIVE_SLUG.exec(slug) : null;
  return m ? { year: Number(m[1]), citySlug: m[2] } : null;
}

export interface IndexedContest extends ContestIndexEntry {
  year: number;
}

/** Index rows with their year, oldest first. */
export function indexedContests(index: ContestIndex): IndexedContest[] {
  return Object.entries(index)
    .map(([year, c]) => ({ ...c, year: Number(year) }))
    .sort((a, b) => a.year - b.year);
}

/** A contest is completed once its result is final: stage finalized or archived. */
export const isCompleted = (c: Pick<ContestIndexEntry, 'stage'>): boolean =>
  c.stage === 'finalized' || c.stage === 'archived';

/** Completed years (results known), oldest first: /winners and the country win counts. */
export const completedContests = (index: ContestIndex): IndexedContest[] =>
  indexedContests(index).filter(isCompleted);

/** Archived years only (the ones with an archive page), oldest first. */
export const archivedContests = (index: ContestIndex): IndexedContest[] =>
  indexedContests(index).filter((c) => c.stage === 'archived');

/**
 * Unprefixed page for a year: its archive page once archived, the hub while it
 * is the live contest, nothing for an upcoming one.
 */
export function yearPath(year: number, c: ContestIndexEntry | undefined): string | null {
  if (!c) return null;
  if (c.stage === 'archived') return archivePath(year, c.city_slug);
  if (c.stage === 'current' || c.stage === 'finalized') return hubPath(year);
  return null;
}

/** The ISO → slug map of countries that have a page. */
export function countrySlugsByIso(index: CountryIndex): Map<string, string> {
  return new Map(Object.entries(index).map(([slug, c]) => [c.iso, slug]));
}

const LINK = 'text-white font-semibold hover:text-euro-pink-light hover:underline';

/** Country name linking to its country page. */
export const countryLinkCell = (e: EntrySnapshot, locale: Locale): ReactNode => (
  <LocaleLink to={countryPath(e.country_slug)} className={LINK}>{countryName(e, locale)}</LocaleLink>
);

/** Year linking to its page when there is one. */
export function yearCell(year: number, path: string | null): ReactNode {
  const label = <span className="font-mono tabular-nums">{year}</span>;
  return path ? <LocaleLink to={path} className={LINK}>{label}</LocaleLink> : label;
}

export const linkClass = LINK;

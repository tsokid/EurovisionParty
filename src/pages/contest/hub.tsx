/** Shared data types and render helpers for the live-contest hub pages. */
import type { ReactNode } from 'react';
import type { ContestSnapshot, EntrySnapshot } from '../../content/contests/types';
import type { Locale } from '../../lib/seo/locale';
import type { Crumb } from '../../components/seo/Breadcrumbs';
import type { RelatedCard } from '../../components/seo/RelatedCards';
import { compareText } from '../../lib/seo/textSort';
import { SITE_ORIGIN } from '../../lib/seo/registry';
import { countryName, type HubCopy, type HubFacts } from './content/hubCopy';

export type HubSubpage = 'schedule' | 'semis' | 'songs';

export interface Hub {
  contest: ContestSnapshot;
  locale: Locale;
  facts: HubFacts;
  copy: HubCopy;
  /** Unprefixed hub path, e.g. `/eurovision-2026`. */
  base: string;
}

export function hubCrumbs(hub: Hub, sub?: HubSubpage): Crumb[] {
  const { copy, base, contest } = hub;
  const crumbs: Crumb[] = [
    { label: copy.crumbs.home, href: '/' },
    { label: copy.crumbs.hub(contest.year), href: base },
  ];
  if (sub === 'schedule') crumbs.push({ label: copy.crumbs.schedule, href: `${base}/schedule` });
  if (sub === 'semis') crumbs.push({ label: copy.crumbs.semis, href: `${base}/semifinals` });
  if (sub === 'songs') crumbs.push({ label: copy.crumbs.songs, href: `${base}/songs` });
  return crumbs;
}

/** Links to the other hub pages, plus winners. */
export function hubRelated(hub: Hub, current?: HubSubpage): RelatedCard[] {
  const { copy, base, contest } = hub;
  const r = copy.related;
  const all: (RelatedCard & { key?: HubSubpage | 'hub' })[] = [
    { key: 'hub', href: base, title: r.hub.title(contest.year), blurb: r.hub.blurb },
    { key: 'schedule', href: `${base}/schedule`, title: r.schedule.title, blurb: r.schedule.blurb },
    { key: 'semis', href: `${base}/semifinals`, title: r.semis.title, blurb: r.semis.blurb },
    { key: 'songs', href: `${base}/songs`, title: r.songs.title, blurb: r.songs.blurb },
    { href: '/winners', title: r.winners.title, blurb: r.winners.blurb },
  ];
  return all
    .filter((c) => c.key !== (current ?? 'hub'))
    .map(({ href, title, blurb }) => ({ href, title, blurb }));
}

/**
 * schema.org Event for a contest (hub and archive pages): the grand final
 * night, in the host city, organised by the EBU. Null without a final date.
 * No performer: the line-up is long and the winner alone would mislead.
 */
export function contestEventJsonLd(contest: ContestSnapshot, city: string, description: string, url: string) {
  const final = contest.dates.final;
  if (!final) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `Eurovision Song Contest ${contest.year}`,
    description,
    startDate: final,
    endDate: final,
    eventStatus: contest.cancelled ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: `${SITE_ORIGIN}/logo.png`,
    organizer: { '@type': 'Organization', name: 'European Broadcasting Union', url: 'https://www.ebu.ch' },
    location: {
      '@type': 'Place',
      name: city,
      address: {
        '@type': 'PostalAddress',
        addressLocality: city,
        ...(contest.host_iso ? { addressCountry: contest.host_iso } : {}),
      },
    },
    url,
  };
}

/** Entries sorted by country name in the page locale (deterministic, see textSort). */
export function byCountry(entries: EntrySnapshot[], locale: Locale): EntrySnapshot[] {
  return [...entries].sort((a, b) => compareText(countryName(a, locale), countryName(b, locale)));
}

/** schema.org ItemList of MusicRecording; entries without a song title are skipped. */
export function songsItemList(entries: EntrySnapshot[], name: string) {
  const songs = entries.filter((e): e is EntrySnapshot & { song: string } => e.song != null);
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: songs.length,
    itemListElement: songs.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'MusicRecording',
        name: e.song,
        ...(e.artist ? { byArtist: { '@type': 'MusicGroup', name: e.artist } } : {}),
        ...(e.language ? { inLanguage: e.language } : {}),
      },
    })),
  };
}

export const countryCell = (e: EntrySnapshot, locale: Locale): ReactNode => (
  <strong className="text-white">{countryName(e, locale)}</strong>
);

export const songCell = (song: string | null): ReactNode =>
  song ? <em className="text-white/75">{song}</em> : null;

/** Points/place cell; null (column may hide) when unknown. */
export const numCell = (n: number | null, strong = false): ReactNode =>
  n == null ? null : strong
    ? <strong className="text-euro-pink-light tabular-nums">{n}</strong>
    : <span className="tabular-nums">{n}</span>;

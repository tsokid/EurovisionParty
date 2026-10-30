/**
 * Copy for the archive: /past-contests (every archived year) and
 * /past-contests/eurovision-{year}-{city} (one year), EN + EL.
 *
 * Facts (cities, names, songs, places, points) come from the snapshot via
 * archiveFacts(); every sentence around them is our own template (spec §9).
 * Titles and descriptions carry the year, so they are unique per page.
 */
import type { ContestSnapshot, EntrySnapshot } from '../../../content/contests/types';
import type { Locale } from '../../../lib/seo/locale';
import { cityName, countryName, greekCountrySubject } from './hubCopy';

// ─── Facts ──────────────────────────────────────────────────────────────────

export interface ArchiveWinner {
  iso: string;
  country: string;
  artist: string | null;
  song: string | null;
  points: number | null;
}

export interface ArchiveFacts {
  year: number;
  city: string;
  /** "in Tel Aviv" / "στο Τελ Αβίβ". */
  cityIn: string;
  host: string | null;
  cancelled: boolean;
  entries: number;
  /** Semi-finals held (0 before 2004 and in 2020). */
  semis: number;
  /** Everyone in first place: one country, or several on a shared first place (1969). */
  winners: ArchiveWinner[];
}

const winnerOf = (e: EntrySnapshot, locale: Locale): ArchiveWinner => ({
  iso: e.iso,
  country: countryName(e, locale),
  artist: e.artist,
  song: e.song,
  points: e.total_points,
});

export function archiveFacts(contest: ContestSnapshot, locale: Locale): ArchiveFacts {
  const { entries } = contest;
  const city = cityName(locale, contest.city_slug, contest.city);
  const hostEntry = entries.find((e) => e.iso === contest.host_iso);
  const semis = new Set(entries.map((e) => e.semi).filter((n) => n != null)).size;
  return {
    year: contest.year,
    city: city.name,
    cityIn: city.in,
    host: hostEntry ? countryName(hostEntry, locale) : null,
    cancelled: contest.cancelled,
    entries: entries.length,
    semis: contest.cancelled ? 0 : semis,
    winners: contest.cancelled ? [] : entries.filter((e) => e.final_place === 1).map((e) => winnerOf(e, locale)),
  };
}

// ─── Sentence helpers ───────────────────────────────────────────────────────

/** "A, B and C" / "Α, Β και Γ". */
export function joinList(items: string[], locale: Locale): string {
  const and = locale === 'el' ? 'και' : 'and';
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

/** 1 → "1st", 12 → "12th", 23 → "23rd"; Greek "1η". */
export function ordinal(n: number, locale: Locale): string {
  if (locale === 'el') return `${n}η`;
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** “Song” by Artist / «Song» (Artist); empty when neither is known. */
function songBy(w: ArchiveWinner, locale: Locale): string {
  if (locale === 'el') {
    if (w.song) return ` με το «${w.song}»${w.artist ? ` (${w.artist})` : ''}`;
    return w.artist ? ` με ${w.artist}` : '';
  }
  if (w.song) return ` with “${w.song}”${w.artist ? ` by ${w.artist}` : ''}`;
  return w.artist ? ` with ${w.artist}` : '';
}

const sharedPoints = (ws: ArchiveWinner[]): number | null => {
  const p = ws[0]?.points ?? null;
  return p !== null && ws.every((w) => w.points === p) ? p : null;
};

// ─── Copy ───────────────────────────────────────────────────────────────────

export interface ArchiveIndexFacts {
  first: number;
  last: number;
  count: number;
}

export interface ArchiveCopy {
  crumbs: { home: string; archive: string; year: (y: number) => string };
  chip: { archive: string; cancelled: string };
  year: {
    title: (f: ArchiveFacts) => string;
    description: (f: ArchiveFacts) => string;
    h1: (f: ArchiveFacts) => string;
    lede: (f: ArchiveFacts) => string;
    /** Winner callout headline. */
    callout: (f: ArchiveFacts) => string;
    winnerTitle: (n: number) => string;
    finalTitle: string;
    semiIntro: string;
    /** Semi-final heading; `single` when the year had only one (2004–2007). */
    semiTitle: (n: 1 | 2, single: boolean, date: string | null) => string;
    cancelledTitle: string;
    cancelledNote: (f: ArchiveFacts) => string;
    entriesTitle: (n: number) => string;
    navTitle: string;
    prev: (y: number) => string;
    next: (y: number) => string;
    allYears: string;
    listName: (y: number) => string;
    /** ItemList name for a cancelled year (entries, no ranking). */
    entriesListName: (y: number) => string;
  };
  index: {
    title: (f: ArchiveIndexFacts) => string;
    description: (f: ArchiveIndexFacts) => string;
    h1: string;
    lede: (f: ArchiveIndexFacts) => string;
    tableTitle: string;
    listName: string;
    /** Link to the live contest's hub, above the table. */
    liveLink: (year: number) => string;
    headers: { year: string; city: string; winner: string; song: string; points: string };
    cancelled: string;
    shared: string;
  };
}

const en: ArchiveCopy = {
  crumbs: { home: 'Home', archive: 'Past contests', year: (y) => `Eurovision ${y}` },
  chip: { archive: 'Archive', cancelled: 'Cancelled' },
  year: {
    title: (f) =>
      f.cancelled
        ? `Eurovision ${f.year} ${f.cityIn}: the cancelled contest and its ${f.entries} entries`
        : f.semis > 1
          ? `Eurovision ${f.year} ${f.cityIn}: final results, semi-finals & winner`
          : f.semis === 1
          ? `Eurovision ${f.year} ${f.cityIn}: final results, semi-final & winner`
          : `Eurovision ${f.year} ${f.cityIn}: final results & winner`,
    description: (f) => {
      const where = `Eurovision Song Contest ${f.year} ${f.cityIn}${f.host ? `, ${f.host}` : ''}`;
      if (f.cancelled) {
        return `${where} was cancelled before the shows. Here are the ${f.entries} songs that had been chosen to compete.`;
      }
      const shows = f.semis > 0 ? `${f.entries} countries, ${f.semis === 1 ? 'one semi-final' : `${f.semis} semi-finals`} and the grand final` : `${f.entries} countries in one show`;
      let won = '';
      if (f.winners.length === 1) {
        const w = f.winners[0];
        won = ` ${w.country} won${songBy(w, 'en')}${w.points !== null ? ` and ${w.points} points` : ''}.`;
      } else if (f.winners.length > 1) {
        const p = sharedPoints(f.winners);
        won = ` ${joinList(f.winners.map((w) => w.country), 'en')} shared first place${p !== null ? ` with ${p} points each` : ''}.`;
      }
      return `${where}: ${shows}.${won} Full ranking with every artist, song and score.`;
    },
    h1: (f) => `Eurovision ${f.year} ${f.cityIn}`,
    lede: (f) => {
      if (f.cancelled) {
        return `The ${f.year} contest ${f.cityIn} never reached the stage: it was cancelled before the shows. These are the ${f.entries} songs the countries had chosen for it.`;
      }
      const who = f.winners.length > 1 ? 'the winners' : 'the winner';
      const rest = f.semis > 1
        ? `Below: ${who}, the full grand final ranking and both semi-finals, with every artist and song.`
        : f.semis === 1
          ? `Below: ${who}, the full grand final ranking and the semi-final, with every artist and song.`
          : `Below: ${who} and the full ranking, with every artist and song.`;
      if (f.winners.length === 1) return `${f.winners[0].country} won the ${f.year} contest ${f.cityIn}${songBy(f.winners[0], 'en')}. ${rest}`;
      if (f.winners.length > 1) return `The ${f.year} contest ${f.cityIn} ended in a tie: ${joinList(f.winners.map((w) => w.country), 'en')} all finished first. ${rest}`;
      return `The ${f.year} contest ${f.cityIn}. ${rest}`;
    },
    callout: (f) => {
      if (f.winners.length > 1) {
        const p = sharedPoints(f.winners);
        return `${joinList(f.winners.map((w) => w.country), 'en')} shared the win in ${f.year}${p !== null ? ` with ${p} points each` : ''}`;
      }
      const w = f.winners[0];
      return `${w.country} won Eurovision ${f.year}${w.points !== null ? ` with ${w.points} points` : ''}`;
    },
    winnerTitle: (n) => (n > 1 ? 'The winners' : 'The winner'),
    finalTitle: 'Grand final ranking',
    semiIntro: 'Qualifiers went through to the grand final; the others were knocked out on the night.',
    semiTitle: (n, single, date) => `${single ? 'Semi-final' : `Semi-final ${n}`}${date ? ` · ${date}` : ''}`,
    cancelledTitle: 'A contest that never happened',
    cancelledNote: (f) =>
      `The ${f.year} contest was called off before any show took place, so there are no places or points. Each country had already chosen its song; this is the line-up that would have competed.`,
    entriesTitle: (n) => `The ${n} entries`,
    navTitle: 'More contests',
    prev: (y) => `← Eurovision ${y}`,
    next: (y) => `Eurovision ${y} →`,
    allYears: 'All past contests',
    listName: (y) => `Eurovision ${y} grand final ranking`,
    entriesListName: (y) => `Eurovision ${y} entries`,
  },
  index: {
    title: (f) => `Past Eurovision contests: every year from ${f.first} to ${f.last}`,
    description: (f) =>
      `All ${f.count} Eurovision Song Contests from ${f.first} to ${f.last}: host city, winning country, song and points, each with its full results page.`,
    h1: 'Past Eurovision contests',
    lede: (f) =>
      `${f.count} contests, newest first. Pick a year for the full ranking, the semi-finals where there were any, and every song that competed.`,
    tableTitle: 'Every contest',
    listName: 'Past Eurovision Song Contests',
    liveLink: (y) => `This year's contest: Eurovision ${y}`,
    headers: { year: 'Year', city: 'Host city', winner: 'Winner', song: 'Song', points: 'Points' },
    cancelled: 'Cancelled',
    shared: 'shared',
  },
};

const el: ArchiveCopy = {
  crumbs: { home: 'Αρχική', archive: 'Προηγούμενοι διαγωνισμοί', year: (y) => `Eurovision ${y}` },
  chip: { archive: 'Αρχείο', cancelled: 'Ακυρώθηκε' },
  year: {
    title: (f) =>
      f.cancelled
        ? `Eurovision ${f.year} ${f.cityIn}: ο διαγωνισμός που ακυρώθηκε και οι ${f.entries} συμμετοχές`
        : f.semis > 1
          ? `Eurovision ${f.year} ${f.cityIn}: αποτελέσματα, ημιτελικοί και νικητής`
          : f.semis === 1
          ? `Eurovision ${f.year} ${f.cityIn}: αποτελέσματα, ημιτελικός και νικητής`
          : `Eurovision ${f.year} ${f.cityIn}: αποτελέσματα και νικητής`,
    description: (f) => {
      const where = `Eurovision ${f.year} ${f.cityIn}${f.host ? ` (${f.host})` : ''}`;
      if (f.cancelled) {
        return `Η ${where} ακυρώθηκε πριν από τις εκπομπές. Εδώ είναι τα ${f.entries} τραγούδια που είχαν επιλεγεί να διαγωνιστούν.`;
      }
      const shows = f.semis > 0 ? `${f.entries} χώρες, ${f.semis === 1 ? 'ένας ημιτελικός' : `${f.semis} ημιτελικοί`} και ο μεγάλος τελικός` : `${f.entries} χώρες σε μία βραδιά`;
      let won = '';
      if (f.winners.length === 1) {
        const w = f.winners[0];
        won = ` ${greekCountrySubject(w.iso, w.country)} κέρδισε${songBy(w, 'el')}${w.points !== null ? ` και ${w.points} βαθμούς` : ''}.`;
      } else if (f.winners.length > 1) {
        const p = sharedPoints(f.winners);
        won = ` ${joinList(f.winners.map((w) => w.country), 'el')} μοιράστηκαν την πρώτη θέση${p !== null ? ` με ${p} βαθμούς η κάθε χώρα` : ''}.`;
      }
      return `${where}: ${shows}.${won} Η πλήρης κατάταξη με καλλιτέχνες, τραγούδια και βαθμούς.`;
    },
    h1: (f) => `Eurovision ${f.year} ${f.cityIn}`,
    lede: (f) => {
      if (f.cancelled) {
        return `Ο διαγωνισμός του ${f.year} ${f.cityIn} δεν έφτασε ποτέ στη σκηνή: ακυρώθηκε πριν από τις εκπομπές. Αυτά είναι τα ${f.entries} τραγούδια που είχαν επιλέξει οι χώρες.`;
      }
      const who = f.winners.length > 1 ? 'οι νικητές' : 'ο νικητής';
      const rest = f.semis > 1
        ? `Παρακάτω: ${who}, η πλήρης κατάταξη του μεγάλου τελικού και οι δύο ημιτελικοί, με όλους τους καλλιτέχνες και τα τραγούδια.`
        : f.semis === 1
          ? `Παρακάτω: ${who}, η πλήρης κατάταξη του μεγάλου τελικού και ο ημιτελικός, με όλους τους καλλιτέχνες και τα τραγούδια.`
          : `Παρακάτω: ${who} και η πλήρης κατάταξη, με όλους τους καλλιτέχνες και τα τραγούδια.`;
      if (f.winners.length === 1) {
        const w = f.winners[0];
        return `${greekCountrySubject(w.iso, w.country)} κέρδισε τον διαγωνισμό του ${f.year} ${f.cityIn}${songBy(w, 'el')}. ${rest}`;
      }
      if (f.winners.length > 1) {
        return `Ο διαγωνισμός του ${f.year} ${f.cityIn} έληξε με ισοβαθμία: ${joinList(f.winners.map((w) => w.country), 'el')} μοιράστηκαν την πρώτη θέση. ${rest}`;
      }
      return `Ο διαγωνισμός του ${f.year} ${f.cityIn}. ${rest}`;
    },
    callout: (f) => {
      if (f.winners.length > 1) {
        const p = sharedPoints(f.winners);
        return `${joinList(f.winners.map((w) => w.country), 'el')} μοιράστηκαν τη νίκη το ${f.year}${p !== null ? ` με ${p} βαθμούς η κάθε χώρα` : ''}`;
      }
      const w = f.winners[0];
      return `${greekCountrySubject(w.iso, w.country)} κέρδισε τη Eurovision ${f.year}${w.points !== null ? ` με ${w.points} βαθμούς` : ''}`;
    },
    winnerTitle: (n) => (n > 1 ? 'Οι νικητές' : 'Ο νικητής'),
    finalTitle: 'Κατάταξη μεγάλου τελικού',
    semiIntro: 'Όσες χώρες προκρίθηκαν πέρασαν στον μεγάλο τελικό· οι υπόλοιπες αποκλείστηκαν την ίδια βραδιά.',
    semiTitle: (n, single, date) => `${single ? 'Ημιτελικός' : `${n === 1 ? 'Α΄' : 'Β΄'} ημιτελικός`}${date ? ` · ${date}` : ''}`,
    cancelledTitle: 'Ένας διαγωνισμός που δεν έγινε ποτέ',
    cancelledNote: (f) =>
      `Ο διαγωνισμός του ${f.year} ακυρώθηκε πριν από οποιαδήποτε εκπομπή, οπότε δεν υπάρχουν θέσεις ούτε βαθμοί. Κάθε χώρα είχε ήδη επιλέξει το τραγούδι της· αυτή είναι η σύνθεση που θα διαγωνιζόταν.`,
    entriesTitle: (n) => `Οι ${n} συμμετοχές`,
    navTitle: 'Περισσότεροι διαγωνισμοί',
    prev: (y) => `← Eurovision ${y}`,
    next: (y) => `Eurovision ${y} →`,
    allYears: 'Όλοι οι προηγούμενοι διαγωνισμοί',
    listName: (y) => `Κατάταξη του μεγάλου τελικού της Eurovision ${y}`,
    entriesListName: (y) => `Οι συμμετοχές της Eurovision ${y}`,
  },
  index: {
    title: (f) => `Όλοι οι διαγωνισμοί Eurovision από το ${f.first} έως το ${f.last}`,
    description: (f) =>
      `Οι ${f.count} διαγωνισμοί Eurovision από το ${f.first} έως το ${f.last}: πόλη, νικήτρια χώρα, τραγούδι και βαθμοί, ο καθένας με τη σελίδα των αποτελεσμάτων του.`,
    h1: 'Προηγούμενοι διαγωνισμοί Eurovision',
    lede: (f) =>
      `${f.count} διαγωνισμοί, από τον πιο πρόσφατο. Διαλέξτε χρονιά για την πλήρη κατάταξη, τους ημιτελικούς όπου υπήρξαν και όλα τα τραγούδια.`,
    tableTitle: 'Όλοι οι διαγωνισμοί',
    listName: 'Προηγούμενοι διαγωνισμοί Eurovision',
    liveLink: (y) => `Ο φετινός διαγωνισμός: Eurovision ${y}`,
    headers: { year: 'Έτος', city: 'Πόλη', winner: 'Νικητής', song: 'Τραγούδι', points: 'Βαθμοί' },
    cancelled: 'Ακυρώθηκε',
    shared: 'ισοβαθμία',
  },
};

export const archiveCopy: Record<Locale, ArchiveCopy> = { en, el };

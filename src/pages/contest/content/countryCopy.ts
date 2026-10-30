/**
 * Copy for /countries (A–Z index) and /countries/{slug} (one country), EN + EL.
 *
 * Facts come from the snapshot via countryFacts(); sentences are our own
 * templates (spec §9). Titles and descriptions carry the country name, so they
 * are unique per page.
 */
import type { CountryParticipation, CountrySnapshot } from '../../../content/contests/types';
import type { Locale } from '../../../lib/seo/locale';
import { greekCountrySubject } from './hubCopy';
import { joinList, ordinal } from './archiveCopy';

// ─── Facts ──────────────────────────────────────────────────────────────────

export interface CountryFacts {
  iso: string;
  name: string;
  /** Non-cancelled participations. */
  participations: number;
  wins: number;
  winYears: number[];
  bestPlace: number | null;
  first: number | null;
  last: number | null;
}

export function countryFacts(country: CountrySnapshot, locale: Locale): CountryFacts {
  const counted = country.participations.filter((p) => !p.cancelled);
  const places = counted.map((p) => p.final_place).filter((n): n is number => n !== null);
  const winYears = counted.filter((p) => p.final_place === 1).map((p) => p.year);
  return {
    iso: country.iso,
    name: locale === 'el' ? country.name_el : country.name_en,
    participations: counted.length,
    wins: winYears.length,
    winYears,
    bestPlace: places.length ? Math.min(...places) : null,
    first: counted[0]?.year ?? null,
    last: counted[counted.length - 1]?.year ?? null,
  };
}

// ─── Copy ───────────────────────────────────────────────────────────────────

export interface CountryCopy {
  crumbs: { home: string; countries: string };
  chip: string;
  country: {
    title: (f: CountryFacts) => string;
    description: (f: CountryFacts) => string;
    h1: (f: CountryFacts) => string;
    lede: (f: CountryFacts) => string;
    summaryTitle: string;
    summary: { participations: string; wins: string; bestPlace: string; firstYear: string };
    winsTitle: (n: number) => string;
    lastTenTitle: string;
    historyTitle: string;
    seeAlsoTitle: string;
    seeAlso: string;
    headers: { year: string; city: string; artist: string; song: string; result: string; points: string };
    result: (p: CountryParticipation) => string | null;
    allCountries: string;
  };
  index: {
    title: (n: number) => string;
    description: (n: number) => string;
    h1: string;
    lede: (n: number) => string;
    entry: (participations: number, wins: number) => string;
    listName: string;
  };
}

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const participationsEn = (n: number) => `${n} participation${n === 1 ? '' : 's'}`;
const participationsEl = (n: number) => `${n} ${n === 1 ? 'συμμετοχή' : 'συμμετοχές'}`;
const winsEn = (n: number) => `${n} win${n === 1 ? '' : 's'}`;
const winsEl = (n: number) => `${n} ${n === 1 ? 'νίκη' : 'νίκες'}`;
const spanEn = (f: CountryFacts) => (f.first === f.last ? `in ${f.first}` : `from ${f.first} to ${f.last}`);
const spanEl = (f: CountryFacts) => (f.first === f.last ? `το ${f.first}` : `από το ${f.first} έως το ${f.last}`);

const en: CountryCopy = {
  crumbs: { home: 'Home', countries: 'Countries' },
  chip: 'Countries',
  country: {
    title: (f) => `${f.name} at Eurovision: every entry, result and win`,
    description: (f) => {
      const record = f.wins > 0
        ? `, ${winsEn(f.wins)} (${joinList(f.winYears.map(String), 'en')})`
        : f.bestPlace !== null ? `, best result ${ordinal(f.bestPlace, 'en')} place` : '';
      return `${f.name} at the Eurovision Song Contest: ${participationsEn(f.participations)} ${spanEn(f)}${record}. Artist, song, place and points for every year.`;
    },
    h1: (f) => `${f.name} at Eurovision`,
    lede: (f) => {
      const record = f.wins > 0
        ? `It has won ${times(f.wins)}: ${joinList(f.winYears.map(String), 'en')}.`
        : f.bestPlace !== null ? `Its best result so far is ${ordinal(f.bestPlace, 'en')} place.` : 'It has not reached a grand final yet.';
      return `${f.name} has competed at Eurovision ${times(f.participations)}, ${spanEn(f)}. ${record} Below is every entry, with links to each year's full results.`;
    },
    summaryTitle: 'At a glance',
    summary: { participations: 'Participations', wins: 'Wins', bestPlace: 'Best place', firstYear: 'First year' },
    winsTitle: (n) => (n === 1 ? 'The win' : 'The wins'),
    lastTenTitle: 'The last 10 entries',
    historyTitle: 'Full history',
    seeAlsoTitle: 'See also',
    seeAlso: 'Countries that share part of this history:',
    headers: { year: 'Year', city: 'Host city', artist: 'Artist', song: 'Song', result: 'Result', points: 'Points' },
    result: (p) => {
      if (p.cancelled) return 'Contest cancelled';
      if (p.final_place !== null) return `${ordinal(p.final_place, 'en')} in the final`;
      if (p.semi !== null && p.qualified === false) {
        return `Out in semi-final ${p.semi}${p.semi_place !== null ? ` (${ordinal(p.semi_place, 'en')})` : ''}`;
      }
      return null;
    },
    allCountries: 'All countries',
  },
  index: {
    title: (n) => `Eurovision countries A–Z: all ${n} that have taken part`,
    description: (n) =>
      `Every one of the ${n} countries that has competed at the Eurovision Song Contest, A to Z, with its number of participations and wins.`,
    h1: 'Eurovision countries',
    lede: (n) => `${n} countries have sung at Eurovision. Pick one for its full history: every artist, song, place and win.`,
    entry: (p, w) => `${participationsEn(p)}${w > 0 ? ` · ${winsEn(w)}` : ''}`,
    listName: 'Eurovision countries',
  },
};

const el: CountryCopy = {
  crumbs: { home: 'Αρχική', countries: 'Χώρες' },
  chip: 'Χώρες',
  country: {
    title: (f) => `${f.name} στη Eurovision: όλες οι συμμετοχές, τα αποτελέσματα και οι νίκες`,
    description: (f) => {
      const record = f.wins > 0
        ? `, ${winsEl(f.wins)} (${joinList(f.winYears.map(String), 'el')})`
        : f.bestPlace !== null ? `, καλύτερη θέση η ${ordinal(f.bestPlace, 'el')}` : '';
      return `${f.name} στη Eurovision: ${participationsEl(f.participations)} ${spanEl(f)}${record}. Καλλιτέχνης, τραγούδι, θέση και βαθμοί για κάθε χρονιά.`;
    },
    h1: (f) => `${f.name} στη Eurovision`,
    lede: (f) => {
      const subject = greekCountrySubject(f.iso, f.name);
      const record = f.wins > 0
        ? `Έχει κερδίσει ${f.wins === 1 ? 'μία φορά' : `${f.wins} φορές`}: ${joinList(f.winYears.map(String), 'el')}.`
        : f.bestPlace !== null ? `Καλύτερη θέση μέχρι σήμερα: η ${ordinal(f.bestPlace, 'el')}.` : 'Δεν έχει φτάσει ακόμη σε μεγάλο τελικό.';
      return `${subject} έχει διαγωνιστεί στη Eurovision ${f.participations === 1 ? 'μία φορά' : `${f.participations} φορές`}, ${spanEl(f)}. ${record} Παρακάτω θα βρείτε όλες τις συμμετοχές, με σύνδεσμο στα πλήρη αποτελέσματα κάθε χρονιάς.`;
    },
    summaryTitle: 'Με μια ματιά',
    summary: { participations: 'Συμμετοχές', wins: 'Νίκες', bestPlace: 'Καλύτερη θέση', firstYear: 'Πρώτη συμμετοχή' },
    winsTitle: (n) => (n === 1 ? 'Η νίκη' : 'Οι νίκες'),
    lastTenTitle: 'Οι 10 τελευταίες συμμετοχές',
    historyTitle: 'Όλη η ιστορία',
    seeAlsoTitle: 'Δείτε επίσης',
    seeAlso: 'Χώρες που μοιράζονται μέρος αυτής της ιστορίας:',
    headers: { year: 'Έτος', city: 'Πόλη', artist: 'Καλλιτέχνης', song: 'Τραγούδι', result: 'Αποτέλεσμα', points: 'Βαθμοί' },
    result: (p) => {
      if (p.cancelled) return 'Ο διαγωνισμός ακυρώθηκε';
      if (p.final_place !== null) return `${ordinal(p.final_place, 'el')} θέση στον τελικό`;
      if (p.semi !== null && p.qualified === false) {
        return `Αποκλεισμός στον ${p.semi === 1 ? 'Α΄' : 'Β΄'} ημιτελικό${p.semi_place !== null ? ` (${ordinal(p.semi_place, 'el')})` : ''}`;
      }
      return null;
    },
    allCountries: 'Όλες οι χώρες',
  },
  index: {
    title: (n) => `Χώρες της Eurovision από το Α έως το Ω: όλες οι ${n}`,
    description: (n) =>
      `Οι ${n} χώρες που έχουν διαγωνιστεί στη Eurovision, με αλφαβητική σειρά, μαζί με τον αριθμό συμμετοχών και νικών της καθεμίας.`,
    h1: 'Οι χώρες της Eurovision',
    lede: (n) => `${n} χώρες έχουν τραγουδήσει στη Eurovision. Διαλέξτε μία για όλη την ιστορία της: καλλιτέχνες, τραγούδια, θέσεις και νίκες.`,
    entry: (p, w) => `${participationsEl(p)}${w > 0 ? ` · ${winsEl(w)}` : ''}`,
    listName: 'Οι χώρες της Eurovision',
  },
};

export const countryCopy: Record<Locale, CountryCopy> = { en, el };

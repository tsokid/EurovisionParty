/**
 * Copy for the live-contest hub (/eurovision-{year} and its schedule,
 * semifinals and songs pages), EN + EL.
 *
 * Facts (cities, dates, counts, names, points) come from the contest snapshot
 * via hubFacts(); every sentence around them is our own template — nothing is
 * copied from Wikipedia or other sources (spec §9). Titles and descriptions are
 * unique per page and locale.
 */
import type { ContestSnapshot, ContestStage, EntrySnapshot } from '../../../content/contests/types';
import type { Locale } from '../../../lib/seo/locale';

// ─── Cities ─────────────────────────────────────────────────────────────────

/** Greek name and "in <city>" phrase per city_slug (preposition follows the noun's gender). */
const CITY_EL: Record<string, { name: string; in: string }> = {
  amsterdam: { name: 'Άμστερνταμ', in: 'στο Άμστερνταμ' },
  athens: { name: 'Αθήνα', in: 'στην Αθήνα' },
  baku: { name: 'Μπακού', in: 'στο Μπακού' },
  basel: { name: 'Βασιλεία', in: 'στη Βασιλεία' },
  belgrade: { name: 'Βελιγράδι', in: 'στο Βελιγράδι' },
  bergen: { name: 'Μπέργκεν', in: 'στο Μπέργκεν' },
  birmingham: { name: 'Μπέρμιγχαμ', in: 'στο Μπέρμιγχαμ' },
  brighton: { name: 'Μπράιτον', in: 'στο Μπράιτον' },
  brussels: { name: 'Βρυξέλλες', in: 'στις Βρυξέλλες' },
  cannes: { name: 'Κάννες', in: 'στις Κάννες' },
  copenhagen: { name: 'Κοπεγχάγη', in: 'στην Κοπεγχάγη' },
  dublin: { name: 'Δουβλίνο', in: 'στο Δουβλίνο' },
  dusseldorf: { name: 'Ντίσελντορφ', in: 'στο Ντίσελντορφ' },
  edinburgh: { name: 'Εδιμβούργο', in: 'στο Εδιμβούργο' },
  frankfurt: { name: 'Φρανκφούρτη', in: 'στη Φρανκφούρτη' },
  gothenburg: { name: 'Γκέτεμποργκ', in: 'στο Γκέτεμποργκ' },
  harrogate: { name: 'Χάρογκεϊτ', in: 'στο Χάρογκεϊτ' },
  helsinki: { name: 'Ελσίνκι', in: 'στο Ελσίνκι' },
  hilversum: { name: 'Χίλβερσουμ', in: 'στο Χίλβερσουμ' },
  istanbul: { name: 'Κωνσταντινούπολη', in: 'στην Κωνσταντινούπολη' },
  jerusalem: { name: 'Ιερουσαλήμ', in: 'στην Ιερουσαλήμ' },
  kyiv: { name: 'Κίεβο', in: 'στο Κίεβο' },
  lausanne: { name: 'Λωζάνη', in: 'στη Λωζάνη' },
  lisbon: { name: 'Λισαβόνα', in: 'στη Λισαβόνα' },
  liverpool: { name: 'Λίβερπουλ', in: 'στο Λίβερπουλ' },
  london: { name: 'Λονδίνο', in: 'στο Λονδίνο' },
  lugano: { name: 'Λουγκάνο', in: 'στο Λουγκάνο' },
  'luxembourg-city': { name: 'Πόλη του Λουξεμβούργου', in: 'στην Πόλη του Λουξεμβούργου' },
  madrid: { name: 'Μαδρίτη', in: 'στη Μαδρίτη' },
  malmo: { name: 'Μάλμε', in: 'στο Μάλμε' },
  millstreet: { name: 'Μίλστριτ', in: 'στο Μίλστριτ' },
  moscow: { name: 'Μόσχα', in: 'στη Μόσχα' },
  munich: { name: 'Μόναχο', in: 'στο Μόναχο' },
  naples: { name: 'Νάπολη', in: 'στη Νάπολη' },
  oslo: { name: 'Όσλο', in: 'στο Όσλο' },
  paris: { name: 'Παρίσι', in: 'στο Παρίσι' },
  riga: { name: 'Ρίγα', in: 'στη Ρίγα' },
  rome: { name: 'Ρώμη', in: 'στη Ρώμη' },
  rotterdam: { name: 'Ρότερνταμ', in: 'στο Ρότερνταμ' },
  stockholm: { name: 'Στοκχόλμη', in: 'στη Στοκχόλμη' },
  tallinn: { name: 'Ταλίν', in: 'στο Ταλίν' },
  'tel-aviv': { name: 'Τελ Αβίβ', in: 'στο Τελ Αβίβ' },
  'the-hague': { name: 'Χάγη', in: 'στη Χάγη' },
  turin: { name: 'Τορίνο', in: 'στο Τορίνο' },
  vienna: { name: 'Βιέννη', in: 'στη Βιέννη' },
  zagreb: { name: 'Ζάγκρεμπ', in: 'στο Ζάγκρεμπ' },
};

/** Localized city name and "in <city>" phrase; EL falls back to the English name. */
export function cityName(locale: Locale, citySlug: string, cityEn: string): { name: string; in: string } {
  if (locale === 'en') return { name: cityEn, in: `in ${cityEn}` };
  return CITY_EL[citySlug] ?? { name: cityEn, in: `στο ${cityEn}` };
}

// ─── Countries ──────────────────────────────────────────────────────────────

/** Greek article for country names that are not feminine (the default "Η"). */
const COUNTRY_ARTICLE_EL: Record<string, string> = {
  AZ: 'Το', BE: 'Το', GB: 'Το', IL: 'Το', LU: 'Το', MA: 'Το', MC: 'Το', ME: 'Το',
  SM: 'Ο',
};

/** Country as the subject of a Greek sentence: "Η Βουλγαρία", "Το Ισραήλ". */
export function greekCountrySubject(iso: string, nameEl: string): string {
  return `${COUNTRY_ARTICLE_EL[iso] ?? 'Η'} ${nameEl}`;
}

export const countryName = (e: Pick<EntrySnapshot, 'name_en' | 'name_el'>, locale: Locale): string =>
  locale === 'el' ? e.name_el : e.name_en;

// ─── Dates (no Intl: identical output on the server and in every browser) ───

const MONTHS: Record<Locale, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  // Genitive, as used after a day number.
  el: ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'],
};

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

/** `2026-05-16` → "16 May 2026" / "16 Μαΐου 2026". */
export function formatDate(iso: string, locale: Locale): string {
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS[locale][m - 1]} ${y}`;
}

/** Day and month, no year: "16 May". */
export function formatDay(iso: string, locale: Locale): string {
  const { m, d } = parts(iso);
  return `${d} ${MONTHS[locale][m - 1]}`;
}

/** Two dates without the year: "12 and 14 May", or "30 April and 2 May". */
export function formatDayPair(a: string, b: string, locale: Locale): string {
  const and = locale === 'el' ? 'και' : 'and';
  const pa = parts(a);
  const pb = parts(b);
  if (pa.m === pb.m) return `${pa.d} ${and} ${pb.d} ${MONTHS[locale][pb.m - 1]}`;
  return `${formatDay(a, locale)} ${and} ${formatDay(b, locale)}`;
}

// ─── Facts ──────────────────────────────────────────────────────────────────

export interface HubFacts {
  year: number;
  stage: ContestStage;
  city: string;
  /** "in Vienna" / "στη Βιέννη". */
  cityIn: string;
  /** Host country in the page locale, when known. */
  host: string | null;
  dates: ContestSnapshot['dates'];
  entries: number;
  /** Countries in the grand final (0 until known). */
  finalists: number;
  semi1: number;
  semi2: number;
  /** Countries that skip the semi-finals. */
  direct: number;
  /** Countries in a semi-final. */
  semiEntries: number;
  /** Semi-finalists that qualified (0 until known). */
  qualifiers: number;
  /** Semi-final places, points or qualification are known. */
  hasSemiResults: boolean;
  winner: { iso: string; country: string; artist: string | null; song: string | null; points: number } | null;
}

export function hubFacts(contest: ContestSnapshot, locale: Locale): HubFacts {
  const { entries } = contest;
  const city = cityName(locale, contest.city_slug, contest.city);
  const hostEntry = entries.find((e) => e.iso === contest.host_iso);
  const top = entries.find((e) => e.final_place === 1 && e.total_points != null);
  const inSemi = entries.filter((e) => e.semi != null);
  return {
    year: contest.year,
    stage: contest.stage,
    city: city.name,
    cityIn: city.in,
    host: hostEntry ? countryName(hostEntry, locale) : null,
    dates: contest.dates,
    entries: entries.length,
    finalists: entries.filter((e) => e.in_final).length,
    semi1: entries.filter((e) => e.semi === 1).length,
    semi2: entries.filter((e) => e.semi === 2).length,
    direct: entries.length - inSemi.length,
    semiEntries: inSemi.length,
    qualifiers: inSemi.filter((e) => e.qualified === true).length,
    hasSemiResults: inSemi.some((e) => e.semi_place != null || e.semi_points != null || e.qualified != null),
    winner: top
      ? { iso: top.iso, country: countryName(top, locale), artist: top.artist, song: top.song, points: top.total_points! }
      : null,
  };
}

/** The final has been decided: the hub leads with results. */
export const showsResults = (f: HubFacts): boolean =>
  (f.stage === 'finalized' || f.stage === 'archived') && f.winner !== null;

// ─── Sentence helpers ───────────────────────────────────────────────────────

function showsClause(f: HubFacts, locale: Locale): string {
  const { semi1, semi2, final } = f.dates;
  if (locale === 'el') {
    const semis = semi1 && semi2 ? `ημιτελικοί στις ${formatDayPair(semi1, semi2, 'el')}` : null;
    const fin = final ? `μεγάλος τελικός στις ${formatDate(final, 'el')}` : null;
    if (semis && fin) return `${semis} και ${fin}`;
    return semis ?? fin ?? 'οι ημερομηνίες θα ανακοινωθούν';
  }
  const semis = semi1 && semi2 ? `semi-finals on ${formatDayPair(semi1, semi2, 'en')}` : null;
  const fin = final ? `the grand final on ${formatDate(final, 'en')}` : null;
  if (semis && fin) return `${semis} and ${fin}`;
  return semis ?? fin ?? 'dates to be announced';
}

/** "semi-final 1 on 12 May, semi-final 2 on 14 May, grand final on 16 May 2026". */
function datesList(f: HubFacts, locale: Locale): string | null {
  const { semi1, semi2, final } = f.dates;
  const out: string[] = [];
  if (locale === 'el') {
    if (semi1) out.push(`Α΄ ημιτελικός στις ${formatDay(semi1, 'el')}`);
    if (semi2) out.push(`Β΄ ημιτελικός στις ${formatDay(semi2, 'el')}`);
    if (final) out.push(`μεγάλος τελικός στις ${formatDate(final, 'el')}`);
  } else {
    if (semi1) out.push(`semi-final 1 on ${formatDay(semi1, 'en')}`);
    if (semi2) out.push(`semi-final 2 on ${formatDay(semi2, 'en')}`);
    if (final) out.push(`grand final on ${formatDate(final, 'en')}`);
  }
  return out.length ? out.join(', ') : null;
}

// ─── Copy ───────────────────────────────────────────────────────────────────

interface PageText {
  title: (f: HubFacts) => string;
  description: (f: HubFacts) => string;
  h1: (f: HubFacts) => string;
  lede: (f: HubFacts) => string;
}

export interface HubCopy {
  crumbs: { home: string; hub: (y: number) => string; schedule: string; semis: string; songs: string };
  chip: Record<ContestStage, string>;
  winner: (f: HubFacts) => string;
  hub: PageText & {
    results: string;
    lineup: (f: HubFacts) => string;
    glance: string;
    semisTitle: string;
    semisSummary: (f: HubFacts) => string;
    semisLink: string;
    scheduleTitle: string;
    scheduleLink: string;
    songsLink: string;
  };
  schedule: PageText & { showsTitle: string; howTitle: string; how: string; directTitle: string; direct: (n: number, names: string) => string };
  semis: PageText & { semiTitle: (n: 1 | 2, date: string | null) => string; directTitle: string; direct: (n: number) => string };
  songs: PageText & { listTitle: (f: HubFacts) => string; listName: (y: number) => string };
  glance: { hostCity: string; hostCountry: string; countries: string; finalists: string };
  shows: { semi1: string; semi2: string; final: string };
  headers: {
    place: string; country: string; artist: string; song: string; points: string; jury: string; televote: string;
    semi: string; runningOrder: string; result: string; language: string; show: string; date: string; countries: string;
  };
  values: { qualified: string; notQualified: string; semi: (n: 1 | 2) => string; direct: string };
  related: {
    heading: (y: number) => string;
    hub: { title: (y: number) => string; blurb: string };
    schedule: { title: string; blurb: string };
    semis: { title: string; blurb: string };
    songs: { title: string; blurb: string };
    winners: { title: string; blurb: string };
  };
  loading: string;
  error: string;
}

const en: HubCopy = {
  crumbs: { home: 'Home', hub: (y) => `Eurovision ${y}`, schedule: 'Schedule', semis: 'Semi-finals', songs: 'Songs' },
  chip: { upcoming: 'Coming up', current: 'Live contest', finalized: 'Results are in', archived: 'Archive' },
  winner: (f) => `${f.winner!.country} won Eurovision ${f.year} with ${f.winner!.points} points`,
  hub: {
    title: (f) => `Eurovision ${f.year} ${f.cityIn}: dates, semi-finals & songs`,
    description: (f) =>
      `Eurovision Song Contest ${f.year} ${f.cityIn}${f.host ? `, ${f.host}` : ''}: ${f.entries} countries, ${showsClause(f, 'en')}.` +
      (showsResults(f) ? ` ${f.winner!.country} won with ${f.winner!.points} points.` : ''),
    h1: (f) => `Eurovision ${f.year} ${f.cityIn}`,
    lede: (f) =>
      showsResults(f) && f.winner!.song
        ? `${f.winner!.country} won Eurovision ${f.year} ${f.cityIn} with “${f.winner!.song}”${f.winner!.artist ? ` by ${f.winner!.artist}` : ''}. Here are the full results, the semi-final split, the show dates and every song.`
        : `Everything about the ${f.year} contest ${f.cityIn}: ${f.entries} countries, ${showsClause(f, 'en')}. Line-ups, schedule and songs on one page.`,
    results: 'Final results',
    lineup: (f) => `The ${f.entries} entries`,
    glance: 'At a glance',
    semisTitle: 'Semi-final split',
    semisSummary: (f) =>
      `${f.semi1} countries in semi-final 1 and ${f.semi2} in semi-final 2` +
      (f.direct ? `; ${f.direct} go straight to the grand final.` : '.'),
    semisLink: 'Semi-final line-ups and results',
    scheduleTitle: 'Show dates',
    scheduleLink: 'Full schedule',
    songsLink: 'All songs and artists',
  },
  schedule: {
    title: (f) => `Eurovision ${f.year} schedule: semi-final and final dates`,
    description: (f) => {
      const list = datesList(f, 'en');
      return list
        ? `Eurovision ${f.year} dates ${f.cityIn}: ${list}. Show-by-show schedule with the countries in each.`
        : `Eurovision ${f.year} dates ${f.cityIn}: to be announced. Show-by-show schedule with the countries in each.`;
    },
    h1: (f) => `Eurovision ${f.year} schedule`,
    lede: (f) =>
      `Eurovision week ${f.cityIn} builds up to three live shows: two semi-finals and the grand final. Here are the dates of each show and the countries in it.`,
    showsTitle: 'The three shows',
    howTitle: 'How the week works',
    how: 'Each semi-final sends its best-placed countries through to the grand final. There they join the countries that qualified automatically, and the winner is decided by the combined jury and public vote.',
    directTitle: 'Straight to the final',
    direct: (n, names) => `${n} countries skip the semi-finals and go straight to the grand final: ${names}.`,
  },
  semis: {
    title: (f) => f.hasSemiResults
      ? `Eurovision ${f.year} semi-finals: results and qualifiers`
      : `Eurovision ${f.year} semi-finals: who sings in each show`,
    description: (f) => f.hasSemiResults
      ? `Both Eurovision ${f.year} semi-finals ${f.cityIn}: ${f.semiEntries} countries competed for ${f.qualifiers} places in the grand final. Places, points and who qualified.`
      : `Both Eurovision ${f.year} semi-finals ${f.cityIn}: ${f.semiEntries} countries split between semi-final 1 and semi-final 2, competing for a place in the grand final.`,
    h1: (f) => `Eurovision ${f.year} semi-finals`,
    lede: (f) => f.hasSemiResults
      ? `${f.semiEntries} countries, two nights, ${f.qualifiers} tickets to the final. Here is how each semi-final ended.`
      : `${f.semiEntries} countries are split across two semi-finals. Here is who sings on which night.`,
    semiTitle: (n, date) => `Semi-final ${n}${date ? ` · ${date}` : ''}`,
    directTitle: 'Already in the final',
    direct: (n) => `These ${n} countries do not compete in a semi-final; they qualify for the grand final automatically.`,
  },
  songs: {
    title: (f) => `Eurovision ${f.year} songs: all ${f.entries} entries and artists`,
    description: (f) =>
      `Every song of Eurovision ${f.year} ${f.cityIn} in one list: ${f.entries} countries with their artists, song titles and semi-final.`,
    h1: (f) => `Eurovision ${f.year} songs`,
    lede: (f) =>
      `All ${f.entries} entries of the ${f.year} contest, sorted by country. Use it as your listening guide before the shows or as your score sheet on the night.`,
    listTitle: (f) => `All ${f.entries} songs`,
    listName: (y) => `Eurovision ${y} songs`,
  },
  glance: { hostCity: 'Host city', hostCountry: 'Host country', countries: 'Countries', finalists: 'Countries in the final' },
  shows: { semi1: 'Semi-final 1', semi2: 'Semi-final 2', final: 'Grand final' },
  headers: {
    place: 'Place', country: 'Country', artist: 'Artist', song: 'Song', points: 'Points', jury: 'Jury', televote: 'Televote',
    semi: 'Semi-final', runningOrder: 'Running order', result: 'Result', language: 'Language', show: 'Show', date: 'Date', countries: 'Countries',
  },
  values: { qualified: 'Qualified', notQualified: 'Not qualified', semi: (n) => `Semi-final ${n}`, direct: 'Straight to the final' },
  related: {
    heading: (y) => `More on Eurovision ${y}`,
    hub: { title: (y) => `Eurovision ${y} overview`, blurb: 'City, dates, results and the full line-up.' },
    schedule: { title: 'Schedule', blurb: 'Dates of both semi-finals and the grand final.' },
    semis: { title: 'Semi-finals', blurb: 'Who sang in which semi-final and who qualified.' },
    songs: { title: 'Songs', blurb: 'Every artist and song title in one list.' },
    winners: { title: 'Eurovision winners', blurb: 'The most recent winners and the countries with the most wins.' },
  },
  loading: 'Loading…',
  error: 'This page could not be loaded. Check your connection and try again.',
};

const el: HubCopy = {
  crumbs: { home: 'Αρχική', hub: (y) => `Eurovision ${y}`, schedule: 'Πρόγραμμα', semis: 'Ημιτελικοί', songs: 'Τραγούδια' },
  chip: { upcoming: 'Έρχεται', current: 'Τρέχων διαγωνισμός', finalized: 'Τα αποτελέσματα', archived: 'Αρχείο' },
  winner: (f) => `${greekCountrySubject(f.winner!.iso, f.winner!.country)} κέρδισε τη Eurovision ${f.year} με ${f.winner!.points} βαθμούς`,
  hub: {
    title: (f) => `Eurovision ${f.year} ${f.cityIn}: ημερομηνίες, ημιτελικοί και τραγούδια`,
    description: (f) =>
      `Eurovision ${f.year} ${f.cityIn}${f.host ? ` (${f.host})` : ''}: ${f.entries} χώρες, ${showsClause(f, 'el')}.` +
      (showsResults(f) ? ` ${greekCountrySubject(f.winner!.iso, f.winner!.country)} κέρδισε με ${f.winner!.points} βαθμούς.` : ''),
    h1: (f) => `Eurovision ${f.year} ${f.cityIn}`,
    lede: (f) =>
      showsResults(f) && f.winner!.song
        ? `${greekCountrySubject(f.winner!.iso, f.winner!.country)} κέρδισε τη Eurovision ${f.year} ${f.cityIn} με το «${f.winner!.song}»${f.winner!.artist ? ` (${f.winner!.artist})` : ''}. Εδώ θα βρείτε τα πλήρη αποτελέσματα, τους ημιτελικούς, το πρόγραμμα και όλα τα τραγούδια.`
        : `Όλα για τον διαγωνισμό του ${f.year} ${f.cityIn}: ${f.entries} χώρες, ${showsClause(f, 'el')}. Συμμετοχές, πρόγραμμα και τραγούδια σε μία σελίδα.`,
    results: 'Αποτελέσματα τελικού',
    lineup: (f) => `Οι ${f.entries} συμμετοχές`,
    glance: 'Με μια ματιά',
    semisTitle: 'Οι ημιτελικοί',
    semisSummary: (f) =>
      `${f.semi1} χώρες στον Α΄ ημιτελικό και ${f.semi2} στον Β΄` +
      (f.direct ? `· ${f.direct} περνούν απευθείας στον μεγάλο τελικό.` : '.'),
    semisLink: 'Συμμετοχές και αποτελέσματα των ημιτελικών',
    scheduleTitle: 'Ημερομηνίες',
    scheduleLink: 'Αναλυτικό πρόγραμμα',
    songsLink: 'Όλα τα τραγούδια και οι καλλιτέχνες',
  },
  schedule: {
    title: (f) => `Πρόγραμμα Eurovision ${f.year}: ημερομηνίες ημιτελικών και τελικού`,
    description: (f) => {
      const list = datesList(f, 'el');
      return list
        ? `Ημερομηνίες Eurovision ${f.year} ${f.cityIn}: ${list}. Οι χώρες κάθε βραδιάς, εκπομπή προς εκπομπή.`
        : `Ημερομηνίες Eurovision ${f.year} ${f.cityIn}: θα ανακοινωθούν. Οι χώρες κάθε βραδιάς, εκπομπή προς εκπομπή.`;
    },
    h1: (f) => `Πρόγραμμα Eurovision ${f.year}`,
    lede: (f) =>
      `Η εβδομάδα της Eurovision ${f.cityIn} κορυφώνεται σε τρεις ζωντανές εκπομπές: δύο ημιτελικούς και τον μεγάλο τελικό. Δείτε πότε γίνεται η καθεμία και ποιες χώρες συμμετέχουν.`,
    showsTitle: 'Οι τρεις εκπομπές',
    howTitle: 'Πώς λειτουργεί η εβδομάδα',
    how: 'Κάθε ημιτελικός στέλνει τις καλύτερα βαθμολογημένες χώρες του στον μεγάλο τελικό. Εκεί συναντούν τις χώρες που προκρίθηκαν αυτόματα, και ο νικητής κρίνεται από τον συνδυασμό της ψήφου των επιτροπών και του κοινού.',
    directTitle: 'Απευθείας στον τελικό',
    direct: (n, names) => `${n} χώρες δεν διαγωνίζονται σε ημιτελικό και περνούν απευθείας στον μεγάλο τελικό: ${names}.`,
  },
  semis: {
    title: (f) => f.hasSemiResults
      ? `Ημιτελικοί Eurovision ${f.year}: αποτελέσματα και προκρίσεις`
      : `Ημιτελικοί Eurovision ${f.year}: ποιες χώρες διαγωνίζονται`,
    description: (f) => f.hasSemiResults
      ? `Οι δύο ημιτελικοί της Eurovision ${f.year} ${f.cityIn}: ${f.semiEntries} χώρες διεκδίκησαν ${f.qualifiers} θέσεις στον μεγάλο τελικό. Κατατάξεις, βαθμοί και προκρίσεις.`
      : `Οι δύο ημιτελικοί της Eurovision ${f.year} ${f.cityIn}: ${f.semiEntries} χώρες μοιράζονται σε Α΄ και Β΄ ημιτελικό και διεκδικούν μια θέση στον τελικό.`,
    h1: (f) => `Οι ημιτελικοί της Eurovision ${f.year}`,
    lede: (f) => f.hasSemiResults
      ? `${f.semiEntries} χώρες, δύο βραδιές, ${f.qualifiers} εισιτήρια για τον τελικό. Δείτε πώς έληξε κάθε ημιτελικός.`
      : `${f.semiEntries} χώρες μοιράζονται σε δύο ημιτελικούς. Δείτε ποιος τραγουδά σε κάθε βραδιά.`,
    semiTitle: (n, date) => `${n === 1 ? 'Α΄' : 'Β΄'} ημιτελικός${date ? ` · ${date}` : ''}`,
    directTitle: 'Ήδη στον τελικό',
    direct: (n) => `Αυτές οι ${n} χώρες δεν διαγωνίζονται σε ημιτελικό· προκρίνονται αυτόματα στον μεγάλο τελικό.`,
  },
  songs: {
    title: (f) => `Τραγούδια Eurovision ${f.year}: και οι ${f.entries} συμμετοχές`,
    description: (f) =>
      `Όλα τα τραγούδια της Eurovision ${f.year} ${f.cityIn} σε μία λίστα: ${f.entries} χώρες με καλλιτέχνες, τίτλους τραγουδιών και ημιτελικό.`,
    h1: (f) => `Τα τραγούδια της Eurovision ${f.year}`,
    lede: (f) =>
      `Και οι ${f.entries} συμμετοχές του διαγωνισμού του ${f.year}, ανά χώρα. Χρησιμοποιήστε τη λίστα ως οδηγό ακρόασης πριν από τις εκπομπές ή ως φύλλο βαθμολογίας τη βραδιά του τελικού.`,
    listTitle: (f) => `Και τα ${f.entries} τραγούδια`,
    listName: (y) => `Τα τραγούδια της Eurovision ${y}`,
  },
  glance: { hostCity: 'Πόλη διεξαγωγής', hostCountry: 'Χώρα διοργάνωσης', countries: 'Χώρες', finalists: 'Χώρες στον τελικό' },
  shows: { semi1: 'Α΄ ημιτελικός', semi2: 'Β΄ ημιτελικός', final: 'Μεγάλος τελικός' },
  headers: {
    place: 'Θέση', country: 'Χώρα', artist: 'Καλλιτέχνης', song: 'Τραγούδι', points: 'Βαθμοί', jury: 'Επιτροπές', televote: 'Κοινό',
    semi: 'Ημιτελικός', runningOrder: 'Σειρά εμφάνισης', result: 'Αποτέλεσμα', language: 'Γλώσσα', show: 'Εκπομπή', date: 'Ημερομηνία', countries: 'Χώρες',
  },
  values: { qualified: 'Προκρίθηκε', notQualified: 'Αποκλείστηκε', semi: (n) => `${n === 1 ? 'Α΄' : 'Β΄'} ημιτελικός`, direct: 'Απευθείας στον τελικό' },
  related: {
    heading: (y) => `Περισσότερα για τη Eurovision ${y}`,
    hub: { title: (y) => `Eurovision ${y}: συνοπτικά`, blurb: 'Πόλη, ημερομηνίες, αποτελέσματα και όλες οι συμμετοχές.' },
    schedule: { title: 'Πρόγραμμα', blurb: 'Οι ημερομηνίες των ημιτελικών και του μεγάλου τελικού.' },
    semis: { title: 'Ημιτελικοί', blurb: 'Ποιος τραγούδησε σε κάθε ημιτελικό και ποιος προκρίθηκε.' },
    songs: { title: 'Τραγούδια', blurb: 'Όλοι οι καλλιτέχνες και τα τραγούδια σε μία λίστα.' },
    winners: { title: 'Νικητές της Eurovision', blurb: 'Οι πρόσφατοι νικητές και οι χώρες με τις περισσότερες νίκες.' },
  },
  loading: 'Φόρτωση…',
  error: 'Η σελίδα δεν φορτώθηκε. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',
};

export const hubCopy: Record<Locale, HubCopy> = { en, el };

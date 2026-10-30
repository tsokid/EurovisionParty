/**
 * The live contest's yearly facts as ready-to-use text per locale, for the guide
 * copy files (year, city, dates, host, line-up size). Copy files take a
 * ContestTexts and template these in, so no guide page hardcodes a year.
 */
import type { CurrentContest } from '../../../lib/currentContest';
import type { Locale } from '../../../lib/seo/locale';
import { cityName, formatDate } from '../../contest/content/hubCopy';

export interface ContestText {
  year: number;
  /** "Vienna" / "Βιέννη". */
  city: string;
  /** "in Vienna" / "στη Βιέννη". */
  cityIn: string;
  /** "from Vienna" / "από τη Βιέννη". */
  cityFrom: string;
  /** Host country, "" when unknown. */
  host: string;
  /** "Saturday 16 May 2026" / "Σάββατο 16 Μαΐου 2026"; a generic phrase until the date is set. */
  finalDay: string;
  /** "Saturday 16 May" / "Σάββατο 16 Μαΐου" (no year); a generic phrase until the date is set. */
  finalDayShort: string;
  /** Month of the final on its own: "May" / "Μάιος"; "" until the date is set. */
  finalMonth: string;
  /** Host country flag emoji, "" when unknown. */
  flag: string;
  /** Competing countries. */
  lineup: number;
  /** The final has been decided (stage finalized or archived): copy uses the past tense. */
  decided: boolean;
}

export type ContestTexts = Record<Locale, ContestText>;

const WEEKDAYS: Record<Locale, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  el: ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'],
};

/** Nominative month names (standalone, not after a day number). */
const MONTHS_STANDALONE: Record<Locale, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  el: ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'],
};

/** Regional-indicator flag of an ISO 3166 alpha-2 code ("AT" → 🇦🇹). */
export const flagEmoji = (iso: string | null): string =>
  iso && /^[A-Z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso].map((ch) => 0x1f1a5 + ch.charCodeAt(0))) : '';

const NO_DATE: Record<Locale, string> = { en: 'a Saturday in May', el: 'ένα Σάββατο του Μαΐου' };

/** UTC weekday of a `YYYY-MM-DD` date (no Intl, no local time zone: same everywhere). */
function weekday(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[locale][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function text(cc: CurrentContest, locale: Locale): ContestText {
  const city = cityName(locale, cc.citySlug, cc.city);
  const cityFrom = locale === 'en' ? `from ${city.name}` : city.in.replace(/^στ(ην|η|ο|ις) /, 'από τ$1 ');
  const final = cc.finalDate;
  const date = final ? formatDate(final, locale) : null;
  return {
    year: cc.year,
    city: city.name,
    cityIn: city.in,
    cityFrom,
    host: cc.hostName[locale],
    finalDay: final && date ? `${weekday(final, locale)} ${date}` : NO_DATE[locale],
    finalDayShort: final && date ? `${weekday(final, locale)} ${date.replace(/ \d{4}$/, '')}` : NO_DATE[locale],
    finalMonth: final ? MONTHS_STANDALONE[locale][Number(final.slice(5, 7)) - 1] : '',
    flag: flagEmoji(cc.hostIso),
    lineup: cc.lineupSize,
    decided: cc.stage === 'finalized' || cc.stage === 'archived',
  };
}

export const contestTexts = (cc: CurrentContest): ContestTexts => ({ en: text(cc, 'en'), el: text(cc, 'el') });

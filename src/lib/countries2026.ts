import type { Country } from './types'

/**
 * 26 plausible Grand Final countries for Eurovision 2026.
 * ISO 3166-1 alpha-2 codes, with flag emoji.
 */
export const COUNTRIES_2026: Country[] = [
  { id: 'SE', name: 'Sweden',       flag: '\u{1F1F8}\u{1F1EA}' },
  { id: 'FR', name: 'France',       flag: '\u{1F1EB}\u{1F1F7}' },
  { id: 'IT', name: 'Italy',        flag: '\u{1F1EE}\u{1F1F9}' },
  { id: 'UA', name: 'Ukraine',      flag: '\u{1F1FA}\u{1F1E6}' },
  { id: 'CH', name: 'Switzerland',  flag: '\u{1F1E8}\u{1F1ED}' },
  { id: 'FI', name: 'Finland',      flag: '\u{1F1EB}\u{1F1EE}' },
  { id: 'NO', name: 'Norway',       flag: '\u{1F1F3}\u{1F1F4}' },
  { id: 'ES', name: 'Spain',        flag: '\u{1F1EA}\u{1F1F8}' },
  { id: 'DE', name: 'Germany',      flag: '\u{1F1E9}\u{1F1EA}' },
  { id: 'GB', name: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}' },
  { id: 'NL', name: 'Netherlands',  flag: '\u{1F1F3}\u{1F1F1}' },
  { id: 'AT', name: 'Austria',      flag: '\u{1F1E6}\u{1F1F9}' },
  { id: 'GR', name: 'Greece',       flag: '\u{1F1EC}\u{1F1F7}' },
  { id: 'IE', name: 'Ireland',      flag: '\u{1F1EE}\u{1F1EA}' },
  { id: 'IL', name: 'Israel',       flag: '\u{1F1EE}\u{1F1F1}' },
  { id: 'AU', name: 'Australia',    flag: '\u{1F1E6}\u{1F1FA}' },
  { id: 'RS', name: 'Serbia',       flag: '\u{1F1F7}\u{1F1F8}' },
  { id: 'HR', name: 'Croatia',      flag: '\u{1F1ED}\u{1F1F7}' },
  { id: 'AM', name: 'Armenia',      flag: '\u{1F1E6}\u{1F1F2}' },
  { id: 'PT', name: 'Portugal',     flag: '\u{1F1F5}\u{1F1F9}' },
  { id: 'BE', name: 'Belgium',      flag: '\u{1F1E7}\u{1F1EA}' },
  { id: 'CY', name: 'Cyprus',       flag: '\u{1F1E8}\u{1F1FE}' },
  { id: 'LT', name: 'Lithuania',    flag: '\u{1F1F1}\u{1F1F9}' },
  { id: 'EE', name: 'Estonia',      flag: '\u{1F1EA}\u{1F1EA}' },
  { id: 'MD', name: 'Moldova',      flag: '\u{1F1F2}\u{1F1E9}' },
  { id: 'AL', name: 'Albania',      flag: '\u{1F1E6}\u{1F1F1}' },
]

/** Lookup map by country ISO code */
export const COUNTRY_MAP = new Map(COUNTRIES_2026.map((c) => [c.id, c]))

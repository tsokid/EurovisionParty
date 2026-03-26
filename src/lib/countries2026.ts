import type { Country } from './types'

/**
 * 26 plausible Grand Final countries for Eurovision 2026.
 * ISO 3166-1 alpha-2 codes, with flag emoji.
 */
export const COUNTRIES_2026: Country[] = [
  { id: 'SE', name: 'Sweden',         name_el: 'Σουηδία',           flag: '\u{1F1F8}\u{1F1EA}' },
  { id: 'FR', name: 'France',         name_el: 'Γαλλία',            flag: '\u{1F1EB}\u{1F1F7}' },
  { id: 'IT', name: 'Italy',          name_el: 'Ιταλία',            flag: '\u{1F1EE}\u{1F1F9}' },
  { id: 'UA', name: 'Ukraine',        name_el: 'Ουκρανία',          flag: '\u{1F1FA}\u{1F1E6}' },
  { id: 'CH', name: 'Switzerland',    name_el: 'Ελβετία',           flag: '\u{1F1E8}\u{1F1ED}' },
  { id: 'FI', name: 'Finland',        name_el: 'Φινλανδία',         flag: '\u{1F1EB}\u{1F1EE}' },
  { id: 'NO', name: 'Norway',         name_el: 'Νορβηγία',          flag: '\u{1F1F3}\u{1F1F4}' },
  { id: 'ES', name: 'Spain',          name_el: 'Ισπανία',           flag: '\u{1F1EA}\u{1F1F8}' },
  { id: 'DE', name: 'Germany',        name_el: 'Γερμανία',          flag: '\u{1F1E9}\u{1F1EA}' },
  { id: 'GB', name: 'United Kingdom', name_el: 'Ηνωμένο Βασίλειο', flag: '\u{1F1EC}\u{1F1E7}' },
  { id: 'NL', name: 'Netherlands',    name_el: 'Ολλανδία',          flag: '\u{1F1F3}\u{1F1F1}' },
  { id: 'AT', name: 'Austria',        name_el: 'Αυστρία',           flag: '\u{1F1E6}\u{1F1F9}' },
  { id: 'GR', name: 'Greece',         name_el: 'Ελλάδα',            flag: '\u{1F1EC}\u{1F1F7}' },
  { id: 'IE', name: 'Ireland',        name_el: 'Ιρλανδία',          flag: '\u{1F1EE}\u{1F1EA}' },
  { id: 'IL', name: 'Israel',         name_el: 'Ισραήλ',            flag: '\u{1F1EE}\u{1F1F1}' },
  { id: 'AU', name: 'Australia',      name_el: 'Αυστραλία',         flag: '\u{1F1E6}\u{1F1FA}' },
  { id: 'RS', name: 'Serbia',         name_el: 'Σερβία',            flag: '\u{1F1F7}\u{1F1F8}' },
  { id: 'HR', name: 'Croatia',        name_el: 'Κροατία',           flag: '\u{1F1ED}\u{1F1F7}' },
  { id: 'AM', name: 'Armenia',        name_el: 'Αρμενία',           flag: '\u{1F1E6}\u{1F1F2}' },
  { id: 'PT', name: 'Portugal',       name_el: 'Πορτογαλία',        flag: '\u{1F1F5}\u{1F1F9}' },
  { id: 'BE', name: 'Belgium',        name_el: 'Βέλγιο',            flag: '\u{1F1E7}\u{1F1EA}' },
  { id: 'CY', name: 'Cyprus',         name_el: 'Κύπρος',            flag: '\u{1F1E8}\u{1F1FE}' },
  { id: 'LT', name: 'Lithuania',      name_el: 'Λιθουανία',         flag: '\u{1F1F1}\u{1F1F9}' },
  { id: 'EE', name: 'Estonia',        name_el: 'Εσθονία',           flag: '\u{1F1EA}\u{1F1EA}' },
  { id: 'MD', name: 'Moldova',        name_el: 'Μολδαβία',          flag: '\u{1F1F2}\u{1F1E9}' },
  { id: 'AL', name: 'Albania',        name_el: 'Αλβανία',           flag: '\u{1F1E6}\u{1F1F1}' },
]

/** Lookup map by country ISO code */
export const COUNTRY_MAP = new Map(COUNTRIES_2026.map((c) => [c.id, c]))

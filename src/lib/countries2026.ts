import type { Country } from './types'

/**
 * 26 plausible Grand Final countries for Eurovision 2026.
 * ISO 3166-1 alpha-2 codes, with flag emoji.
 *
 * Artist + song are PLACEHOLDERS — most are inspired by recent Eurovision
 * acts. Replace once the real 2026 lineup is announced.
 */
export const COUNTRIES_2026: Country[] = [
  { id: 'SE', name: 'Sweden',         name_el: 'Σουηδία',           flag: '\u{1F1F8}\u{1F1EA}', artist: 'Loreen Reborn',     song: 'Aurora Boreal' },
  { id: 'FR', name: 'France',         name_el: 'Γαλλία',            flag: '\u{1F1EB}\u{1F1F7}', artist: 'Slimane',           song: 'Mon Amour' },
  { id: 'IT', name: 'Italy',          name_el: 'Ιταλία',            flag: '\u{1F1EE}\u{1F1F9}', artist: 'Marco Mengoni',     song: 'Volo Su Te' },
  { id: 'UA', name: 'Ukraine',        name_el: 'Ουκρανία',          flag: '\u{1F1FA}\u{1F1E6}', artist: 'Jamala Echo',       song: 'Spalakh' },
  { id: 'CH', name: 'Switzerland',    name_el: 'Ελβετία',           flag: '\u{1F1E8}\u{1F1ED}', artist: 'Nemo',              song: 'Code Breaker' },
  { id: 'FI', name: 'Finland',        name_el: 'Φινλανδία',         flag: '\u{1F1EB}\u{1F1EE}', artist: 'Käärijä',           song: 'Cha Cha Boom' },
  { id: 'NO', name: 'Norway',         name_el: 'Νορβηγία',          flag: '\u{1F1F3}\u{1F1F4}', artist: 'Alessandra',        song: 'Polar Lights' },
  { id: 'ES', name: 'Spain',          name_el: 'Ισπανία',           flag: '\u{1F1EA}\u{1F1F8}', artist: 'Chanel',            song: 'Fuego Otra Vez' },
  { id: 'DE', name: 'Germany',        name_el: 'Γερμανία',          flag: '\u{1F1E9}\u{1F1EA}', artist: 'Lena',              song: 'Phoenix Rising' },
  { id: 'GB', name: 'United Kingdom', name_el: 'Ηνωμένο Βασίλειο', flag: '\u{1F1EC}\u{1F1E7}', artist: 'Sam Ryder',         song: 'Rocket Returns' },
  { id: 'NL', name: 'Netherlands',    name_el: 'Ολλανδία',          flag: '\u{1F1F3}\u{1F1F1}', artist: 'Joost',             song: 'Liefde' },
  { id: 'AT', name: 'Austria',        name_el: 'Αυστρία',           flag: '\u{1F1E6}\u{1F1F9}', artist: 'Conchita Forever',  song: 'Diamonds Burn' },
  { id: 'GR', name: 'Greece',         name_el: 'Ελλάδα',            flag: '\u{1F1EC}\u{1F1F7}', artist: 'Helena Paparizou',  song: 'Dance Again' },
  { id: 'IE', name: 'Ireland',        name_el: 'Ιρλανδία',          flag: '\u{1F1EE}\u{1F1EA}', artist: 'Bambie Thug',       song: 'Doomsday Dance' },
  { id: 'IL', name: 'Israel',         name_el: 'Ισραήλ',            flag: '\u{1F1EE}\u{1F1F1}', artist: 'Eden Golan',        song: 'Hurricane Echo' },
  { id: 'AU', name: 'Australia',      name_el: 'Αυστραλία',         flag: '\u{1F1E6}\u{1F1FA}', artist: 'Voyager',           song: 'Galaxy of Light' },
  { id: 'RS', name: 'Serbia',         name_el: 'Σερβία',            flag: '\u{1F1F7}\u{1F1F8}', artist: 'Konstrakta',        song: 'Brain Surgery' },
  { id: 'HR', name: 'Croatia',        name_el: 'Κροατία',           flag: '\u{1F1ED}\u{1F1F7}', artist: 'Baby Lasagna',      song: 'Rim Tim Tagi Dim' },
  { id: 'AM', name: 'Armenia',        name_el: 'Αρμενία',           flag: '\u{1F1E6}\u{1F1F2}', artist: 'LADANIVA',          song: 'Jako' },
  { id: 'PT', name: 'Portugal',       name_el: 'Πορτογαλία',        flag: '\u{1F1F5}\u{1F1F9}', artist: 'Iolanda',           song: 'Grito' },
  { id: 'BE', name: 'Belgium',        name_el: 'Βέλγιο',            flag: '\u{1F1E7}\u{1F1EA}', artist: 'Mustii',            song: "Before the Party's Over" },
  { id: 'CY', name: 'Cyprus',         name_el: 'Κύπρος',            flag: '\u{1F1E8}\u{1F1FE}', artist: 'Silia Kapsis',      song: 'Liar' },
  { id: 'LT', name: 'Lithuania',      name_el: 'Λιθουανία',         flag: '\u{1F1F1}\u{1F1F9}', artist: 'Silvester Belt',    song: 'Luktelk' },
  { id: 'EE', name: 'Estonia',        name_el: 'Εσθονία',           flag: '\u{1F1EA}\u{1F1EA}', artist: '5MIINUST',          song: 'Hold On' },
  { id: 'MD', name: 'Moldova',        name_el: 'Μολδαβία',          flag: '\u{1F1F2}\u{1F1E9}', artist: 'Pasha Parfeni',     song: 'Soarele și Luna' },
  { id: 'AL', name: 'Albania',        name_el: 'Αλβανία',           flag: '\u{1F1E6}\u{1F1F1}', artist: 'Besa',              song: 'Titan' },
]

/** Lookup map by country ISO code */
export const COUNTRY_MAP = new Map(COUNTRIES_2026.map((c) => [c.id, c]))

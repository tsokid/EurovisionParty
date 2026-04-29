import type { Country } from './types'

/**
 * Eurovision 2026 confirmed participants — 35 countries.
 *
 * Source: en.wikipedia.org/wiki/Eurovision_Song_Contest_2026 (parsed 2026-04-30).
 * Boycotting countries (Iceland, Ireland, Netherlands, Slovenia, Spain) are
 * excluded — Spain's boycott is why the "Big Five" is a "Big Four" this year.
 *
 * `semi`: 1 | 2 | 'big5' (auto-qualifier) | 'host' (Austria).
 * `runningOrder`: 1-based slot within the semi-final, where Wikipedia lists it.
 *
 * NOTE: Some artist/song details may shift before the live shows — cross-check
 * against eurovision.tv before using this list in user-visible copy or scoring.
 */
export const COUNTRIES_2026: Country[] = [
  // --- Semi-Final 1 ---
  { id: 'MD', name: 'Moldova',         name_el: 'Μολδαβία',          flag: '\u{1F1F2}\u{1F1E9}', artist: 'Satoshi',                          song: 'Viva, Moldova!',         language: 'Romanian',              semi: 1, runningOrder: 1 },
  { id: 'SE', name: 'Sweden',          name_el: 'Σουηδία',           flag: '\u{1F1F8}\u{1F1EA}', artist: 'Felicia',                          song: 'My System',              language: 'English',               semi: 1, runningOrder: 2 },
  { id: 'HR', name: 'Croatia',         name_el: 'Κροατία',           flag: '\u{1F1ED}\u{1F1F7}', artist: 'Lelek',                            song: 'Andromeda',              language: 'Croatian',              semi: 1, runningOrder: 3 },
  { id: 'PT', name: 'Portugal',        name_el: 'Πορτογαλία',        flag: '\u{1F1F5}\u{1F1F9}', artist: 'Bandidos do Cante',                song: 'Rosa',                   language: 'Portuguese',            semi: 1, runningOrder: 5 },
  { id: 'GE', name: 'Georgia',         name_el: 'Γεωργία',           flag: '\u{1F1EC}\u{1F1EA}', artist: 'Bzikebi',                          song: 'On Replay',              language: 'English',               semi: 1, runningOrder: 6 },
  { id: 'FI', name: 'Finland',         name_el: 'Φινλανδία',         flag: '\u{1F1EB}\u{1F1EE}', artist: 'Linda Lampenius & Pete Parkkonen', song: 'Liekinheitin',           language: 'Finnish',               semi: 1, runningOrder: 7 },
  { id: 'ME', name: 'Montenegro',      name_el: 'Μαυροβούνιο',       flag: '\u{1F1F2}\u{1F1EA}', artist: 'Tamara Živković',                  song: 'Nova zora',              language: 'Montenegrin',           semi: 1, runningOrder: 8 },
  { id: 'EE', name: 'Estonia',         name_el: 'Εσθονία',           flag: '\u{1F1EA}\u{1F1EA}', artist: 'Vanilla Ninja',                    song: 'Too Epic to Be True',    language: 'English',               semi: 1, runningOrder: 9 },
  { id: 'IL', name: 'Israel',          name_el: 'Ισραήλ',            flag: '\u{1F1EE}\u{1F1F1}', artist: 'Noam Bettan',                      song: 'Michelle',               language: 'French, Hebrew, English', semi: 1, runningOrder: 10 },
  { id: 'BE', name: 'Belgium',         name_el: 'Βέλγιο',            flag: '\u{1F1E7}\u{1F1EA}', artist: 'Essyla',                           song: 'Dancing on the Ice',     language: 'English',               semi: 1, runningOrder: 11 },
  { id: 'LT', name: 'Lithuania',       name_el: 'Λιθουανία',         flag: '\u{1F1F1}\u{1F1F9}', artist: 'Lion Ceccah',                      song: 'Sólo quiero más',        language: 'Lithuanian, English',   semi: 1, runningOrder: 12 },
  { id: 'SM', name: 'San Marino',      name_el: 'Άγιος Μαρίνος',     flag: '\u{1F1F8}\u{1F1F2}', artist: 'Senhit',                           song: 'Superstar',              language: 'English',               semi: 1, runningOrder: 13 },
  { id: 'PL', name: 'Poland',          name_el: 'Πολωνία',           flag: '\u{1F1F5}\u{1F1F1}', artist: 'Alicja',                           song: 'Pray',                   language: 'English',               semi: 1, runningOrder: 14 },
  { id: 'RS', name: 'Serbia',          name_el: 'Σερβία',            flag: '\u{1F1F7}\u{1F1F8}', artist: 'Lavina',                           song: 'Kraj mene',              language: 'Serbian',               semi: 1, runningOrder: 15 },
  { id: 'AL', name: 'Albania',         name_el: 'Αλβανία',           flag: '\u{1F1E6}\u{1F1F1}', artist: 'Alis',                             song: 'Nân',                    language: 'Albanian',              semi: 1 },
  { id: 'AU', name: 'Australia',       name_el: 'Αυστραλία',         flag: '\u{1F1E6}\u{1F1FA}', artist: 'Delta Goodrem',                    song: 'Eclipse',                language: 'English',               semi: 1 },
  { id: 'DK', name: 'Denmark',         name_el: 'Δανία',             flag: '\u{1F1E9}\u{1F1F0}', artist: 'Søren Torpegaard Lund',            song: 'Før vi går hjem',        language: 'Danish',                semi: 1 },
  { id: 'NO', name: 'Norway',          name_el: 'Νορβηγία',          flag: '\u{1F1F3}\u{1F1F4}', artist: 'Jonas Lovv',                       song: 'Ya Ya Ya',               language: 'English',               semi: 1 },
  { id: 'CH', name: 'Switzerland',     name_el: 'Ελβετία',           flag: '\u{1F1E8}\u{1F1ED}', artist: 'Veronica Fusaro',                  song: 'Alice',                  language: 'English',               semi: 1 },

  // --- Semi-Final 2 ---
  { id: 'BG', name: 'Bulgaria',        name_el: 'Βουλγαρία',         flag: '\u{1F1E7}\u{1F1EC}', artist: 'Dara',                             song: 'Bangaranga',             language: 'English',               semi: 2, runningOrder: 1 },
  { id: 'AZ', name: 'Azerbaijan',      name_el: 'Αζερμπαϊτζάν',      flag: '\u{1F1E6}\u{1F1FF}', artist: 'Jiva',                             song: 'Just Go',                language: 'English, Azerbaijani',  semi: 2, runningOrder: 2 },
  { id: 'RO', name: 'Romania',         name_el: 'Ρουμανία',          flag: '\u{1F1F7}\u{1F1F4}', artist: 'Alexandra Căpitănescu',            song: 'Choke Me',               language: 'English',               semi: 2, runningOrder: 3 },
  { id: 'LU', name: 'Luxembourg',      name_el: 'Λουξεμβούργο',      flag: '\u{1F1F1}\u{1F1FA}', artist: 'Eva Marija',                       song: 'Mother Nature',          language: 'English',               semi: 2, runningOrder: 4 },
  { id: 'CZ', name: 'Czechia',         name_el: 'Τσεχία',            flag: '\u{1F1E8}\u{1F1FF}', artist: 'Daniel Zizka',                     song: 'Crossroads',             language: 'English',               semi: 2, runningOrder: 5 },
  { id: 'AM', name: 'Armenia',         name_el: 'Αρμενία',           flag: '\u{1F1E6}\u{1F1F2}', artist: 'Simón',                            song: 'Paloma Rumba',           language: 'English',               semi: 2, runningOrder: 6 },
  { id: 'CY', name: 'Cyprus',          name_el: 'Κύπρος',            flag: '\u{1F1E8}\u{1F1FE}', artist: 'Antigoni',                         song: 'Jalla',                  language: 'English, Greek',        semi: 2 },
  { id: 'GR', name: 'Greece',          name_el: 'Ελλάδα',            flag: '\u{1F1EC}\u{1F1F7}', artist: 'Akylas',                           song: 'Ferto',                  language: 'Greek',                 semi: 2 },
  { id: 'LV', name: 'Latvia',          name_el: 'Λετονία',           flag: '\u{1F1F1}\u{1F1FB}', artist: 'Atvara',                           song: 'Ēnā',                    language: 'Latvian',               semi: 2 },
  { id: 'MT', name: 'Malta',           name_el: 'Μάλτα',             flag: '\u{1F1F2}\u{1F1F9}', artist: 'Aidan',                            song: 'Bella',                  language: 'English, Maltese',      semi: 2 },
  { id: 'UA', name: 'Ukraine',         name_el: 'Ουκρανία',          flag: '\u{1F1FA}\u{1F1E6}', artist: 'Leléka',                           song: 'Ridnym',                 language: 'English, Ukrainian',    semi: 2 },

  // --- Big Four (auto-qualifiers; Spain boycotting, so 4 instead of 5) ---
  { id: 'FR', name: 'France',          name_el: 'Γαλλία',            flag: '\u{1F1EB}\u{1F1F7}', artist: 'Monroe',                           song: 'Regarde !',              language: 'French',                semi: 'big5' },
  { id: 'DE', name: 'Germany',         name_el: 'Γερμανία',          flag: '\u{1F1E9}\u{1F1EA}', artist: 'Sarah Engels',                     song: 'Fire',                   language: 'English',               semi: 'big5' },
  { id: 'IT', name: 'Italy',           name_el: 'Ιταλία',            flag: '\u{1F1EE}\u{1F1F9}', artist: 'Sal Da Vinci',                     song: 'Per sempre sì',          language: 'Italian',               semi: 'big5' },
  { id: 'GB', name: 'United Kingdom',  name_el: 'Ηνωμένο Βασίλειο', flag: '\u{1F1EC}\u{1F1E7}', artist: 'Look Mum No Computer',             song: 'Eins, Zwei, Drei',       language: 'English',               semi: 'big5' },

  // --- Host (Austria, winner of 2025) ---
  { id: 'AT', name: 'Austria',         name_el: 'Αυστρία',           flag: '\u{1F1E6}\u{1F1F9}', artist: 'Cosmó',                            song: 'Tanzschein',             language: 'German',                semi: 'host' },
]

/** Lookup map by country ISO code */
export const COUNTRY_MAP = new Map(COUNTRIES_2026.map((c) => [c.id, c]))

/** Countries that have withdrawn from / are boycotting Eurovision 2026. */
export const BOYCOTTING_2026 = ['Iceland', 'Ireland', 'Netherlands', 'Slovenia', 'Spain'] as const

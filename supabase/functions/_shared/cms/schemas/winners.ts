// /winners. Mirrors the former WinnersCopy interface. Its template functions
// took values from contests/index.json (the winners tables and leaderboard
// stay data, in code); they are now placeholders the page fills:
//   {last}      the latest completed year
//   {from}/{to} the oldest/newest year of the recent table; {from} in
//               sections.all.title is the first contest year
//   {cancelled} a cancelled year inside the recent window: introCancelled is
//               appended to intro only then
import type { z } from 'zod';
import { group, list, text } from '../fields.ts';
import { cta, qa, relatedItem, strongRest } from './common.ts';

const LAST = { placeholders: ['last'] };

export const winnersSchema = group({
  meta: group({
    title: text(),
    description: text(LAST),
    keywords: list(text(LAST)),
    schemaTitle: text(),
    schemaDescription: text(),
  }),
  crumbs: group({ home: text(), history: text(), winners: text() }),
  hero: group({ chip: text(), title: text(), lede: text() }),
  sections: group({
    recent: group({
      title: text({ placeholders: ['from', 'to'] }),
      intro: text({ placeholders: ['from'] }),
      introCancelled: text({ placeholders: ['cancelled'], help: 'Appended to intro when a cancelled year falls in the table' }),
      headers: group({ year: text(), country: text(), artist: text(), song: text(), points: text() }),
    }),
    leaderboard: group({
      title: text(),
      intro: text(),
      headers: group({ country: text(), wins: text(), mostRecent: text() }),
    }),
    all: group({ title: text({ placeholders: ['from'] }), intro: text(), cancelled: text(), shared: text() }),
    notable: group({ title: text(), intro: text(), bullets: list(strongRest) }),
    faqTitle: text(),
  }),
  faq: list(qa),
  cta,
  related: group({ heading: text(), items: list(relatedItem) }),
});

export type WinnersContent = z.infer<typeof winnersSchema>;

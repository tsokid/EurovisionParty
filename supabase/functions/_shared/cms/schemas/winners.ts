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
import { cta, HERO_LABEL, META_LABEL, metaDescription, qa, relatedItem, seoTitle, strongRest } from './common.ts';

const HELP = {
  last: 'The latest contest year with a winner, e.g. 2025',
  from: 'The oldest year in the recent-winners table',
  to: 'The newest year in the recent-winners table',
  cancelled: 'The cancelled contest year inside the recent-winners table, e.g. 2020',
};

const LAST = { placeholders: ['last'], placeholderHelp: { last: HELP.last } };

export const winnersSchema = group({
  meta: group({
    title: seoTitle(),
    description: metaDescription(LAST),
    keywords: list(text(LAST)),
    schemaTitle: seoTitle({ label: 'Schema title', seo: false }),
    schemaDescription: metaDescription({ label: 'Schema description', seo: false }),
  }, META_LABEL),
  crumbs: group({ home: text(), history: text(), winners: text() }),
  hero: group({ chip: text(), title: text(), lede: text() }, HERO_LABEL),
  sections: group({
    recent: group({
      title: text({ placeholders: ['from', 'to'], placeholderHelp: { from: HELP.from, to: HELP.to } }),
      intro: text({ placeholders: ['from'], placeholderHelp: { from: HELP.from } }),
      introCancelled: text({ placeholders: ['cancelled'], placeholderHelp: { cancelled: HELP.cancelled }, help: 'Appended to intro when a cancelled year falls in the table' }),
      headers: group({ year: text(), country: text(), artist: text(), song: text(), points: text() }),
    }),
    leaderboard: group({
      title: text(),
      intro: text(),
      headers: group({ country: text(), wins: text(), mostRecent: text() }),
    }),
    all: group({ title: text({ placeholders: ['from'], placeholderHelp: { from: 'The first contest year, 1956' } }), intro: text(), cancelled: text(), shared: text() }),
    notable: group({ title: text(), intro: text(), bullets: list(strongRest) }),
    faqTitle: text(),
  }),
  faq: list(qa),
  cta,
  related: group({ heading: text(), items: list(relatedItem) }),
});

export type WinnersContent = z.infer<typeof winnersSchema>;

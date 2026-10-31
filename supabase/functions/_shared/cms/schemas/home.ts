// The home page's SEO copy: its meta (formerly homeCopy.ts) and the text of
// HomeSeoBlock (formerly the i18n homeSeo keys). The game UI above it stays
// in i18n. The live contest's year is a placeholder.
import type { z } from 'zod';
import { group, text } from '../fields.ts';

const YEAR = { placeholders: ['year'] };

export const homeSchema = group({
  meta: group({ title: text(YEAR), description: text(YEAR) }),
  seo: group({
    headline: text(),
    leadStrong: text(),
    leadRest: text(YEAR),
    primaryHeading: text(),
    secondaryHeading: text(),
    tail: text(),
    tailLink: text(),
    cards: group({
      nightTitle: text(),
      nightDesc: text(),
      predictionsTitle: text(),
      predictionsDesc: text(),
      triviaTitle: text(),
      triviaDesc: text(),
      partyTitle: text(),
      partyDesc: text(),
      gamesTitle: text(),
      gamesDesc: text(),
      howTitle: text(),
      howDesc: text(),
    }),
  }),
});

export type HomeContent = z.infer<typeof homeSchema>;

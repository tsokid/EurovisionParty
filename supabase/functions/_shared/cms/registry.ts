// CMS document types (spec §3 "Files", "Schemas").
//
// Static pages use their SEO-registry pageId as both docId and doc type
// (faq -> faq). Editorial layers (3c) are families keyed by prefix, all with
// one schema: archive-{year} -> archive-editorial, country-{iso} ->
// country-editorial, hub-{year} -> hub-editorial (pagesIndex.ts).
import type { z } from 'zod';
import { aboutSchema } from './schemas/about.ts';
import { cookiesSchema } from './schemas/cookies.ts';
import { dashboardSchema } from './schemas/dashboard.ts';
import { eurovisionDuelsSchema } from './schemas/eurovision-duels.ts';
import { eurovisionGamesSchema } from './schemas/eurovision-games.ts';
import { eurovisionNightSchema } from './schemas/eurovision-night.ts';
import { eurovisionPartySchema } from './schemas/eurovision-party.ts';
import { eurovisionPredictionsSchema } from './schemas/eurovision-predictions.ts';
import { eurovisionTriviaSchema } from './schemas/eurovision-trivia.ts';
import { faqSchema } from './schemas/faq.ts';
import { homeSchema } from './schemas/home.ts';
import { howToPlaySchema } from './schemas/how-to-play.ts';
import { notFoundSchema } from './schemas/not-found.ts';
import { privacySchema } from './schemas/privacy.ts';
import { rulesSchema } from './schemas/rules.ts';
import { scoringSchema } from './schemas/scoring.ts';
import { termsSchema } from './schemas/terms.ts';
import { winnersSchema } from './schemas/winners.ts';
import { editorialSchema } from './schemas/editorial.ts';
import { editorialFamily } from './pagesIndex.ts';

export type DocTypeGroup = 'site' | 'contest' | 'country' | 'hub';

export type DocTypeDef = {
  /** Schema of one locale's content (the document is { en: T, el: T }). */
  schema: z.ZodType;
  label: string;
  group: DocTypeGroup;
};

export const CMS_DOC_TYPES: Record<string, DocTypeDef> = {
  about: { schema: aboutSchema, label: 'About', group: 'site' },
  privacy: { schema: privacySchema, label: 'Privacy policy', group: 'site' },
  terms: { schema: termsSchema, label: 'Terms of use', group: 'site' },
  cookies: { schema: cookiesSchema, label: 'Cookies & consent', group: 'site' },
  dashboard: { schema: dashboardSchema, label: 'Dashboard guide', group: 'site' },
  scoring: { schema: scoringSchema, label: 'Scoring', group: 'site' },
  rules: { schema: rulesSchema, label: 'Rules', group: 'site' },
  faq: { schema: faqSchema, label: 'FAQ', group: 'site' },
  'how-to-play': { schema: howToPlaySchema, label: 'How to play', group: 'site' },
  'eurovision-night': { schema: eurovisionNightSchema, label: 'Eurovision night', group: 'site' },
  'eurovision-games': { schema: eurovisionGamesSchema, label: 'Eurovision Games', group: 'site' },
  'eurovision-party': { schema: eurovisionPartySchema, label: 'Eurovision party', group: 'site' },
  'eurovision-trivia': { schema: eurovisionTriviaSchema, label: 'Eurovision trivia', group: 'site' },
  'eurovision-duels': { schema: eurovisionDuelsSchema, label: 'Duels', group: 'site' },
  home: { schema: homeSchema, label: 'Home page (SEO copy)', group: 'site' },
  'not-found': { schema: notFoundSchema, label: 'Page not found (404)', group: 'site' },
  'eurovision-predictions': { schema: eurovisionPredictionsSchema, label: 'Predictions game', group: 'site' },
  winners: { schema: winnersSchema, label: 'Winners', group: 'site' },
  'archive-editorial': { schema: editorialSchema, label: 'Contest year editorial', group: 'contest' },
  'country-editorial': { schema: editorialSchema, label: 'Country editorial', group: 'country' },
  'hub-editorial': { schema: editorialSchema, label: 'Live hub editorial', group: 'hub' },
};

/** Doc type of a document id: {family}-editorial for an editorial id, else the id itself. */
export function docTypeFor(docId: string): string {
  const family = editorialFamily(docId);
  return family ? `${family}-editorial` : docId;
}

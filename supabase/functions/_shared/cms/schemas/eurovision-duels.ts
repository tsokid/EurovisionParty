// /duels (pageId eurovision-duels). Mirrors the former DuelsCopy interface.
import type { z } from 'zod';
import { group, list, text } from '../fields.ts';
import { cta, hero, howToStep, META_LABEL, metaDescription, qa, seoTitle, strongRest, titleBlurb } from './common.ts';

export const eurovisionDuelsSchema = group({
  meta: group({
    title: seoTitle(),
    description: metaDescription(),
    schemaTitle: seoTitle({ label: 'Schema title', seo: false }),
    schemaDescription: metaDescription({ label: 'Schema description', seo: false }),
    howToName: text(),
    howToDescription: text(),
    keywords: list(text()),
  }, META_LABEL),
  crumbs: group({ home: text(), duels: text() }),
  hero,
  sections: group({
    whatIs: group({ title: text(), bodyPre: text(), bodyEm: text(), bodyPost: text(), bullets: list(strongRest) }),
    when: group({
      title: text(),
      body1Pre: text(),
      body1Strong1: text(),
      body1Mid: text(),
      body1Strong2: text(),
      body1Post: text(),
      ruleOfThumbStrong: text(),
      ruleOfThumbBody: text(),
    }),
    scoring: group({
      title: text(),
      intro: text(),
      headers: group({ scenario: text(), points: text() }),
      rows: group({ zeroToOne: text(), five: text(), eleven: text(), wrong: text(), winBonus: text() }),
      winnerScorePre: text(),
      winnerScoreEm: text(),
      winnerScorePost: text(),
      stealLabel: text(),
      stealBodyPre: text(),
      stealBodyEm: text(),
      stealBodyPost: text(),
      doubleLabel: text(),
      doubleBodyPre: text(),
      doubleBodyEm: text(),
      doubleBodyPost: text(),
    }),
    stealVsDouble: group({
      title: text(),
      stealHeading: text(),
      stealBody: text(),
      doubleHeading: text(),
      doubleBodyPre: text(),
      doubleBodyEm: text(),
      doubleBodyPost: text(),
    }),
    trophies: group({
      title: text(),
      intro: text(),
      duelistLabel: text(),
      duelistBody: text(),
      thiefLabel: text(),
      thiefBody: text(),
      seePre: text(),
      scoringLink: text(),
      seeMid: text(),
      rulesLink: text(),
      seePost: text(),
    }),
    faqTitle: text(),
  }),
  cta,
  related: group({
    trivia: titleBlurb,
    scoring: titleBlurb,
    predictions: titleBlurb,
    howToPlay: titleBlurb,
    rules: titleBlurb,
    leave: titleBlurb,
  }),
  howToSteps: list(howToStep),
  faq: list(qa),
});

export type EurovisionDuelsContent = z.infer<typeof eurovisionDuelsSchema>;

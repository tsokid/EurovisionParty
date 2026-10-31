// /eurovision-trivia. Mirrors the former TriviaCopy interface. The sample
// questions are the page's own editorial sampler, not the game's question bank.
import type { z } from 'zod';
import { group, list, text } from '../fields.ts';
import { cta, hero, META_LABEL, metaDescription, qa, seoTitle, titleBlurb, titleBody } from './common.ts';

export const eurovisionTriviaSchema = group({
  meta: group({
    title: seoTitle(),
    description: metaDescription(),
    schemaTitle: seoTitle({ label: 'Schema title' }),
    schemaDescription: metaDescription({ label: 'Schema description' }),
    quizName: text(),
    quizAbout: text(),
    keywords: list(text()),
  }, META_LABEL),
  crumbs: group({ home: text(), trivia: text() }),
  hero,
  sections: group({
    whatIs: titleBody,
    samples: group({ title: text(), intro: text(), questionPrefix: text(), answerLabel: text() }),
    categories: group({
      title: text(),
      easyLabel: text(),
      easyBody: text(),
      mediumLabel: text(),
      mediumBody: text(),
      hardLabel: text(),
      hardBody: text(),
    }),
    duels: group({
      title: text(),
      body1Pre: text(),
      body1Em: text(),
      body1Post: text(),
      body2Pre: text(),
      body2LinkLabel: text(),
      body2Post: text(),
    }),
    play: group({ title: text(), pre: text(), linkLabel: text(), post: text() }),
    faqTitle: text(),
    disclaimer: text(),
  }),
  cta,
  related: group({
    duels: titleBlurb,
    predictions: titleBlurb,
    howToPlay: titleBlurb,
    scoring: titleBlurb,
    rules: titleBlurb,
    night: titleBlurb,
  }),
  questions: list(group({ q: text(), options: list(text()), answer: text() })),
  faq: list(qa),
});

export type EurovisionTriviaContent = z.infer<typeof eurovisionTriviaSchema>;

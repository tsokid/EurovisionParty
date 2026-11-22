// /eurovision-games. Mirrors the former EurovisionGamesCopy interface; the
// live contest's year is the {year} placeholder.
import type { z } from 'zod';
import { group, list, text } from '../fields.ts';
import { crumbs, cta, headers3, hero, href, META_LABEL, metaDescription, qa, relatedItem, seoTitle, strongRest, pageLayout } from './common.ts';

const YEAR = { placeholders: ['year'] };

/** A paragraph, then a second one with a link in the middle. */
const linkedSection = (p1 = text()) => group({ title: text(), p1, p2Before: text(), p2Link: text(), p2After: text() });

export const eurovisionGamesSchema = group({
  meta: group({
    title: seoTitle(YEAR),
    description: metaDescription(),
    headline: text(YEAR),
    articleDescription: text(),
    keywords: list(text()),
  }, META_LABEL),
  crumbs,
  hero,
  sections: group({
    inside: group({
      title: text(),
      intro: text(),
      tableHeaders: headers3,
      rows: list(group({ game: text(), when: text(), scoring: text(), href: href() })),
    }),
    predictions: linkedSection(text(YEAR)),
    quiz: linkedSection(),
    duels: group({
      title: text(),
      p1Pre: text(),
      steal: text(),
      p1Mid: text(),
      double: text(),
      p1Post: text(),
      p2Before: text(),
      p2Link: text(),
      p2After: text(),
    }),
    dashboard: linkedSection(),
    trophies: group({ title: text(), intro: text(), bullets: list(strongRest) }),
    free: group({ title: text(), intro: text(), bullets: list(strongRest) }),
    faq: group({ title: text() }),
  }),
  faq: list(qa),
  cta,
  related: group({ heading: text(), items: list(relatedItem) }),
  layout: pageLayout([
    { key: 'inside', title: 'sections.inside.title', fields: ['sections.inside'] },
    { key: 'predictions', title: 'sections.predictions.title', fields: ['sections.predictions'] },
    { key: 'quiz', title: 'sections.quiz.title', fields: ['sections.quiz'] },
    { key: 'duels', title: 'sections.duels.title', fields: ['sections.duels'] },
    { key: 'dashboard', title: 'sections.dashboard.title', fields: ['sections.dashboard'] },
    { key: 'trophies', title: 'sections.trophies.title', fields: ['sections.trophies'] },
    { key: 'free', title: 'sections.free.title', fields: ['sections.free'] },
    { key: 'faq', title: 'sections.faq.title', fields: ['sections.faq', 'faq'], locked: true },
  ]),
});

export type EurovisionGamesContent = z.infer<typeof eurovisionGamesSchema>;

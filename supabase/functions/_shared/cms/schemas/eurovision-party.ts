// /eurovision-party. Mirrors the former EurovisionPartyCopy interface; the
// live contest's year and final date are placeholders.
import type { z } from 'zod';
import { group, list, optional, text, tuple } from '../fields.ts';
import { crumbs, cta, headers3, hero, href, META_LABEL, metaDescription, qa, relatedItem, seoTitle, strongRest, titleBody } from './common.ts';

const YEAR = { placeholders: ['year'] };

export const eurovisionPartySchema = group({
  meta: group({
    title: seoTitle(YEAR),
    description: metaDescription(YEAR),
    headline: text(YEAR),
    articleDescription: text(YEAR),
    eventName: text(YEAR),
    eventDescription: text({ placeholders: ['year', 'finalDayShort'] }),
    keywords: list(text()),
  }, META_LABEL),
  crumbs,
  hero,
  sections: group({
    what: group({
      title: text(),
      intro: text(),
      b1: text(),
      b1Suffix: text(),
      b2: text(),
      b2Suffix: text(),
      b3: text(),
      outro: text(),
    }),
    headcount: group({
      title: text(),
      bullets: list(
        group({
          strong: text(),
          rest: text(),
          // A link to the Dashboard after rest.
          link: optional(group({ before: text({ required: false }), label: text(), after: text() })),
        }),
      ),
    }),
    theme: group({ title: text(), bullets: list(strongRest) }),
    food: group({ title: text(), intro: text(), bullets: list(strongRest), drinks: text() }),
    runOfShow: group({
      title: text(),
      intro: text(),
      tableHeaders: headers3,
      rows: list(tuple([text(), text(), text()])),
    }),
    games: group({
      title: text(),
      introBefore: text({ required: false }),
      introLink: text(),
      introAfter: text(),
      bullets: list(group({ label: text(), href: href(), rest: text() })),
    }),
    timezone: titleBody,
    faq: group({ title: text() }),
  }),
  faq: list(qa),
  cta,
  related: group({ heading: text(), items: list(relatedItem) }),
});

export type EurovisionPartyContent = z.infer<typeof eurovisionPartySchema>;

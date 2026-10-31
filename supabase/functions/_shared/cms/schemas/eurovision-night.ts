// /eurovision-night. Mirrors the former EurovisionNightCopy interface. That
// copy was a function of the live contest's texts: the parts it templated are
// now placeholders, filled from contestTexts() by the page.
import type { z } from 'zod';
import { group, list, optional, text } from '../fields.ts';
import { crumbs, cta, hero, href, howToStep, strongRest, titleBody } from './common.ts';

const YEAR = { placeholders: ['year'] };

export const eurovisionNightSchema = group({
  meta: group({
    title: text(YEAR),
    description: text(),
    headline: text(),
    articleDescription: text(),
    keywords: list(text(YEAR)),
  }),
  crumbs,
  hero,
  sections: group({
    what: group({
      title: text(),
      bodyBefore: text(YEAR),
      bodyDate: text({ placeholders: ['finalDay'], help: 'Shown bold: the date of the final' }),
      bodyAfter: text({ placeholders: ['cityFrom'] }),
    }),
    playbook: group({
      title: text(),
      steps: list(
        group({
          boldHead: text(),
          rest: text(YEAR),
          // A link rendered after rest, then restAfter; href and linkLabel come together.
          href: optional(href()),
          linkLabel: optional(text()),
          restAfter: optional(text()),
        }),
      ),
    }),
    food: titleBody,
    timezones: titleBody,
    inRoomGames: group({ title: text(), bullets: list(strongRest) }),
    faq: group({ title: text() }),
  }),
  faq: list(group({ q: text(YEAR), a: text({ placeholders: ['finalDay', 'cityFrom'] }) })),
  howTo: group({ name: text(), steps: list(howToStep) }),
  cta,
  related: group({
    heading: text(),
    items: list(group({ href: href(), title: text(), blurb: text({ placeholders: ['city'] }) })),
  }),
});

export type EurovisionNightContent = z.infer<typeof eurovisionNightSchema>;

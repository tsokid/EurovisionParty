// /about. Mirrors the former AboutCopy interface.
import type { z } from 'zod';
import { group, list, optional, text } from '../fields.ts';
import { boldRest, hero, relatedItem, titleBody } from './common.ts';

export const aboutSchema = group({
  meta: group({
    title: text(),
    description: text(),
    organizationDescription: text(),
    aboutPageDescription: text(),
    keywords: list(text()),
  }),
  hero,
  breadcrumbs: group({ home: text(), about: text() }),
  whatIs: group({
    title: text(),
    parts: group({
      lead: text(),
      predictionsBold: text(),
      mid1: text(),
      triviaBold: text(),
      mid2: text(),
      trophiesBold: text(),
      tail: text(),
    }),
  }),
  why: group({ title: text(), body: text(), cardTitle: text(), items: list(boldRest) }),
  whatsIn: group({
    title: text(),
    items: list(
      group({
        bold: text(),
        lead: text(),
        // A link rendered between lead and tail; both or neither.
        linkLabel: optional(text()),
        linkHref: optional(text({ shared: true })),
        tail: text({ required: false }),
      }),
    ),
  }),
  freeNoAccount: titleBody,
  ebu: group({ title: text(), cardTitle: text(), body: text() }),
  builtBy: group({
    title: text(),
    lead: text(),
    helloEmail: text(),
    mid: text(),
    pressEmail: text(),
    tail: text(),
  }),
  cta: group({ title: text(), body: text(), primaryLabel: text(), secondaryLabel: text() }),
  related: list(relatedItem),
});

export type AboutContent = z.infer<typeof aboutSchema>;

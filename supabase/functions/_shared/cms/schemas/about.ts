// /about. Mirrors the former AboutCopy interface.
import type { z } from 'zod';
import { group, list, optional, text } from '../fields.ts';
import { boldRest, CTA_LABEL, hero, href, META_LABEL, metaDescription, relatedItem, seoTitle, titleBody, extraBlocks } from './common.ts';

export const aboutSchema = group({
  meta: group({
    title: seoTitle(),
    description: metaDescription(),
    organizationDescription: text(),
    aboutPageDescription: text(),
    keywords: list(text()),
  }, META_LABEL),
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
        linkHref: optional(href()),
        tail: text({ required: false }),
      }, { pairs: [['linkLabel', 'linkHref']] }),
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
  cta: group({ title: text(), body: text(), primaryLabel: text(), secondaryLabel: text() }, CTA_LABEL),
  related: list(relatedItem),
  extraBlocks,
});

export type AboutContent = z.infer<typeof aboutSchema>;

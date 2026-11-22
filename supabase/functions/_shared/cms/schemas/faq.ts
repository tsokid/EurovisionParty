// /faq. Mirrors the former FaqCopy interface.
import type { z } from 'zod';
import { choice, group, list, optional, text } from '../fields.ts';
import { articleSchema, basicMeta, crumbs, cta, hero, relatedItem, strongRest, strongRestHtml, extraBlocks } from './common.ts';

/** The FAQ page groups the accordion questions under these topics (labels in i18n faqPage.topics). */
export const FAQ_TOPICS = ['start', 'devices', 'during', 'scoring', 'results'] as const;
export type FaqTopic = (typeof FAQ_TOPICS)[number];

/** In sorted order, so a sorted list of ids compares position by position. */
const ANCHOR_IDS = ['create', 'join', 'leave'] as const;

// The three anchored questions: their ids are URL fragments (/faq#leave) and
// the page sections look them up, so there is exactly one of each.
const anchored = list(
  group({
    id: choice(ANCHOR_IDS, { help: 'URL anchor; do not change' }),
    q: text(),
    a: text(),
  }),
).superRefine((items, ctx) => {
  const ids = items.map((i) => i.id).sort();
  if (ids.length !== ANCHOR_IDS.length || ids.some((id, i) => id !== ANCHOR_IDS[i])) {
    ctx.addIssue({ code: 'custom', message: `Anchored ids must be exactly ${ANCHOR_IDS.join(', ')}, each once (got ${ids.join(', ') || 'none'})` });
  }
});

export const faqSchema = group({
  meta: basicMeta,
  schema: articleSchema,
  hero,
  anchored,
  createSection: group({ title: text(), cardTitle: text(), bullets: list(strongRest) }),
  joinSection: group({ title: text(), bullets: list(strongRestHtml) }),
  leaveSection: group({ title: text(), bullets: list(strongRestHtml) }),
  moreTitle: text(),
  more: list(group({
    q: text(),
    a: text(),
    // Missing: the question shows under the first topic.
    topic: optional(choice(FAQ_TOPICS, { help: 'Topic the question is listed under on the page' })),
  })),
  cta,
  related: group({ items: list(relatedItem) }),
  crumbs,
  extraBlocks,
});

export type FaqContent = z.infer<typeof faqSchema>;

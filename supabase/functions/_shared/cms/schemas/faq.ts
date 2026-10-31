// /faq. Mirrors the former FaqCopy interface.
import type { z } from 'zod';
import { choice, group, list, text } from '../fields.ts';
import { articleSchema, basicMeta, crumbs, cta, hero, qa, relatedItem, strongRest, strongRestHtml } from './common.ts';

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
  more: list(qa),
  cta,
  related: group({ items: list(relatedItem) }),
  crumbs,
});

export type FaqContent = z.infer<typeof faqSchema>;

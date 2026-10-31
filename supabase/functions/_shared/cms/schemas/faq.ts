// /faq. Mirrors the former FaqCopy interface.
import type { z } from 'zod';
import { choice, group, list, text } from '../fields.ts';
import { articleSchema, basicMeta, crumbs, cta, hero, qa, relatedItem, strongRest } from './common.ts';

export const faqSchema = group({
  meta: basicMeta,
  schema: articleSchema,
  hero,
  // The three anchored questions: their ids are URL fragments and must stay create/join/leave.
  anchored: list(
    group({
      id: choice(['create', 'join', 'leave'], { help: 'URL anchor; do not change' }),
      q: text(),
      a: text(),
    }),
  ),
  createSection: group({ title: text(), cardTitle: text(), bullets: list(strongRest) }),
  joinSection: group({ title: text(), bullets: list(strongRest) }),
  leaveSection: group({ title: text(), bullets: list(strongRest) }),
  moreTitle: text(),
  more: list(qa),
  cta,
  related: group({ items: list(relatedItem) }),
  crumbs,
});

export type FaqContent = z.infer<typeof faqSchema>;

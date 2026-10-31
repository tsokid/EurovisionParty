// /scoring. Mirrors the former ScoringCopy interface.
import type { z } from 'zod';
import { choice, group, list, text } from '../fields.ts';
import { articleSchema, basicMeta, crumbs, cta, headers2, hero, relatedItem, strongRest } from './common.ts';

const scoreRow = group({
  label: text(),
  value: text(),
  tone: choice(['strong', 'muted', 'pinkBonus'], { help: 'How the value cell is styled' }),
});

const scoreTable = group({
  title: text(),
  intro: text(),
  headers: headers2,
  rows: list(scoreRow),
  note: text(),
});

export const scoringSchema = group({
  meta: basicMeta,
  schema: articleSchema,
  hero,
  quiz: scoreTable,
  top5: scoreTable,
  worst5: scoreTable,
  duel: group({
    title: text(),
    intro: text(),
    headers: headers2,
    rows: list(scoreRow),
    body: text({ help: 'HTML: may contain <strong> and <em>' }),
  }),
  stealDouble: group({
    title: text(),
    intro: text(),
    stealTitle: text(),
    stealBody: text({ help: 'HTML' }),
    doubleTitle: text(),
    doubleBody: text({ help: 'HTML' }),
    note: text({ help: 'HTML: may contain <em>' }),
  }),
  penalties: group({ title: text(), items: list(strongRest) }),
  example: group({ title: text(), intro: text(), items: list(strongRest) }),
  cta,
  related: group({ items: list(relatedItem) }),
  crumbs,
});

export type ScoringContent = z.infer<typeof scoringSchema>;

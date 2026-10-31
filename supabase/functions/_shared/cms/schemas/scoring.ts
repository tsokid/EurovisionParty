// /scoring. Mirrors the former ScoringCopy interface.
import type { z } from 'zod';
import { choice, group, list, text } from '../fields.ts';
import { articleSchema, basicMeta, crumbs, cta, headers2, hero, relatedItem, strongRestHtml } from './common.ts';

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
  note: text({ rawHtml: true, help: 'HTML' }),
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
    body: text({ rawHtml: true, help: 'HTML: may contain <strong> and <em>' }),
  }),
  stealDouble: group({
    title: text(),
    intro: text(),
    stealTitle: text(),
    stealBody: text({ rawHtml: true, help: 'HTML' }),
    doubleTitle: text(),
    doubleBody: text({ rawHtml: true, help: 'HTML' }),
    note: text({ rawHtml: true, help: 'HTML: may contain <em>' }),
  }),
  penalties: group({ title: text(), items: list(strongRestHtml) }),
  example: group({ title: text(), intro: text(), items: list(strongRestHtml) }),
  cta,
  related: group({ items: list(relatedItem) }),
  crumbs,
});

export type ScoringContent = z.infer<typeof scoringSchema>;

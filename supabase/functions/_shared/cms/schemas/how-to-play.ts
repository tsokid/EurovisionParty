// /how-to-play. Mirrors the former HowToPlayCopy interface.
import type { z } from 'zod';
import { group, list, text } from '../fields.ts';
import { basicMeta, crumbs, cta, hero, howToStep, relatedItem, strongRest, strongRestHtml, titleBody } from './common.ts';

export const howToPlaySchema = group({
  meta: basicMeta,
  schema: group({
    articleHeadline: text(),
    articleDescription: text(),
    howToName: text(),
    howToDescription: text(),
    steps: list(howToStep),
  }),
  hero,
  setup: group({ title: text(), intro: text(), items: list(strongRestHtml) }),
  predictions: group({ title: text(), intro: text(), items: list(group({ label: text(), body: text() })) }),
  duels: group({
    title: text(),
    intro: text(),
    cardTitle: text(),
    cardBody: text({ rawHtml: true, help: 'HTML: may contain <em> and <strong>' }),
    capLine: text(),
  }),
  scoring: group({ title: text(), intro: text(), items: list(strongRest) }),
  trophies: group({ title: text(), intro: text(), items: list(strongRest), note: text() }),
  suddenDeath: titleBody,
  whatYouNeed: group({ title: text(), items: list(strongRest) }),
  cta,
  related: group({ items: list(relatedItem) }),
  crumbs,
});

export type HowToPlayContent = z.infer<typeof howToPlaySchema>;

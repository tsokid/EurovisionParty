// /rules. Mirrors the former RulesCopy interface. That copy was a function of
// the live contest's texts and used only the year: now the {year} placeholder.
import type { z } from 'zod';
import { group, list, text, tuple } from '../fields.ts';
import { crumbs, cta, headers3, href, hero, strongRest, strongRestHtml } from './common.ts';

const YEAR = { placeholders: ['year'] };

const bullets = group({ title: text(), items: list(strongRest) });

export const rulesSchema = group({
  meta: group({ title: text(YEAR), description: text(), keywords: list(text()) }),
  schema: group({ articleHeadline: text(YEAR), articleDescription: text() }),
  hero,
  hostLimits: bullets,
  phases: group({
    title: text(),
    intro: text(),
    headers: headers3,
    rows: list(tuple([text(), text(), text()])),
  }),
  predictions: bullets,
  quiz: bullets,
  duels: group({ title: text(), items: list(strongRestHtml) }),
  trophies: group({ title: text(), intro: text(), items: list(strongRest), note: text() }),
  suddenDeath: group({ title: text(), body: text(), cardTitle: text(), cardBody: text() }),
  disconnect: bullets,
  edgeCases: bullets,
  cta,
  related: group({ items: list(group({ href: href(), title: text(), blurb: text(YEAR) })) }),
  crumbs,
});

export type RulesContent = z.infer<typeof rulesSchema>;

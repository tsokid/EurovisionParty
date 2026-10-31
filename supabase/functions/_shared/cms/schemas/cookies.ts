// /cookies. Mirrors the former CookiesCopy interface.
import type { z } from 'zod';
import { choice, group, list, optional, text, tuple } from '../fields.ts';
import { boldRest, headers3, hero, legalMeta, relatedItem } from './common.ts';

const tableRow = group({
  category: text(),
  purpose: text(),
  defaultText: text(),
  defaultTone: optional(choice(['muted', 'pink'], { help: 'Colour of the default cell' })),
});

export const cookiesSchema = group({
  meta: legalMeta,
  hero,
  breadcrumbs: group({ home: text(), cookies: text() }),
  whatWeUse: group({
    title: text(),
    intro: text(),
    headers: headers3,
    rows: tuple([tableRow, tableRow]),
  }),
  notUsed: group({ title: text(), items: list(boldRest) }),
  changeConsent: group({
    title: text(),
    intro: group({ lead: text(), emphasis: text(), tail: text() }),
    cardTitle: text(),
    cardBody: text(),
    buttonLabel: text(),
  }),
  whereDataLives: group({
    title: text(),
    intro: group({ lead: text(), linkLabel: text(), tail: text() }),
    items: list(boldRest),
  }),
  banner: group({
    title: text(),
    intro: group({
      lead: text(),
      accept: text(),
      mid1: text(),
      reject: text(),
      mid2: text(),
      manage: text(),
      tail: text(),
    }),
  }),
  related: list(relatedItem),
});

export type CookiesContent = z.infer<typeof cookiesSchema>;

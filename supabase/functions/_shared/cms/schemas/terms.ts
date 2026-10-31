// /terms. Mirrors the former TermsCopy interface.
import type { z } from 'zod';
import { group, list, text } from '../fields.ts';
import { boldRest, hero, legalMeta, relatedItem, titleBody, extraBlocks } from './common.ts';

export const termsSchema = group({
  meta: legalMeta,
  hero,
  breadcrumbs: group({ home: text(), terms: text() }),
  whoWeAre: group({ title: text(), lead: text(), contactTail: text() }),
  free: group({ title: text(), intro: text(), items: list(boldRest) }),
  conduct: group({ title: text(), intro: text(), items: list(boldRest), closer: text() }),
  account: group({
    title: text(),
    intro: text(),
    items: list(boldRest),
    deletionItem: group({ bold: text(), lead: text(), mid: text(), linkLabel: text(), tail: text() }),
  }),
  userContent: group({ title: text(), lead: text(), linkLabel: text(), tail: text() }),
  warranties: group({
    title: text(),
    lead: text(),
    asIs: text(),
    mid: text(),
    asAvailable: text(),
    tail: text(),
  }),
  liability: titleBody,
  ebu: group({ title: text(), cardTitle: text(), body: text(), bodyBold: text(), bodyTail: text() }),
  changes: titleBody,
  contact: group({
    title: text(),
    lead: text(),
    helloEmail: text(),
    mid1: text(),
    privacyEmail: text(),
    mid2: text(),
    legalEmail: text(),
    tail: text(),
  }),
  related: list(relatedItem),
  extraBlocks,
});

export type TermsContent = z.infer<typeof termsSchema>;

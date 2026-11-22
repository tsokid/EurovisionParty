// /privacy. Mirrors the former PrivacyCopy interface.
import type { z } from 'zod';
import { group, list, text } from '../fields.ts';
import { boldRest, headers3, hero, legalMeta, relatedItem, titleBody, pageLayout } from './common.ts';

export const privacySchema = group({
  meta: legalMeta,
  hero,
  breadcrumbs: group({ home: text(), privacy: text() }),
  whatCollect: group({
    title: text(),
    intro: text(),
    headers: headers3,
    rows: list(group({ type: text(), purpose: text(), retention: text() })),
  }),
  notCollect: group({ title: text(), items: list(boldRest) }),
  whoHasAccess: group({ title: text(), intro: text(), items: list(boldRest) }),
  rights: group({
    title: text(),
    intro: text(),
    items: list(boldRest),
    contactLead: text(),
    contactTail: text(),
  }),
  deletion: group({
    title: text(),
    cardTitle: text(),
    cardLead: text(),
    cardTail: text(),
    cardBody: text(),
    note: text(),
  }),
  cookies: group({ title: text(), lead: text(), linkLabel: text(), tail: text() }),
  children: titleBody,
  changes: titleBody,
  contact: group({
    title: text(),
    lead: text(),
    privacyEmail: text(),
    mid: text(),
    generalEmail: text(),
    tail: text(),
  }),
  related: list(relatedItem),
  layout: pageLayout([
    { key: 'whatCollect', title: 'whatCollect.title', fields: ['whatCollect'] },
    { key: 'notCollect', title: 'notCollect.title', fields: ['notCollect'] },
    { key: 'whoHasAccess', title: 'whoHasAccess.title', fields: ['whoHasAccess'] },
    { key: 'rights', title: 'rights.title', fields: ['rights'] },
    { key: 'deletion', title: 'deletion.title', fields: ['deletion'] },
    { key: 'cookies', title: 'cookies.title', fields: ['cookies'] },
    { key: 'children', title: 'children.title', fields: ['children'] },
    { key: 'changes', title: 'changes.title', fields: ['changes'] },
  ]),
});

export type PrivacyContent = z.infer<typeof privacySchema>;

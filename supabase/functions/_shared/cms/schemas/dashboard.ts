// /dashboard. Mirrors the former DashboardCopy interface.
import type { z } from 'zod';
import { flag, group, list, text } from '../fields.ts';
import { crumbs, cta, headers3, hero, qa, relatedItem, strongRest, titleBody } from './common.ts';

export const dashboardSchema = group({
  meta: group({
    title: text(),
    description: text(),
    headline: text(),
    articleDescription: text(),
    keywords: list(text()),
  }),
  crumbs,
  hero,
  sections: group({
    shows: group({ title: text(), intro: text(), bullets: list(strongRest) }),
    sources: group({
      title: text(),
      intro: text(),
      tableHeaders: headers3,
      rows: list(
        group({
          source: text(),
          when: text(),
          capLabel: text({ help: 'A number, or the word for "open" when the cap is open' }),
          capIsOpen: flag({ help: 'The cap is open (shown muted instead of bold)' }),
        }),
      ),
      footer: group({ before: text(), linkLabel: text(), after: text() }),
    }),
    activity: group({ title: text(), bullets: list(strongRest) }),
    notShown: group({ title: text(), intro: text(), bullets: list(strongRest) }),
    hostVsPlayer: titleBody,
    faq: group({ title: text() }),
  }),
  faq: list(qa),
  cta,
  related: group({ heading: text(), items: list(relatedItem) }),
});

export type DashboardContent = z.infer<typeof dashboardSchema>;

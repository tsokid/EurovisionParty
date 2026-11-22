// /dashboard. Mirrors the former DashboardCopy interface.
import type { z } from 'zod';
import { flag, group, list, text } from '../fields.ts';
import { crumbs, cta, headers3, hero, META_LABEL, metaDescription, qa, relatedItem, seoTitle, strongRest, titleBody, pageLayout } from './common.ts';

export const dashboardSchema = group({
  meta: group({
    title: seoTitle(),
    description: metaDescription(),
    headline: text(),
    articleDescription: text(),
    keywords: list(text()),
  }, META_LABEL),
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
  layout: pageLayout([
    { key: 'shows', title: 'sections.shows.title', fields: ['sections.shows'] },
    { key: 'sources', title: 'sections.sources.title', fields: ['sections.sources'] },
    { key: 'activity', title: 'sections.activity.title', fields: ['sections.activity'] },
    { key: 'notShown', title: 'sections.notShown.title', fields: ['sections.notShown'] },
    { key: 'hostVsPlayer', title: 'sections.hostVsPlayer.title', fields: ['sections.hostVsPlayer'] },
    { key: 'faq', title: 'sections.faq.title', fields: ['sections.faq', 'faq'], locked: true },
  ]),
});

export type DashboardContent = z.infer<typeof dashboardSchema>;

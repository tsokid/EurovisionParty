// The 404 page (dist/404.html and every unknown URL). Mirrors the former
// NotFoundCopy interface; the page supplies each related card's href.
import type { z } from 'zod';
import { group, text } from '../fields.ts';
import { basicMeta, cta, hero, titleBlurb, extraBlocks } from './common.ts';

export const notFoundSchema = group({
  meta: basicMeta,
  crumbs: group({ home: text(), notFound: text() }),
  hero,
  cta,
  related: group({
    heading: text(),
    night: titleBlurb,
    predictions: titleBlurb,
    trivia: titleBlurb,
    duels: titleBlurb,
    dashboard: titleBlurb,
    howToPlay: titleBlurb,
    scoring: titleBlurb,
    faq: titleBlurb,
  }),
  extraBlocks,
});

export type NotFoundContent = z.infer<typeof notFoundSchema>;

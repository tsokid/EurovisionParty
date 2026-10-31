// /eurovision-predictions. Mirrors the former PredictionsCopy interface. That
// copy was a function of the live contest's texts: the parts it templated are
// now placeholders, filled from contestTexts() by the page. The line-up itself
// is data (contests/{year}.json) and stays in code.
//
// The hero lede branched on two facts, so it is split into a template and the
// pieces the page picks between (src/pages/seo/predictionsText.ts):
//   lede      {verb} = ledeVerb.decided once the final is decided, else ledeVerb.upcoming;
//             {hostPart} = ledeHost with {hostName} filled, or "" when the host is unknown.
import type { z } from 'zod';
import { group, list, text } from '../fields.ts';
import { cta, HERO_LABEL, META_LABEL, metaDescription, qa, seoTitle, strongRest, titleBlurb } from './common.ts';

const YEAR = { placeholders: ['year'] };
const YEAR_CITY = { placeholders: ['year', 'cityIn'] };

const scoringRows = group({ exact: text(), inListWrong: text(), outside: text() });
const resultPoints = group({ result: text(), points: text() });

export const eurovisionPredictionsSchema = group({
  meta: group({
    title: seoTitle(),
    description: metaDescription(YEAR_CITY),
    schemaTitle: seoTitle({ label: 'Schema title' }),
    schemaDescription: metaDescription({ label: 'Schema description', ...YEAR_CITY }),
    keywords: list(text(YEAR)),
  }, META_LABEL),
  crumbs: group({ home: text(), predictions: text() }),
  hero: group({
    chip: text(),
    title: text(),
    lede: text({
      placeholders: ['year', 'verb', 'cityIn', 'hostPart', 'finalDay'],
      placeholderHelp: {
        verb: 'ledeVerb.upcoming before the final is decided, ledeVerb.decided after it',
        hostPart: 'ledeHost with the host country filled in, or nothing while the host is unknown',
      },
    }),
    ledeVerb: group({
      upcoming: text({ help: 'Fills {verb} before the final is decided' }),
      decided: text({ help: 'Fills {verb} once the final is decided' }),
    }),
    ledeHost: text({ placeholders: ['hostName'], help: 'Fills {hostPart} when the host country is known' }),
  }, HERO_LABEL),
  sections: group({
    lineup: group({
      title: text(YEAR),
      intro: text({ placeholders: ['count', 'year'], placeholderHelp: { count: 'How many countries are in the line-up' } }),
      hostSuffix: text(),
      runningOrder: text(),
      resultsTitle: text(YEAR),
      resultsIntro: text(YEAR),
      notInFinal: text(),
      empty: text(YEAR),
      hubLink: text(YEAR),
    }),
    format: group({
      title: text(),
      intro: text(),
      top5Label: text(),
      top5Body: text(),
      worst5Label: text(),
      worst5Body: text(),
      orderedPre: text(),
      orderedEm: text(),
      orderedPost: text(),
    }),
    scoringTop5: group({
      title: text(),
      intro: text(),
      headers: resultPoints,
      rows: scoringRows,
      max: group({ pre: text(), post: text() }),
    }),
    scoringWorst5: group({
      title: text(),
      intro: text(),
      headers: resultPoints,
      rows: scoringRows,
      max: group({ pre: text(), cap: text() }),
    }),
    strategy: group({ title: text(), tips: list(strongRest) }),
    faqTitle: text(),
  }),
  cta,
  related: group({
    night: titleBlurb,
    trivia: titleBlurb,
    duels: titleBlurb,
    scoring: titleBlurb,
    howToPlay: titleBlurb,
    faq: titleBlurb,
  }),
  faq: list(qa),
});

export type EurovisionPredictionsContent = z.infer<typeof eurovisionPredictionsSchema>;

/**
 * The predictions page's copy (content/pages/eurovision-predictions.json)
 * with the live contest's facts filled in: the shape the former
 * predictionsCopy.ts rendered. Only the templated fields are interpolated.
 */
import type { EurovisionPredictionsContent } from '../../../supabase/functions/_shared/cms/schemas/eurovision-predictions';
import { interpolate } from '../../../supabase/functions/_shared/cms/placeholders';
import type { ContestText } from './content/contestText';

export type PredictionsText = Omit<EurovisionPredictionsContent, 'hero'> & {
  hero: { chip: string; title: string; lede: string };
};

export function predictionsText(c: EurovisionPredictionsContent, t: ContestText): PredictionsText {
  const vars = { year: t.year, cityIn: t.cityIn, count: t.lineup };
  const fill = (s: string) => interpolate(s, vars);
  const { ledeVerb, ledeHost, ...hero } = c.hero;
  const lineup = c.sections.lineup;
  return {
    ...c,
    meta: {
      ...c.meta,
      description: fill(c.meta.description),
      schemaDescription: fill(c.meta.schemaDescription),
      keywords: c.meta.keywords.map(fill),
    },
    hero: {
      ...hero,
      lede: interpolate(hero.lede, {
        ...vars,
        finalDay: t.finalDay,
        verb: t.decided ? ledeVerb.decided : ledeVerb.upcoming,
        hostPart: t.host ? interpolate(ledeHost, { hostName: t.host }) : '',
      }),
    },
    sections: {
      ...c.sections,
      lineup: {
        ...lineup,
        title: fill(lineup.title),
        intro: fill(lineup.intro),
        resultsTitle: fill(lineup.resultsTitle),
        resultsIntro: fill(lineup.resultsIntro),
        empty: fill(lineup.empty),
        hubLink: fill(lineup.hubLink),
      },
    },
  };
}

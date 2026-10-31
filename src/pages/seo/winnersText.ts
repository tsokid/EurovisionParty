/**
 * The winners page's copy (content/pages/winners.json) with the contest
 * index's facts filled in. Every value is null until the index has loaded.
 *   last       latest completed year (meta)
 *   from, to   oldest/newest year of the recent table
 *   first      first contest year (all-winners title)
 *   cancelled  a cancelled year inside the recent window, else null
 */
import type { WinnersContent } from '../../../supabase/functions/_shared/cms/schemas/winners';
import { interpolate } from '../../../supabase/functions/_shared/cms/placeholders';

export type WinnersVars = {
  last: number | null;
  from: number | null;
  to: number | null;
  first: number | null;
  cancelled: number | null;
};

type Recent = WinnersContent['sections']['recent'];
export type WinnersText = Omit<WinnersContent, 'sections'> & {
  sections: Omit<WinnersContent['sections'], 'recent'> & { recent: Omit<Recent, 'introCancelled'> };
};

export function winnersText(c: WinnersContent, v: WinnersVars): WinnersText {
  const { introCancelled, ...recent } = c.sections.recent;
  const last = v.last;
  return {
    ...c,
    meta: {
      ...c.meta,
      description: last === null ? c.meta.description : interpolate(c.meta.description, { last }),
      keywords: last === null ? c.meta.keywords : c.meta.keywords.map((k) => interpolate(k, { last })),
    },
    sections: {
      ...c.sections,
      recent: {
        ...recent,
        title: v.from === null || v.to === null ? c.hero.chip : interpolate(recent.title, { from: v.from, to: v.to }),
        // One string: the cancelled-year note is appended only when one falls in the window.
        intro: v.from === null ? ''
          : interpolate(recent.intro, { from: v.from })
            + (v.cancelled !== null ? interpolate(introCancelled, { cancelled: v.cancelled }) : ''),
      },
      all: { ...c.sections.all, title: v.first === null ? c.sections.all.title : interpolate(c.sections.all.title, { from: v.first }) },
    },
  };
}

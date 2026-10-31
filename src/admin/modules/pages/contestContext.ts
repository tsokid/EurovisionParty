// The live contest (site.json `current`) as the editor needs it:
// - placeholder values for the form's character counters, built with the
//   same contestTexts helper the guide pages use (English forms; a Greek
//   counter differs only by the length of the Greek city name);
// - the validation context for the hardcoded year/city warning.
import { useMemo } from 'react';
import { useCurrentContest, type CurrentContest } from '../../../lib/currentContest';
import { contestTexts } from '../../../pages/seo/content/contestText';
import type { Vars } from '../../../../supabase/functions/_shared/cms/interpolateDocument';
import type { ValidationContext } from '../../../../supabase/functions/_shared/cms/validate';

export function contestVars(cc: CurrentContest): Vars {
  const t = contestTexts(cc).en;
  return {
    year: t.year,
    city: t.city,
    cityIn: t.cityIn,
    cityFrom: t.cityFrom,
    host: t.host,
    hostName: t.host,
    finalDay: t.finalDay,
    finalDayShort: t.finalDayShort,
    finalMonth: t.finalMonth,
    flag: t.flag,
    lineup: t.lineup,
    count: t.lineup,
  };
}

export function validationContext(cc: CurrentContest): ValidationContext {
  const t = contestTexts(cc);
  return { year: cc.year, cities: [...new Set([cc.city, t.en.city, t.el.city].filter(Boolean))] };
}

export function useContestContext(): { vars: Vars; context: ValidationContext } {
  const cc = useCurrentContest();
  return useMemo(() => ({ vars: contestVars(cc), context: validationContext(cc) }), [cc]);
}

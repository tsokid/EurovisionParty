// The featured contest: the one the public site headlines (content/site.json
// current_year). Shared by the snapshot (site.json) and the generated
// redirects (live hub), so the two can never disagree.
//
// Rule (owner, 19 Nov 2026, roadmap "Principle — Featured contest"): the
// newest contest. The featured contest changes only when the owner adds a new
// contest; finalizing or archiving changes nothing. The game year is separate
// (live_contest_year(), game data).

import type { ContestStage } from './contestTypes.ts';

type Staged = { year: number; stage: ContestStage };

export function siteContest<T extends Staged>(contests: T[]): T {
  if (contests.length === 0) throw new Error('siteContest: no contests');
  return contests.reduce((a, b) => (b.year > a.year ? b : a));
}

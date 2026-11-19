// The contest the public site headlines (content/site.json current_year).
// Shared by the snapshot (site.json) and the generated redirects (live hub),
// so the two can never disagree.
//
// Rule: the live contest (current or finalized), else the latest contest that
// has started (archived included), else the latest. Archiving a contest does
// not move the site to an upcoming one: the next contest takes over when it is
// started (owner decision, 19 Nov 2026).

import type { ContestStage } from './contestTypes.ts';

type Staged = { year: number; stage: ContestStage };

export function siteContest<T extends Staged>(contests: T[]): T {
  if (contests.length === 0) throw new Error('siteContest: no contests');
  const live = contests.filter((c) => c.stage === 'current' || c.stage === 'finalized');
  if (live.length > 1) {
    throw new Error(`siteContest: ${live.length} live contests (${live.map((c) => c.year).join(', ')}); expected at most one`);
  }
  if (live.length === 1) return live[0];
  const latest = (xs: T[]) => xs.reduce((a, b) => (b.year > a.year ? b : a));
  const started = contests.filter((c) => c.stage !== 'upcoming');
  return started.length ? latest(started) : latest(contests);
}

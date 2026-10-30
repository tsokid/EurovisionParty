/** /winners data: the winners tables and the leaderboard, from contests/index.json. */
import type { ContestIndex, IndexWinner } from '../../content/contests/types';
import type { Locale } from '../../lib/seo/locale';
import { compareText } from '../../lib/seo/textSort';
import { archivedContests, type IndexedContest } from './archive';

/** The leaderboard lists countries with at least this many wins (the copy says "more than twice"). */
export const LEADERBOARD_MIN_WINS = 3;

export type WinnerYear = IndexedContest & {
  /** Everyone in first place (several on a shared win, as in 1969); empty when cancelled. */
  winners: IndexWinner[];
};

export interface LeaderboardRow {
  iso: string;
  name: string;
  wins: number;
  /** Most recent winning year. */
  last: number;
}

export interface WinnersData {
  /** Archived years with a winner, newest first. */
  years: WinnerYear[];
  /** Every archived year, newest first (the cancelled one included). */
  all: WinnerYear[];
  /** By wins, then name (deterministic). A shared first place counts as a win for each country. */
  leaderboard: LeaderboardRow[];
}

/** Archived years only, so the page matches its "1956 to 2025"-style copy until a year is archived. */
export function winnersData(index: ContestIndex, locale: Locale): WinnersData {
  const all: WinnerYear[] = archivedContests(index)
    .reverse()
    .map((c) => ({ ...c, winners: c.winner ? [c.winner, ...c.co_winners] : [] }));
  const tally = new Map<string, LeaderboardRow>();
  for (const c of all) {
    for (const w of c.winners) {
      const t = tally.get(w.iso) ?? { iso: w.iso, name: locale === 'el' ? w.name_el : w.name_en, wins: 0, last: c.year };
      t.wins += 1;
      t.last = Math.max(t.last, c.year);
      tally.set(w.iso, t);
    }
  }
  return {
    years: all.filter((c) => c.winners.length > 0),
    all,
    leaderboard: [...tally.values()]
      .filter((t) => t.wins >= LEADERBOARD_MIN_WINS)
      .sort((a, b) => b.wins - a.wins || compareText(a.name, b.name)),
  };
}

/** The first cancelled year strictly inside (from, to), for the "(No 2020 …)" note; null when none. */
export function cancelledWithin(all: WinnerYear[], from: number, to: number): number | null {
  return all.filter((y) => y.cancelled && y.year > from && y.year < to).map((y) => y.year).sort((a, b) => a - b)[0] ?? null;
}

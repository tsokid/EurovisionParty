// End-of-night titles: presentation order only. WHO wins a title is decided
// by public.compute_winners (migration 069), unchanged by the redesign
// (pinned by tests/db/titleCriteria.test.ts).
import type { WinnerCategory, WinnerRow } from './winners';

/** The tier-1 reveal (motion map #1): Γκουρού → Μάντης → Μονομάχος → Κλέφτης → Πρωταθλητής. */
export const TITLE_REVEAL_ORDER: readonly WinnerCategory[] = ['guru', 'oracle', 'duelist', 'thief', 'champion'];
/** Static lists (final board): Πρωταθλητής first. */
export const TITLE_LIST_ORDER: readonly WinnerCategory[] = ['champion', 'oracle', 'thief', 'duelist', 'guru'];

/** The categories a player holds, in list order. */
export function titlesOf(rows: readonly WinnerRow[], playerId: string | null | undefined): WinnerCategory[] {
  if (!playerId) return [];
  const mine = new Set(rows.filter((r) => r.player_id === playerId).map((r) => r.category));
  return TITLE_LIST_ORDER.filter((c) => mine.has(c));
}

/** The metric shown in the one-line reason; it is the stored metric_value. */
export function titleMetric(rows: readonly WinnerRow[], cat: WinnerCategory): number | null {
  const r = rows.find((x) => x.category === cat);
  return r ? Number(r.metric_value) : null;
}

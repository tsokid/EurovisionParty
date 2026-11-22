// Room standings before and after a quiz round, for the round-end motion
// (motion map #3): who moved, by how much, and whom this player passed.
// Totals are players.total_points as the store has them; nothing is scored here.

export interface Standing {
  id: string;
  total: number;
}

/** Ids by total, highest first; ties keep a stable order by id. */
export function rankOrder(rows: readonly Standing[]): string[] {
  return [...rows]
    .sort((a, b) => (b.total - a.total) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => r.id);
}

export interface StandingsMove {
  before: string[];
  after: string[];
  /** 1-based rank before / after the round. */
  rankBefore: (id: string) => number;
  rankAfter: (id: string) => number;
  /** Positive = moved up. */
  delta: (id: string) => number;
  /** Players ahead of `meId` before and behind after, in their new order. */
  overtaken: string[];
}

/**
 * `before` is the snapshot taken when the round started; players missing
 * from it (joined mid-round) count with their current total.
 */
export function standingsMove(before: readonly Standing[], after: readonly Standing[], meId: string): StandingsMove {
  const beforeById = new Map(before.map((s) => [s.id, s.total]));
  const b = rankOrder(after.map((s) => ({ id: s.id, total: beforeById.get(s.id) ?? s.total })));
  const a = rankOrder(after);
  const rb = new Map(b.map((id, i) => [id, i + 1]));
  const ra = new Map(a.map((id, i) => [id, i + 1]));
  const rankBefore = (id: string) => rb.get(id) ?? 0;
  const rankAfter = (id: string) => ra.get(id) ?? 0;
  const meB = rankBefore(meId);
  const meA = rankAfter(meId);
  const overtaken = a.filter((id) => id !== meId && rankBefore(id) < meB && rankAfter(id) > meA);
  return { before: b, after: a, rankBefore, rankAfter, delta: (id) => rankBefore(id) - rankAfter(id), overtaken };
}

/** Up to `size` rows for the mini leaderboard, always including `meId`. */
export function standingsWindow(order: readonly string[], meId: string, size = 6): string[] {
  const top = order.slice(0, size);
  if (top.includes(meId) || !order.includes(meId)) return top;
  return [...top.slice(0, size - 1), meId];
}

// Live leaderboard ordering and movement (motion map #9).
import type { Player } from './types';

type Ranked = Pick<Player, 'id' | 'total_points'> & { name?: string };

/** Highest total first; ties keep the incoming order (the query's order). */
export function rankOrder<T extends Ranked>(players: readonly T[]): T[] {
  return players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (b.p.total_points ?? 0) - (a.p.total_points ?? 0) || a.i - b.i)
    .map((x) => x.p);
}

export interface RankDiff {
  /** id → places gained (+) or lost (−). Ids new to the list are absent. */
  delta: Record<string, number>;
  /** Players `meId` was behind before and is ahead of now. */
  overtaken: string[];
}

export function diffRanks(before: readonly string[], after: readonly string[], meId?: string | null): RankDiff {
  const pb = new Map(before.map((id, i) => [id, i]));
  const pa = new Map(after.map((id, i) => [id, i]));
  const delta: Record<string, number> = {};
  for (const [id, a] of pa) {
    const b = pb.get(id);
    if (b !== undefined && b !== a) delta[id] = b - a;
  }
  const overtaken: string[] = [];
  if (meId && pb.has(meId) && pa.has(meId)) {
    const mb = pb.get(meId)!, ma = pa.get(meId)!;
    for (const id of after) {
      if (id === meId) continue;
      const b = pb.get(id), a = pa.get(id)!;
      if (b !== undefined && b < mb && a > ma) overtaken.push(id);
    }
  }
  return { delta, overtaken };
}

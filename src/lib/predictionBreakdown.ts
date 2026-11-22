// src/lib/predictionBreakdown.ts
//
// Per-pick breakdown for the final-phase Predictions tab: for each of the
// player's 10 picks, where the country really finished and what it scored.
// Mirrors score_all_predictions (migration 010) and scoringEngine:
//   top5[i]   exact when the country finished i+1;     else +20 if in the official top 5
//   worst5[i] exact when the country finished N - i;   else +20 if in the official last 5
// N = number of grand finalists with a final place.

import { SCORING } from './constants';
import { indexForRow, placesFor, TOP_N, WORST_N, type ListId } from './predictionSlots';

export interface OfficialPlace {
  iso: string;
  final_place: number;
}

export type PickOutcome = 'exact' | 'list' | 'miss';

export interface BreakdownRow {
  list: ListId;
  /** The place the player predicted (1..5, or N-4..N). */
  predicted: number | null;
  iso: string;
  /** Where the country really finished (null: not among the placed finalists). */
  official: number | null;
  outcome: PickOutcome;
  points: number;
}

export interface Breakdown {
  n: number;
  top: BreakdownRow[];
  worst: BreakdownRow[];
  topPoints: number;
  worstPoints: number;
  hits: number;
}

export function buildBreakdown(
  pred: { top5: readonly string[] | null; worst5: readonly string[] | null },
  results: readonly OfficialPlace[],
): Breakdown {
  const n = results.length;
  const placeOf = new Map(results.map((r) => [r.iso, r.final_place]));
  const officialTop = new Set(results.filter((r) => r.final_place <= TOP_N).map((r) => r.iso));
  const officialWorst = new Set(results.filter((r) => r.final_place > n - WORST_N).map((r) => r.iso));
  const { exactPosition, inTop5, exactWorst, inWorst5 } = SCORING.prediction;

  const rows = (list: ListId, picks: readonly string[] | null): BreakdownRow[] => {
    const places = placesFor(list, n);
    const out: BreakdownRow[] = [];
    const count = list === 'top' ? TOP_N : WORST_N;
    for (let row = 0; row < count; row++) {
      const iso = picks?.[indexForRow(list, row)];
      if (!iso) continue;
      const predicted = places[row];
      const official = placeOf.get(iso) ?? null;
      const inList = (list === 'top' ? officialTop : officialWorst).has(iso);
      const exact = official !== null && predicted !== null && official === predicted;
      const outcome: PickOutcome = exact ? 'exact' : inList ? 'list' : 'miss';
      const points = outcome === 'exact'
        ? (list === 'top' ? exactPosition : exactWorst)
        : outcome === 'list' ? (list === 'top' ? inTop5 : inWorst5) : 0;
      out.push({ list, predicted, iso, official, outcome, points });
    }
    return out;
  };

  const top = rows('top', pred.top5);
  const worst = rows('worst', pred.worst5);
  const sum = (r: BreakdownRow[]) => r.reduce((s, x) => s + x.points, 0);
  return {
    n,
    top,
    worst,
    topPoints: sum(top),
    worstPoints: sum(worst),
    hits: [...top, ...worst].filter((r) => r.outcome !== 'miss').length,
  };
}

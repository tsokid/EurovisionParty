import { describe, it, expect } from 'vitest';
import {
  placesFor, placeOf, worstRange, emptySlots, slotsFromSaved, savedFromSlots, tapCountry,
  moveRow, clearSlot, filledCount, isComplete, nextEmpty, indexForRow, type Slots,
} from '../../src/lib/predictionSlots';
import { scorePredictions } from '../../src/lib/scoringEngine';
import { buildBreakdown } from '../../src/lib/predictionBreakdown';

const isos = (n: number) => Array.from({ length: n }, (_, i) => `C${String(i + 1).padStart(2, '0')}`);

describe('worst-5 places follow the finalist count', () => {
  it.each([
    [26, [22, 23, 24, 25, 26], [22, 26]],
    [25, [21, 22, 23, 24, 25], [21, 25]],
    [24, [20, 21, 22, 23, 24], [20, 24]],
  ])('%i finalists → %j', (n, places, range) => {
    expect(placesFor('worst', n)).toEqual(places);
    expect(worstRange(n)).toEqual(range);
    expect(placesFor('top', n)).toEqual([1, 2, 3, 4, 5]);
  });

  it('fewer than 10 finalists: the last 5 places, overlapping the top 5 as the scoring does', () => {
    expect(placesFor('worst', 8)).toEqual([4, 5, 6, 7, 8]);
    expect(placesFor('worst', 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('fewer than 5 (or no lineup yet): places below 1 are blank, never 0 or negative', () => {
    expect(placesFor('worst', 3)).toEqual([null, null, 1, 2, 3]);
    expect(placesFor('worst', 0)).toEqual([null, null, null, null, null]);
    expect(placesFor('worst', Number.NaN)).toEqual([null, null, null, null, null]);
    expect(worstRange(0)).toBeNull();
  });

  it('worst5[0] is last place (the scoring), shown as the bottom row', () => {
    expect(placeOf({ list: 'worst', index: 0 }, 26)).toBe(26);
    expect(placeOf({ list: 'worst', index: 4 }, 26)).toBe(22);
    expect(placeOf({ list: 'worst', index: 0 }, 25)).toBe(25);
    expect(indexForRow('worst', 0)).toBe(4);
    expect(indexForRow('top', 0)).toBe(0);
  });

  it.each([26, 25, 24])('labels agree with scoringEngine for %i finalists', (n) => {
    const ranking = isos(n);
    // Pick each worst slot as the country that really finished at its label.
    const worst5 = [0, 1, 2, 3, 4].map((i) => ranking[placeOf({ list: 'worst', index: i }, n)! - 1]);
    const top5 = ranking.slice(0, 5);
    expect(scorePredictions(top5, worst5, ranking)).toEqual({ top5Points: 250, worst5Points: 250 });
    const b = buildBreakdown({ top5, worst5 }, ranking.map((iso, i) => ({ iso, final_place: i + 1 })));
    expect(b.topPoints).toBe(250);
    expect(b.worstPoints).toBe(250);
    expect(b.worst.map((r) => r.predicted)).toEqual(placesFor('worst', n));
  });
});

describe('tap-to-assign', () => {
  it('fills the next empty slot of the active list, then moves to the other list', () => {
    let s = emptySlots();
    let active: 'top' | 'worst' = 'top';
    for (const id of ['A', 'B', 'C', 'D', 'E']) {
      const r = tapCountry(s, active, id);
      expect(r.kind).toBe('placed');
      s = r.slots; active = r.active;
    }
    expect(s.top).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(active).toBe('worst');
    const r = tapCountry(s, active, 'F');
    // Worst 5 fills from the top row on screen = the best of the worst (index 4).
    expect(r.kind === 'placed' && r.at).toEqual({ list: 'worst', index: 4 });
    expect(r.slots.worst).toEqual([null, null, null, null, 'F']);
  });

  it('a picked country tapped again leaves its slot', () => {
    const s = slotsFromSaved(['A', 'B'], []);
    const r = tapCountry(s, 'top', 'A');
    expect(r.kind).toBe('removed');
    expect(r.slots.top).toEqual([null, 'B', null, null, null]);
    // …and the gap is the next slot to fill.
    expect(nextEmpty(r.slots, 'top')).toEqual({ list: 'top', index: 0 });
  });

  it('falls back to the other list when the active one is full; reports full at 10/10', () => {
    let s: Slots = slotsFromSaved(['A', 'B', 'C', 'D', 'E'], []);
    const r = tapCountry(s, 'top', 'F');
    expect(r.kind === 'placed' && r.at.list).toBe('worst');
    s = slotsFromSaved(['A', 'B', 'C', 'D', 'E'], ['F', 'G', 'H', 'I', 'J']);
    expect(isComplete(s)).toBe(true);
    expect(tapCountry(s, 'worst', 'K').kind).toBe('full');
  });

  it('moveRow swaps on-screen neighbours (worst list maps rows to storage)', () => {
    const s = slotsFromSaved(['A', 'B', 'C', 'D', 'E'], ['V', 'W', 'X', 'Y', 'Z']);
    expect(moveRow(s, 'top', 1, -1).top).toEqual(['B', 'A', 'C', 'D', 'E']);
    expect(moveRow(s, 'top', 0, -1)).toBe(s);
    expect(moveRow(s, 'top', 4, 1)).toBe(s);
    // Worst rows on screen: Z(22) Y X W V(26). Row 0 down → Y, Z …
    expect(moveRow(s, 'worst', 0, 1).worst).toEqual(['V', 'W', 'X', 'Z', 'Y']);
  });

  it('round-trips the saved arrays; partial saves pad, empty slots drop', () => {
    const s = slotsFromSaved(['A', 'B', 'C'], ['V', 'W']);
    expect(filledCount(s)).toBe(5);
    expect(savedFromSlots(s)).toEqual({ top5: ['A', 'B', 'C'], worst5: ['V', 'W'] });
    expect(savedFromSlots(clearSlot(s, { list: 'top', index: 1 }))).toEqual({ top5: ['A', 'C'], worst5: ['V', 'W'] });
    expect(slotsFromSaved(null, undefined)).toEqual(emptySlots());
  });
});

describe('buildBreakdown', () => {
  const results = isos(26).map((iso, i) => ({ iso, final_place: i + 1 }));
  it('exact +50, right list wrong place +20, miss 0; totals and hits', () => {
    const b = buildBreakdown(
      { top5: ['C01', 'C03', 'C02', 'C07', 'C05'], worst5: ['C26', 'C24', 'C20', 'C25', 'C16'] },
      results,
    );
    expect(b.top.map((r) => [r.predicted, r.official, r.outcome, r.points])).toEqual([
      [1, 1, 'exact', 50], [2, 3, 'list', 20], [3, 2, 'list', 20], [4, 7, 'miss', 0], [5, 5, 'exact', 50],
    ]);
    // Display order 22..26 → worst5[4..0]
    expect(b.worst.map((r) => [r.predicted, r.iso, r.outcome, r.points])).toEqual([
      [22, 'C16', 'miss', 0], [23, 'C25', 'list', 20], [24, 'C20', 'miss', 0], [25, 'C24', 'list', 20], [26, 'C26', 'exact', 50],
    ]);
    expect([b.topPoints, b.worstPoints, b.hits]).toEqual([140, 90, 7]);
  });

  it('a pick missing from the placed results is a miss with no official place', () => {
    const b = buildBreakdown({ top5: ['XX'], worst5: null }, results);
    expect(b.top).toEqual([{ list: 'top', predicted: 1, iso: 'XX', official: null, outcome: 'miss', points: 0 }]);
    expect(b.worst).toEqual([]);
  });
});

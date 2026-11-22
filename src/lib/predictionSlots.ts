// src/lib/predictionSlots.ts
//
// Pure model behind the tap-to-assign predictions picker. The screen keeps
// its state here, so a later switch to another pick mode (tap a slot, drag,
// controls) only swaps the event handlers, not the data or the labels.
//
// Storage (unchanged, and what score_all_predictions / scoringEngine read):
//   top5[0..4]   → official places 1..5          (top5[0] = the winner)
//   worst5[0..4] → official places N, N-1 … N-4  (worst5[0] = last place)
//
// Display: both lists read top-to-bottom in ascending place order, as on
// the boards: Top 5 = 1..5, Worst 5 = (N-4)..N. So Worst-5 display row r
// holds worst5[WORST_N - 1 - r].

export const TOP_N = 5;
export const WORST_N = 5;

export type ListId = 'top' | 'worst';

/** Slot arrays in storage order; `null` = empty slot. */
export interface Slots {
  top: (string | null)[];
  worst: (string | null)[];
}

export interface SlotRef {
  list: ListId;
  /** Storage index (top5[i] / worst5[i]). */
  index: number;
}

const size = (list: ListId) => (list === 'top' ? TOP_N : WORST_N);
export const otherList = (list: ListId): ListId => (list === 'top' ? 'worst' : 'top');

/** Storage index for a display row (0 = first row on screen). */
export function indexForRow(list: ListId, row: number): number {
  return list === 'top' ? row : WORST_N - 1 - row;
}

/** Display row for a storage index (inverse of indexForRow). */
export const rowForIndex = indexForRow;

/**
 * Official place each display row stands for. Top 5 is always 1..5.
 * Worst 5 depends on the year's finalist count `n` (26 → 22..26,
 * 25 → 21..25, 24 → 20..24). With fewer than 10 finalists the two ranges
 * overlap exactly as the scoring does (it takes the last 5 places); a
 * place below 1 (fewer than 5 finalists, or the lineup not loaded) is
 * `null`, shown as a blank number.
 */
export function placesFor(list: ListId, n: number): (number | null)[] {
  if (list === 'top') return [1, 2, 3, 4, 5];
  const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return Array.from({ length: WORST_N }, (_, row) => {
    const place = count - (WORST_N - 1) + row;
    return place >= 1 ? place : null;
  });
}

/** Official place for a storage slot. */
export function placeOf(ref: SlotRef, n: number): number | null {
  return placesFor(ref.list, n)[rowForIndex(ref.list, ref.index)];
}

/** "21–25" style range of the Worst-5 places, `null` when unknown. */
export function worstRange(n: number): [number, number] | null {
  const places = placesFor('worst', n).filter((p): p is number => p !== null);
  return places.length ? [places[0], places[places.length - 1]] : null;
}

export function emptySlots(): Slots {
  return { top: Array(TOP_N).fill(null), worst: Array(WORST_N).fill(null) };
}

/** Saved arrays → slots (padded with empty slots). */
export function slotsFromSaved(top5: readonly string[] | null | undefined, worst5: readonly string[] | null | undefined): Slots {
  const pad = (arr: readonly string[] | null | undefined, n: number) =>
    Array.from({ length: n }, (_, i) => arr?.[i] ?? null);
  return { top: pad(top5, TOP_N), worst: pad(worst5, WORST_N) };
}

/** Slots → the arrays the save writes (empty slots dropped). */
export function savedFromSlots(slots: Slots): { top5: string[]; worst5: string[] } {
  return {
    top5: slots.top.filter((x): x is string => !!x),
    worst5: slots.worst.filter((x): x is string => !!x),
  };
}

export function filledCount(slots: Slots): number {
  return slots.top.filter(Boolean).length + slots.worst.filter(Boolean).length;
}

export function isComplete(slots: Slots): boolean {
  return slots.top.every(Boolean) && slots.worst.every(Boolean);
}

export function findSlot(slots: Slots, id: string): SlotRef | null {
  const ti = slots.top.indexOf(id);
  if (ti !== -1) return { list: 'top', index: ti };
  const wi = slots.worst.indexOf(id);
  if (wi !== -1) return { list: 'worst', index: wi };
  return null;
}

/** First empty slot of a list in display order, or null when full. */
export function nextEmpty(slots: Slots, list: ListId): SlotRef | null {
  for (let row = 0; row < size(list); row++) {
    const index = indexForRow(list, row);
    if (!slots[list][index]) return { list, index };
  }
  return null;
}

function withSlot(slots: Slots, ref: SlotRef, value: string | null): Slots {
  const next: Slots = { top: [...slots.top], worst: [...slots.worst] };
  next[ref.list][ref.index] = value;
  return next;
}

export function clearSlot(slots: Slots, ref: SlotRef): Slots {
  return withSlot(slots, ref, null);
}

export type TapResult =
  | { kind: 'placed'; slots: Slots; at: SlotRef; active: ListId }
  | { kind: 'removed'; slots: Slots; at: SlotRef; active: ListId }
  | { kind: 'full'; slots: Slots; active: ListId };

/**
 * Tap a country in the pool:
 *  - already picked → it leaves its slot;
 *  - otherwise it fills the next empty slot of the active list, or of the
 *    other list when the active one is full (the active list follows).
 */
export function tapCountry(slots: Slots, active: ListId, id: string): TapResult {
  const at = findSlot(slots, id);
  if (at) return { kind: 'removed', slots: clearSlot(slots, at), at, active };
  let target = nextEmpty(slots, active);
  if (!target) target = nextEmpty(slots, otherList(active));
  if (!target) return { kind: 'full', slots, active };
  const placed = withSlot(slots, target, id);
  // Once this list is full, point at the other one if it still has room.
  const nextActive = !nextEmpty(placed, target.list) && nextEmpty(placed, otherList(target.list))
    ? otherList(target.list)
    : target.list;
  return { kind: 'placed', slots: placed, at: target, active: nextActive };
}

/**
 * Move a slot one row up (-1) or down (+1) on screen, swapping with its
 * neighbour (which may be empty). Out of range → unchanged.
 */
export function moveRow(slots: Slots, list: ListId, row: number, dir: -1 | 1): Slots {
  const to = row + dir;
  if (row < 0 || to < 0 || row >= size(list) || to >= size(list)) return slots;
  const a = indexForRow(list, row);
  const b = indexForRow(list, to);
  const arr = [...slots[list]];
  [arr[a], arr[b]] = [arr[b], arr[a]];
  return { ...slots, [list]: arr };
}

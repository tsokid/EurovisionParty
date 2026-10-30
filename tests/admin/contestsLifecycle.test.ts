import { describe, it, expect } from 'vitest';
import { allowedActions, confirmText, type ContestRow } from '@/admin/modules/contests/lifecycle';

const row = (year: number, stage: ContestRow['stage'], entry_count = 0): ContestRow => ({
  year,
  city: `City${year}`,
  city_slug: `city${year}`,
  host_iso: null,
  stage,
  final_date: null,
  indexable: false,
  entry_count,
});

describe('allowedActions', () => {
  it('start: upcoming with nothing live', () => {
    const c = row(2027, 'upcoming');
    expect(allowedActions(c, [c, row(2026, 'archived', 30)], false)).toEqual(['start']);
  });

  it('start is hidden while another contest is current or finalized', () => {
    const c = row(2027, 'upcoming');
    expect(allowedActions(c, [c, row(2026, 'current', 30)], false)).toEqual([]);
    expect(allowedActions(c, [c, row(2026, 'finalized', 30)], false)).toEqual([]);
  });

  it('finalize: current', () => {
    const c = row(2026, 'current', 30);
    expect(allowedActions(c, [c], false)).toEqual(['finalize']);
  });

  it('archive: finalized and Y+1 has entries', () => {
    const c = row(2026, 'finalized', 30);
    expect(allowedActions(c, [row(2027, 'upcoming', 5), c], false)).toEqual(['archive']);
  });

  it('archive is hidden when Y+1 is missing or has no entries', () => {
    const c = row(2026, 'finalized', 30);
    expect(allowedActions(c, [c], false)).toEqual([]);
    expect(allowedActions(c, [row(2027, 'upcoming', 0), c], false)).toEqual([]);
    // Y+2 with entries does not count
    expect(allowedActions(c, [row(2028, 'upcoming', 5), c], false)).toEqual([]);
  });

  it('unarchive: latest archived year with Y+1 current and no Y+1 rooms', () => {
    const c = row(2026, 'archived', 30);
    const all = [row(2027, 'current', 5), c, row(2025, 'archived', 26)];
    expect(allowedActions(c, all, false)).toEqual(['unarchive']);
  });

  it('unarchive is hidden when Y+1 has rooms', () => {
    const c = row(2026, 'archived', 30);
    expect(allowedActions(c, [row(2027, 'current', 5), c], true)).toEqual([]);
  });

  it('unarchive is hidden for an archived year that is not the latest', () => {
    const c = row(2025, 'archived', 26);
    const all = [row(2027, 'current', 5), row(2026, 'archived', 30), c];
    expect(allowedActions(c, all, false)).toEqual([]);
  });

  it('unarchive is hidden when Y+1 is not current', () => {
    const c = row(2026, 'archived', 30);
    expect(allowedActions(c, [row(2027, 'upcoming', 5), c], false)).toEqual([]);
    expect(allowedActions(c, [c], false)).toEqual([]);
  });

  it('upcoming with a live contest elsewhere, finalized without next: no actions', () => {
    const live = row(2026, 'finalized', 30);
    const next = row(2027, 'upcoming', 0);
    const all = [next, live];
    expect(allowedActions(next, all, false)).toEqual([]);
    expect(allowedActions(live, all, false)).toEqual([]);
  });
});

describe('confirmText', () => {
  const all = [row(2027, 'current', 5), row(2026, 'archived', 30)];

  it('archive sentence', () => {
    expect(confirmText('archive', row(2026, 'finalized', 30), all)).toBe(
      'Archive 2026: 2026 becomes archived and 2027 becomes the current contest. You can undo with Un-archive until a 2027 room is created.',
    );
  });

  it('unarchive sentence', () => {
    expect(confirmText('unarchive', row(2026, 'archived', 30), all)).toBe(
      'Un-archive 2026: 2026 goes back to finalized and 2027 goes back to upcoming. Entries of 2027 are kept.',
    );
  });

  it('start and finalize sentences name the year', () => {
    expect(confirmText('start', row(2027, 'upcoming'), all)).toBe('Start 2027: 2027 becomes the current contest.');
    expect(confirmText('finalize', row(2026, 'current', 30), all)).toBe(
      'Finalize 2026: 2026 becomes finalized and every 2026 room is scored and gets its winners. Results can no longer be changed. This cannot be undone.',
    );
  });
});

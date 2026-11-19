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
    expect(allowedActions(c, [c, row(2026, 'archived', 30)])).toEqual(['start']);
  });

  it('start is hidden while another contest is current or finalized', () => {
    const c = row(2027, 'upcoming');
    expect(allowedActions(c, [c, row(2026, 'current', 30)])).toEqual([]);
    expect(allowedActions(c, [c, row(2026, 'finalized', 30)])).toEqual([]);
  });

  it('finalize: current', () => {
    const c = row(2026, 'current', 30);
    expect(allowedActions(c, [c])).toEqual(['finalize']);
  });

  it('archive: any finalized contest, whatever the next year looks like', () => {
    const c = row(2026, 'finalized', 30);
    expect(allowedActions(c, [c])).toEqual(['archive']);
    expect(allowedActions(c, [row(2027, 'upcoming', 0), c])).toEqual(['archive']);
    expect(allowedActions(c, [row(2027, 'upcoming', 5), c])).toEqual(['archive']);
  });

  it('unarchive: latest archived year while nothing is live', () => {
    const c = row(2026, 'archived', 30);
    expect(allowedActions(c, [c, row(2025, 'archived', 26)])).toEqual(['unarchive']);
    expect(allowedActions(c, [row(2027, 'upcoming', 0), c])).toEqual(['unarchive']);
  });

  it('unarchive is hidden while another contest is current or finalized', () => {
    const c = row(2026, 'archived', 30);
    expect(allowedActions(c, [row(2027, 'current', 5), c])).toEqual([]);
    expect(allowedActions(c, [row(2027, 'finalized', 5), c])).toEqual([]);
  });

  it('unarchive is hidden for an archived year that is not the latest', () => {
    const c = row(2025, 'archived', 26);
    expect(allowedActions(c, [row(2026, 'archived', 30), c])).toEqual([]);
  });

  it('upcoming while another contest is finalized: no start', () => {
    const live = row(2026, 'finalized', 30);
    const next = row(2027, 'upcoming', 0);
    expect(allowedActions(next, [next, live])).toEqual([]);
  });
});

describe('confirmText', () => {
  it('archive sentence', () => {
    expect(confirmText('archive', row(2026, 'finalized', 30))).toBe(
      'Archive 2026: 2026 is locked and its page moves to the past contests (the old 2026 address redirects there). Games and the next contest are not affected. You can undo with Un-archive while no other contest is started.',
    );
  });

  it('unarchive sentence', () => {
    expect(confirmText('unarchive', row(2026, 'archived', 30))).toBe(
      'Un-archive 2026: 2026 goes back to finalized and its results can be corrected again.',
    );
  });

  it('start and finalize sentences name the year', () => {
    expect(confirmText('start', row(2027, 'upcoming'))).toBe('Start 2027: 2027 becomes the current contest.');
    expect(confirmText('finalize', row(2026, 'current', 30))).toBe(
      'Finalize 2026: 2026 becomes finalized and every 2026 room is scored and gets its winners. Results can no longer be changed. This cannot be undone.',
    );
  });
});

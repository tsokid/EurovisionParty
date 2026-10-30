import { describe, it, expect } from 'vitest';
import { participantRows, resultRows, semiRows } from '../../supabase/functions/eurovision-parse/rows';

describe('eurovision-parse rows', () => {
  it('participantRows maps the lineup to contest_entries columns and drops name', () => {
    const parsed = [
      { iso: 'GR', name: 'Greece', artist: 'Akylas', song: 'Ferto', runningOrder: 1 },
      { iso: 'AT', name: 'Austria', artist: 'Cosmó', song: 'Tanzschein', runningOrder: 2 },
    ];
    expect(participantRows(2027, parsed, 'parser')).toEqual([
      { year: 2027, iso: 'GR', artist: 'Akylas', song: 'Ferto', in_final: true, final_running_order: 1, source: 'parser' },
      { year: 2027, iso: 'AT', artist: 'Cosmó', song: 'Tanzschein', in_final: true, final_running_order: 2, source: 'parser' },
    ]);
  });

  it('participantRows keeps a null running order', () => {
    expect(participantRows(2027, [{ iso: 'SE', artist: 'A', song: 'S', runningOrder: null }], 'parser')).toEqual([
      { year: 2027, iso: 'SE', artist: 'A', song: 'S', in_final: true, final_running_order: null, source: 'parser' },
    ]);
  });

  it('resultRows maps the scoreboard to contest_entries result columns', () => {
    const parsed = [
      { iso: 'AT', ranking: 1, total: 436, jury: 258, televote: 178 },
      { iso: 'IL', ranking: 2, total: 357, jury: 60, televote: 297 },
    ];
    expect(resultRows(2027, parsed, 'parser')).toEqual([
      { year: 2027, iso: 'AT', final_place: 1, total_points: 436, jury_points: 258, televote_points: 178, source: 'parser' },
      { year: 2027, iso: 'IL', final_place: 2, total_points: 357, jury_points: 60, televote_points: 297, source: 'parser' },
    ]);
  });

  it('empty input yields no rows', () => {
    expect(participantRows(2027, [], 'parser')).toEqual([]);
    expect(resultRows(2027, [], 'parser')).toEqual([]);
  });
});

describe('eurovision-parse semiRows', () => {
  it('maps parsed semi rows to the semi columns plus artist and song', () => {
    const parsed = [
      { iso: 'UA', country: 'Ukraine', artist: 'Ziferblat', song: 'Bird of Pray', runningOrder: 5, place: 1, points: 137, qualified: true },
      { iso: 'AZ', country: 'Azerbaijan', artist: '', song: ' ', runningOrder: 10, place: null, points: null, qualified: null },
    ];
    expect(semiRows(2025, 1, parsed, 'parser')).toEqual([
      { year: 2025, iso: 'UA', artist: 'Ziferblat', song: 'Bird of Pray', semi: 1, semi_running_order: 5, semi_place: 1, semi_points: 137, qualified: true, source: 'parser' },
      // Blank names become null, so they never fill a column with ''.
      { year: 2025, iso: 'AZ', artist: null, song: null, semi: 1, semi_running_order: 10, semi_place: null, semi_points: null, qualified: null, source: 'parser' },
    ]);
  });
});

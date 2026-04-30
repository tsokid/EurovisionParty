import { describe, it, expect } from 'vitest';
import { groupByCategory, hasTie } from '../winners';

describe('groupByCategory', () => {
  it('buckets rows by category', () => {
    const out = groupByCategory([
      { id: '1', room_id: 'r', category: 'champion', player_id: 'p1', metric_value: 100, is_sudden_death_winner: false },
      { id: '2', room_id: 'r', category: 'champion', player_id: 'p2', metric_value: 100, is_sudden_death_winner: false },
      { id: '3', room_id: 'r', category: 'guru',     player_id: 'p3', metric_value: 8,   is_sudden_death_winner: false },
    ]);
    expect(out.champion).toHaveLength(2);
    expect(out.guru).toHaveLength(1);
    expect(hasTie(out.champion)).toBe(true);
    expect(hasTie(out.guru)).toBe(false);
  });
});

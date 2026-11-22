// Task 8: activity feed (stored events only), leaderboard movement, titles order.
import { describe, it, expect } from 'vitest';
import { buildActivityFeed, feedAge, FEED_LIMIT } from '../../src/lib/activityFeed';
import { diffRanks, rankOrder } from '../../src/lib/rankMoves';
import { TITLE_LIST_ORDER, TITLE_REVEAL_ORDER, titleMetric, titlesOf } from '../../src/lib/titles';
import type { WinnerRow } from '../../src/lib/winners';

const at = (m: number) => new Date(Date.UTC(2026, 4, 16, 20, m)).toISOString();

describe('activity feed is built only from stored point events', () => {
  it('nothing stored → nothing shown', () => {
    expect(buildActivityFeed({})).toEqual([]);
    expect(buildActivityFeed({ duels: [], quizAnswers: [], predictions: [] })).toEqual([]);
  });

  it('maps each stored row to exactly one event with the stored numbers', () => {
    const feed = buildActivityFeed({
      duels: [
        { id: 'd1', winner_id: 'a', loser_id: 'b', winner_decision: 'steal', points_transferred: 24, decision_made_at: at(5) },
        { id: 'd2', winner_id: 'c', loser_id: 'a', winner_decision: 'double', points_transferred: 32, decision_made_at: at(7) },
      ],
      quizAnswers: [{ id: 'q1', player_id: 'a', points_awarded: 12, answered_at: at(6) }],
      predictions: [{ id: 'p1', player_id: 'a', total_points: 140, scored_at: at(9) }],
    });
    expect(feed).toEqual([
      { id: 'pred:p1', kind: 'prediction', playerId: 'a', points: 140, at: at(9) },
      { id: 'duel:d2', kind: 'duel', playerId: 'c', points: 32, at: at(7), decision: 'double', otherId: null },
      { id: 'quiz:q1', kind: 'trivia', playerId: 'a', points: 12, at: at(6) },
      { id: 'duel:d1', kind: 'duel', playerId: 'a', points: 24, at: at(5), decision: 'steal', otherId: 'b' },
    ]);
  });

  it('skips rows that are not point events', () => {
    const feed = buildActivityFeed({
      duels: [
        { id: 'pending', winner_id: 'a', loser_id: 'b', winner_decision: null, points_transferred: 0, decision_made_at: null, completed_at: at(1) },
        { id: 'tie', winner_id: null, loser_id: null, winner_decision: null, points_transferred: 0, decision_made_at: null },
        { id: 'zero', winner_id: 'a', loser_id: 'b', winner_decision: 'steal', points_transferred: 0, decision_made_at: at(2) },
        { id: 'odd', winner_id: 'a', loser_id: 'b', winner_decision: 'forfeit', points_transferred: 9, decision_made_at: at(2) },
      ],
      quizAnswers: [
        { id: 'wrong', player_id: 'a', points_awarded: 0, answered_at: at(3) },
        { id: 'nulls', player_id: 'a', points_awarded: null, answered_at: at(3) },
      ],
      predictions: [
        { id: 'unscored', player_id: 'a', total_points: 0, scored_at: null },
        { id: 'zero', player_id: 'a', total_points: 0, scored_at: at(4) },
      ],
    });
    expect(feed).toEqual([]);
  });

  it('keeps the newest events, capped', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `q${i}`, player_id: 'a', points_awarded: 4, answered_at: at(i) }));
    const feed = buildActivityFeed({ quizAnswers: many });
    expect(feed).toHaveLength(FEED_LIMIT);
    expect(feed[0].id).toBe('quiz:q49');
  });

  it('relative age', () => {
    const now = Date.parse(at(30));
    expect(feedAge(at(30), now)).toEqual({ unit: 'now', n: 0 });
    expect(feedAge(at(26), now)).toEqual({ unit: 'min', n: 4 });
    expect(feedAge(new Date(now - 2.5 * 3600_000).toISOString(), now)).toEqual({ unit: 'hour', n: 2 });
  });
});

describe('leaderboard order and movement', () => {
  const P = (id: string, t: number) => ({ id, total_points: t });
  it('orders by total, ties keep the incoming order', () => {
    expect(rankOrder([P('a', 10), P('b', 30), P('c', 10), P('d', 20)]).map((p) => p.id)).toEqual(['b', 'd', 'a', 'c']);
  });
  it('reports places gained/lost and who you passed', () => {
    const d = diffRanks(['n', 'm', 'me', 'k'], ['me', 'n', 'm', 'k'], 'me');
    expect(d.delta).toEqual({ me: 2, n: -1, m: -1 });
    expect(d.overtaken).toEqual(['n', 'm']);
  });
  it('no overtake when you only got passed', () => {
    expect(diffRanks(['me', 'a'], ['a', 'me'], 'me').overtaken).toEqual([]);
    expect(diffRanks(['a', 'b'], ['a', 'b', 'c'], 'me')).toEqual({ delta: {}, overtaken: [] });
  });
});

describe('titles presentation order', () => {
  it('reveal order is Γκουρού → Μάντης → Μονομάχος → Κλέφτης → Πρωταθλητής', () => {
    expect(TITLE_REVEAL_ORDER).toEqual(['guru', 'oracle', 'duelist', 'thief', 'champion']);
    expect([...TITLE_LIST_ORDER].sort()).toEqual([...TITLE_REVEAL_ORDER].sort());
  });
  it('a player holds what compute_winners wrote, nothing derived', () => {
    const rows = [
      { category: 'oracle', player_id: 'a', metric_value: 140 },
      { category: 'champion', player_id: 'a', metric_value: 348 },
      { category: 'thief', player_id: 'b', metric_value: 36 },
    ] as WinnerRow[];
    expect(titlesOf(rows, 'a')).toEqual(['champion', 'oracle']);
    expect(titlesOf(rows, 'c')).toEqual([]);
    expect(titleMetric(rows, 'thief')).toBe(36);
    expect(titleMetric(rows, 'guru')).toBeNull();
  });
});

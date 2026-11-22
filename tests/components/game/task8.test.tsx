// Task 8: reel numbers, the unmask gate, the provisional leaderboard.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import i18n from '../../../src/i18n';
import { useGameStore } from '../../../src/stores/gameStore';
import type { Player, Room } from '../../../src/lib/types';

const reduced = vi.hoisted(() => ({ value: true }));
vi.mock('framer-motion', async (orig) => {
  const mod = await orig<typeof import('framer-motion')>();
  return { ...mod, useReducedMotion: () => reduced.value };
});

// In-memory supabase that records every query.
const db = vi.hoisted(() => ({
  calls: [] as { table: string; filters: unknown[][] }[],
  tables: {} as Record<string, Record<string, unknown>[]>,
}));
vi.mock('../../../src/lib/supabase', () => {
  function query(table: string) {
    const call = { table, filters: [] as unknown[][] };
    db.calls.push(call);
    let rows = () => db.tables[table] ?? [];
    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      eq(col: string, v: unknown) { call.filters.push(['eq', col, v]); const prev = rows; rows = () => prev().filter((r) => r[col] === v); return chain; },
      in(col: string, vs: unknown[]) { call.filters.push(['in', col, vs]); const prev = rows; rows = () => prev().filter((r) => vs.includes(r[col])); return chain; },
      not(col: string) { call.filters.push(['not', col]); const prev = rows; rows = () => prev().filter((r) => r[col] != null); return chain; },
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(res, rej),
    };
    return chain;
  }
  const channel = () => { const c = { on: () => c, subscribe: () => c }; return c; };
  return { supabase: { from: (t: string) => query(t), channel, removeChannel: () => {}, rpc: () => Promise.resolve({ data: null, error: null }) } };
});

import PersonalReel, { reelNumbers, Unmask } from '../../../src/components/reel/PersonalReel';
import LeaderboardScreen from '../../../src/components/leaderboard/LeaderboardScreen';

beforeAll(async () => { await i18n.changeLanguage('el'); });

const ROOM = 'r1';
const player = (id: string, name: string, q: number, d: number, p: number, spent = 0): Player => ({
  id, room_id: ROOM, user_id: `u-${id}`, name, avatar_emoji: '🎤', avatar_id: null, country_flag: null,
  quiz_points: q, pred_points: p, duel_points: d, points_spent: spent, total_points: q + d + p - spent,
  is_host: false, is_active: true, status: 'active', left_at: null, decline_count: 0,
  last_seen_at: null, joined_at: '2026-05-16T18:00:00Z',
} as Player);
const room = (phase: Room['phase']) => ({ id: ROOM, code: 'PARTY', year: 2026, phase }) as Room;

const cast = [
  player('me', 'Lady Televote', 184, 24, 140, 30),
  player('b', 'Disco Μπαμπέσα', 156, 36, 120),
  player('c', 'Douze Points', 212, -12, 90),
];

beforeEach(() => {
  db.calls = [];
  db.tables = {
    players: cast.map((p) => ({ ...p })),
    player_secrets: [{ player_id: 'me', real_name: 'Ελένη' }, { player_id: 'b', real_name: 'Μαρία' }],
    duels: [{ id: 'd1', room_id: ROOM, winner_id: 'b', loser_id: 'c', winner_decision: 'steal', points_transferred: 24, decision_made_at: '2026-05-16T20:00:00Z' }],
    quiz_answers: [
      { id: 'q1', room_id: ROOM, player_id: 'me', points_awarded: 12, answered_at: '2026-05-16T20:01:00Z' },
      { id: 'q2', room_id: ROOM, player_id: 'c', points_awarded: 8, answered_at: '2026-05-16T20:02:00Z' },
    ],
    predictions: [],
    winners: [],
  };
  useGameStore.getState().reset();
});

describe('reel numbers are the stored fields', () => {
  it('reelNumbers is a straight copy of quiz/duel/pred/spent/total', () => {
    for (const p of cast) {
      expect(reelNumbers(p)).toEqual({ trivia: p.quiz_points, duels: p.duel_points, predictions: p.pred_points, spent: p.points_spent, total: p.total_points });
    }
  });

  it('the reel summary shows those numbers (reduced motion, end state)', async () => {
    useGameStore.getState().setRoom(room('final'));
    useGameStore.getState().setPlayer(cast[0]);
    render(<PersonalReel player={cast[0]} players={cast} winners={[]} roomId={ROOM} roomCode="PARTY" year={2026} onClose={() => {}} />);
    const stats = document.querySelector('.rl-stats') as HTMLElement;
    expect(within(stats).getByText('184')).toBeTruthy();
    expect(within(stats).getByText('+24')).toBeTruthy();
    expect(within(stats).getByText('140')).toBeTruthy();
    expect(document.querySelector('.rl-sum-total .num')?.textContent).toBe(String(184 + 24 + 140 - 30));
    expect(screen.getByText('Μείον 30 πόντοι στο Intel')).toBeTruthy();
  });
});

describe('«Ποιος ήταν ποιος;» shows nothing before final', () => {
  it('Unmask renders nothing unless revealed', () => {
    const { container } = render(<Unmask players={cast} names={{ me: 'Ελένη' }} revealed={false} play reduce />);
    expect(container.innerHTML).toBe('');
  });

  it('before final: no unmask scene and no other player\'s secret is asked for', async () => {
    useGameStore.getState().setRoom(room('voting_live'));
    useGameStore.getState().setPlayer(cast[0]);
    render(<PersonalReel player={cast[0]} players={cast} winners={[]} roomId={ROOM} roomCode="PARTY" year={2026} onClose={() => {}} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('.rl-unmask')).toBeNull();
    expect(screen.queryByText('Ποιος ήταν ποιος;')).toBeNull();
    expect(screen.queryByText('Μαρία')).toBeNull();
    const secretCalls = db.calls.filter((c) => c.table === 'player_secrets');
    for (const c of secretCalls) expect(c.filters).toEqual([['eq', 'player_id', 'me']]); // own row only
  });

  it('at final: every stage name gets its real name, «—» where none was stored', async () => {
    useGameStore.getState().setRoom(room('final'));
    useGameStore.getState().setPlayer(cast[0]);
    render(<PersonalReel player={cast[0]} players={cast} winners={[]} roomId={ROOM} roomCode="PARTY" year={2026} onClose={() => {}} />);
    await waitFor(() => expect(document.querySelector('.rl-unmask')).not.toBeNull());
    const list = document.querySelector('.rl-unmask') as HTMLElement;
    expect(within(list).getByText('Ελένη')).toBeTruthy();
    expect(within(list).getByText('Μαρία')).toBeTruthy();
    expect(within(list).getByText('—')).toBeTruthy(); // Douze Points: old row, no secret
  });
});

describe('provisional leaderboard', () => {
  it('shows no end-of-night titles, and the feed only from stored events', async () => {
    useGameStore.getState().setRoom(room('pre_night'));
    useGameStore.getState().setPlayer(cast[0]);
    render(<LeaderboardScreen />);
    await waitFor(() => expect(document.querySelectorAll('.rk-row')).toHaveLength(3));
    const text = document.body.textContent ?? '';
    for (const title of ['Πρωταθλητής', 'Κλέφτης', 'Μονομάχος', 'Μάντης', 'Γκουρού']) expect(text).not.toContain(title);
    await waitFor(() => expect(document.querySelectorAll('.rk-item')).toHaveLength(2));
    const items = [...document.querySelectorAll('.rk-item-t')].map((e) => e.textContent);
    expect(items).toEqual(['Lady Televote · Trivia +12', 'Disco Μπαμπέσα · Μονομαχίες +24 (κλοπή) · Douze Points −24']);
    // Other players' trivia answers are never requested (RLS: own rows only).
    const qa = db.calls.filter((c) => c.table === 'quiz_answers');
    expect(qa.length).toBeGreaterThan(0);
    for (const c of qa) expect(c.filters).toContainEqual(['eq', 'player_id', 'me']);
  });

  it('orders by total with the stored breakdown per row', async () => {
    useGameStore.getState().setRoom(room('pre_night'));
    useGameStore.getState().setPlayer(cast[0]);
    render(<LeaderboardScreen />);
    await waitFor(() => expect(document.querySelectorAll('.rk-row')).toHaveLength(3));
    const names = [...document.querySelectorAll('.rk-row .rk-name-t')].map((e) => e.textContent?.split(' · ')[0]);
    expect(names).toEqual(['Lady Televote', 'Disco Μπαμπέσα', 'Douze Points']);
    expect(document.querySelector('.rk-row .rk-sub')?.textContent).toBe('Κουίζ 184 · Μον. +24 · Πρ. 140 · Intel −30');
  });
});

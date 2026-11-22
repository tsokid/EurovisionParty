// @vitest-environment node
// Task 8 characterization: the five end-of-night titles are computed by
// public.compute_winners (latest body: 069). The redesign only restyles how
// they are revealed, so this pins TODAY's criteria against PGlite with every
// migration applied:
//   champion  highest players.total_points among non-exited players (ties: all)
//   thief     most points_transferred over completed duels decided 'steal'
//   duelist   most completed duels won (any decision, or none yet)
//   oracle    highest SUM(predictions.total_points) (not players.pred_points)
//   guru      most quiz_answers with is_correct = true (count, not points)
// A category with a top metric of 0 has no winner.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';

const ROOM = '10000000-0000-4000-8000-0000000000c8';
const HOST = 'a0000000-0000-4000-8000-0000000000c8';
const U = (n: number) => `c0000000-0000-4000-8000-00000000000${n}`;
const P = (n: number) => `cccccccc-0000-4000-8000-00000000000${n}`;

describe('compute_winners title criteria (characterization)', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await db.exec(`
      insert into auth.users (id) values ('${HOST}'), ('${U(2)}'), ('${U(3)}'), ('${U(4)}'), ('${U(5)}');
      insert into public.rooms (id, code, host_id, host_name, phase) values ('${ROOM}', 'TTL008', '${HOST}', 'Host', 'final');
      insert into public.players (id, room_id, user_id, name, is_host, quiz_points, duel_points, pred_points, points_spent, status) values
        ('${P(1)}', '${ROOM}', '${HOST}', 'Lady Televote', true, 100, 20, 0, 0, 'active'),
        ('${P(2)}', '${ROOM}', '${U(2)}', 'Disco', false, 150, 36, 0, 0, 'active'),
        ('${P(3)}', '${ROOM}', '${U(3)}', 'Douze', false, 50, -12, 500, 0, 'active'),
        ('${P(4)}', '${ROOM}', '${U(4)}', 'Ghost', false, 900, 0, 0, 0, 'exited'),
        ('${P(5)}', '${ROOM}', '${U(5)}', 'Spender', false, 300, 0, 0, 290, 'active');
    `);
    // Duels: Disco beat Lady twice (steals 12 + 24) and Douze once (no decision yet);
    // Douze beat Lady once and doubled (+40, never a steal).
    const duel = (id: number, a: number, b: number, w: number, dec: string | null, pts: number, status = 'completed') =>
      `insert into public.duels (id, room_id, challenger_id, challenged_id, status, winner_id, loser_id, winner_decision, points_transferred)
       values ('dddddddd-0000-4000-8000-00000000000${id}', '${ROOM}', '${P(a)}', '${P(b)}', '${status}', ${w ? `'${P(w)}'` : 'null'}, ${w ? `'${P(w === a ? b : a)}'` : 'null'}, ${dec ? `'${dec}'` : 'null'}, ${pts});`;
    await db.exec([
      duel(1, 2, 1, 2, 'steal', 12),
      duel(2, 1, 2, 2, 'steal', 24),
      duel(3, 2, 3, 2, null, 0),
      duel(4, 3, 1, 3, 'double', 40),
      duel(5, 3, 1, 3, 'steal', 99, 'tie'), // not completed: ignored everywhere
    ].join('\n'));
    // Predictions: Lady's prediction rows sum to 140, Douze 90 (players.pred_points says 500, ignored).
    await db.exec(`
      insert into public.predictions (room_id, player_id, top5, worst5, top5_points, worst5_points) values
        ('${ROOM}', '${P(1)}', array['SE','IT','FR','GR','UA'], array['MT','CY','DE','GB','PL'], 100, 40),
        ('${ROOM}', '${P(3)}', array['SE','IT','FR','GR','UA'], array['MT','CY','DE','GB','PL'], 70, 20);
    `);
    // Quiz: Douze answered 4 right (low points), Disco 3 right (high points).
    const ans = (pid: number, q: number, ok: boolean, pts: number) =>
      `insert into public.quiz_answers (room_id, player_id, round_number, question_id, answer_index, is_correct, question_opened_at, points_awarded)
       values ('${ROOM}', '${P(pid)}', 1, ${q}, 0, ${ok}, now(), ${pts});`;
    await db.exec([
      ans(3, 1, true, 4), ans(3, 2, true, 4), ans(3, 3, true, 4), ans(3, 4, true, 4),
      ans(2, 1, true, 12), ans(2, 2, true, 12), ans(2, 3, true, 12), ans(2, 4, false, 0),
      ans(1, 1, false, 0),
    ].join('\n'));
    await asUser(db, HOST);
    await db.query(`select public.compute_winners($1)`, [ROOM]);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  const winners = async (cat: string) =>
    (await db.query<{ name: string; v: string }>(
      `select p.name, w.metric_value::text as v from public.winners w join public.players p on p.id = w.player_id
        where w.room_id = $1 and w.category = $2 order by p.name`, [ROOM, cat])).rows.map((r) => [r.name, Number(r.v)]);

  it('Πρωταθλητής: highest total_points, exited players excluded, spending counts', async () => {
    // Douze = 50 − 12 + 500 = 538 (players.pred_points counts here); Ghost 900 is exited; Spender 300 − 290.
    expect(await winners('champion')).toEqual([['Douze', 538]]);
  });

  it('Κλέφτης: most points stolen in completed duels', async () => {
    expect(await winners('thief')).toEqual([['Disco', 36]]);
  });

  it('Μονομάχος: most completed duels won, decided or not', async () => {
    expect(await winners('duelist')).toEqual([['Disco', 3]]);
  });

  it('Μάντης: highest sum of predictions.total_points', async () => {
    expect(await winners('oracle')).toEqual([['Lady Televote', 140]]);
  });

  it('Γκουρού: most correct answers (a count, not points)', async () => {
    expect(await winners('guru')).toEqual([['Douze', 4]]);
  });

  it('ties keep every co-winner and zero metrics give no title', async () => {
    await asUser(db, null);
    await db.exec(`update public.players set quiz_points = 538 + 12 - 150, duel_points = 0 where id = '${P(2)}';`);
    await db.exec(`delete from public.duels where room_id = '${ROOM}'; delete from public.quiz_answers where room_id = '${ROOM}'; delete from public.predictions where room_id = '${ROOM}';`);
    await asUser(db, HOST);
    await db.query(`select public.compute_winners($1)`, [ROOM]);
    // Disco: 400 + 0 + 0 = 400 … make an exact tie with Douze (538).
    await asUser(db, null);
    await db.exec(`update public.players set quiz_points = 538 where id = '${P(2)}';`);
    await asUser(db, HOST);
    await db.query(`select public.compute_winners($1)`, [ROOM]);
    expect(await winners('champion')).toEqual([['Disco', 538], ['Douze', 538]]);
    for (const c of ['thief', 'duelist', 'oracle', 'guru']) expect(await winners(c)).toEqual([]);
  });
});

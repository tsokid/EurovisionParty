// @vitest-environment node
// 106–108: fewer writes and pushes on the night (F3), cached security checks
// (F8), and Finalize as a few set-based statements (F9).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000106';
const U1 = 'a0000000-0000-4000-8000-000000000106';
const U2 = 'a0000000-0000-4000-8000-000000000206';
const ROOM = '10000000-0000-4000-8000-000000000106';
const ROOM_B = '10000000-0000-4000-8000-000000000206';

type Msg = { topic: string; event: string; payload: { table?: string; op?: string } };

describe('106–108 quiet writes, cached checks, set-based Finalize', () => {
  let db: PGlite;
  let p1: string;
  let p2: string;

  const sent = async (): Promise<Msg[]> =>
    (await db.query<Msg>('select topic, event, payload from realtime.sent order by n')).rows;
  const one = async <T>(sql: string): Promise<T> => (await db.query<T>(sql)).rows[0];

  beforeAll(async () => {
    db = await createDb({ upTo: '108' });
    await makeAdmin(db, ADMIN, 'admin@example.test');
    await db.exec(`
      update public.contests set stage = 'archived' where year = 2026;
      insert into public.contests (year, host_iso, city, city_slug, stage) values (2027, 'CH', 'Basel', 'basel', 'current');
      insert into public.parse_jobs (year, kind) values (2027, 'results');
      insert into public.game_entries (year, iso, in_final, final_running_order, final_place) values
        (2027, 'SE', true, 1, 1), (2027, 'GR', true, 2, 2), (2027, 'IT', true, 3, 3), (2027, 'UA', true, 4, 4),
        (2027, 'CH', true, 5, 5), (2027, 'FR', true, 6, 6), (2027, 'DE', true, 7, 7);
      insert into auth.users (id) values ('${U1}'), ('${U2}');
      insert into public.rooms (id, code, host_id, host_name, year, phase) values
        ('${ROOM}', 'QW106', '${U1}', 'h', 2027, 'voting_live'),
        ('${ROOM_B}', 'QW206', '${U2}', 'h', 2027, 'voting_live');
      insert into public.players (room_id, user_id, name, is_host) values
        ('${ROOM}', '${U1}', 'Ana', true), ('${ROOM}', '${U2}', 'Bo', false),
        ('${ROOM_B}', '${U2}', 'Cy', true);
      create schema if not exists realtime;
      create table realtime.sent (n serial, topic text, event text, payload jsonb, private boolean);
      create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
      returns void language sql as $$ insert into realtime.sent (topic, event, payload, private) values (topic, event, payload, private) $$;
    `);
    p1 = (await one<{ id: string }>("select id from public.players where name = 'Ana'")).id;
    p2 = (await one<{ id: string }>("select id from public.players where name = 'Bo'")).id;
  }, 120_000);

  afterAll(async () => { await db?.close(); });
  beforeEach(async () => { await db.exec('truncate realtime.sent'); });

  // ── 106 ──────────────────────────────────────────────────────────────
  it('a save writes the room activity at most once every 5 minutes', async () => {
    await db.exec(`update public.rooms set last_activity_at = now() - interval '1 hour' where id = '${ROOM}'`);
    await db.exec(`insert into public.predictions (room_id, player_id, top5, worst5)
                   values ('${ROOM}', '${p1}', array['SE','IT','GR','NO','CH'], array['DE','CH','FR','XX','IT'])`);
    const first = await one<{ fresh: boolean; t: string }>(
      `select last_activity_at > now() - interval '1 minute' as fresh, last_activity_at::text as t from public.rooms where id = '${ROOM}'`);
    expect(first.fresh).toBe(true);
    // A second save right after does not touch the room row again.
    await db.exec(`update public.rooms set last_activity_at = now() - interval '2 minutes' where id = '${ROOM}'`);
    await db.exec(`insert into public.predictions (room_id, player_id, top5, worst5) values ('${ROOM}', '${p2}', '{}', '{}')`);
    const second = await one<{ old: boolean }>(
      `select last_activity_at < now() - interval '1 minute' as old from public.rooms where id = '${ROOM}'`);
    expect(second.old).toBe(true);
  });

  it('phase notifications are stored but not pushed one by one; duel ones are pushed', async () => {
    await db.exec(`insert into public.notifications (room_id, player_id, type, payload) values
      ('${ROOM}', '${p1}', 'phase_changed', '{"to":"final"}'),
      ('${ROOM}', '${p1}', 'predictions_open', '{"to":"predictions_open"}'),
      ('${ROOM}', '${p1}', 'voting_live', '{"to":"voting_live"}'),
      ('${ROOM}', '${p1}', 'duel_challenge', '{}')`);
    const m = await sent();
    expect(m.map((x) => x.event)).toEqual(['notifications']);
    expect((await one<{ n: number }>(`select count(*)::int n from public.notifications where player_id = '${p1}'`)).n).toBe(4);
  });

  it('the name check runs only when the name or the status changes', async () => {
    // An exited player whose name clashes with an active one (made while
    // Ana was out of the room, so neither insert nor return was refused).
    await db.exec(`update public.players set status = 'exited' where id = '${p1}';
                   insert into auth.users (id) values ('a0000000-0000-4000-8000-000000000306');
                   insert into public.players (room_id, user_id, name, status) values
                     ('${ROOM}', 'a0000000-0000-4000-8000-000000000306', 'ana', 'exited');
                   update public.players set status = 'active' where id = '${p1}';`);
    await db.exec(`update public.players set quiz_points = 5 where name = 'ana'`);
    await expect(db.exec(`update public.players set status = 'active' where name = 'ana'`)).rejects.toThrow(/already taken/);
    await db.exec(`delete from public.players where name = 'ana'`);
  });

  it('a bulk job can mute the per-row player push for its own transaction', async () => {
    await db.exec(`begin; select set_config('app.rt_bulk', 'on', true);
                   update public.players set quiz_points = quiz_points + 1 where room_id = '${ROOM}'; commit;`);
    expect(await sent()).toEqual([]);
    await db.exec(`update public.players set quiz_points = quiz_points + 1 where id = '${p1}'`);
    expect((await sent()).map((x) => x.event)).toEqual(['players']);
  });

  // ── 107 ──────────────────────────────────────────────────────────────
  it('no public policy calls auth.uid() once per row any more (except players_select)', async () => {
    const bare = await db.query<{ policyname: string }>(
      `select policyname from pg_policies where schemaname = 'public' and policyname <> 'players_select'
         and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )auth\\.uid\\(\\)'`);
    expect(bare.rows).toEqual([]);
    const cached = await one<{ n: number }>(
      `select count(*)::int n from pg_policies where schemaname = 'public' and qual like '%SELECT auth.uid()%'`);
    expect(cached.n).toBeGreaterThan(5);
  });

  it('players(user_id) is indexed and the duplicate rooms(code) index is gone', async () => {
    const idx = (await db.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname = 'public' and indexname in ('idx_players_user', 'idx_rooms_code')`)).rows;
    expect(idx.map((r) => r.indexname)).toEqual(['idx_players_user']);
  });

  it('a player still reads only their own notifications', async () => {
    await db.exec(`insert into public.notifications (room_id, player_id, type, payload) values ('${ROOM}', '${p2}', 'duel_won', '{}')`);
    // Supabase grants table access to authenticated by default; the local
    // database has no such default.
    await db.exec('grant select on public.notifications, public.players to authenticated');
    await asUser(db, U2);
    await db.exec('set role authenticated');
    try {
      const rows = (await db.query<{ player_id: string }>('select player_id from public.notifications')).rows;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.player_id === p2)).toBe(true);
    } finally {
      await db.exec('reset role');
      await asUser(db, null);
    }
  });

  // ── 108 ──────────────────────────────────────────────────────────────
  it('Finalize scores every room in one go, pushes one refresh per room, then flips', async () => {
    await db.exec(`insert into public.predictions (room_id, player_id, top5, worst5) values
      ((select room_id from public.players where name = 'Cy'), (select id from public.players where name = 'Cy'),
       array['GR','SE','IT','UA','CH'], array['IT','UA','CH','FR','DE'])`);
    const before = await db.query<{ name: string; pred_points: number }>(
      'select name, pred_points from public.players order by name');
    await asUser(db, ADMIN);
    const n = await one<{ n: number }>('select public.finalize_contest(2027) as n');
    await asUser(db, null);
    expect(n.n).toBe(2);

    // Ana: top 50+20+20+0+50, worst 50+20+20+0+50. Bo: nothing picked.
    // Cy: top 20+20+50+50+50, worst 20+20+50+20+20.
    const preds = (await db.query<{ name: string; t5: number; w5: number; locked: boolean }>(
      `select p.name, pr.top5_points t5, pr.worst5_points w5, pr.is_locked locked
         from public.predictions pr join public.players p on p.id = pr.player_id order by p.name`)).rows;
    expect(preds).toEqual([
      { name: 'Ana', t5: 140, w5: 140, locked: true },
      { name: 'Bo', t5: 0, w5: 0, locked: true },
      { name: 'Cy', t5: 190, w5: 130, locked: true },
    ]);
    const after = (await db.query<{ name: string; pred_points: number }>(
      'select name, pred_points from public.players order by name')).rows;
    const gain = Object.fromEntries(after.map((r, i) => [r.name, r.pred_points - before.rows[i].pred_points]));
    expect(gain).toEqual({ Ana: 280, Bo: 0, Cy: 320 });

    const m = await sent();
    const refreshes = m.filter((x) => x.event === 'players');
    expect(refreshes.map((x) => x.payload.op)).toEqual(['REFRESH', 'REFRESH']);
    expect(new Set(refreshes.map((x) => x.topic))).toEqual(new Set([`room:${ROOM}`, `room:${ROOM_B}`]));
    // The flip to 'final' comes after the scores.
    const lastRefresh = Math.max(...m.map((x, i) => (x.event === 'players' ? i : -1)));
    const firstRoom = m.findIndex((x) => x.event === 'rooms');
    expect(firstRoom).toBeGreaterThan(lastRefresh);

    const phases = (await db.query<{ phase: string }>(`select phase from public.rooms where id in ('${ROOM}', '${ROOM_B}')`)).rows;
    expect(phases.every((r) => r.phase === 'final')).toBe(true);
    expect((await one<{ n: number }>(`select count(*)::int n from public.winners where room_id = '${ROOM_B}'`)).n).toBeGreaterThan(0);

    // A second run scores nothing twice.
    await asUser(db, ADMIN);
    expect((await one<{ n: number }>('select public.finalize_results(2027) as n')).n).toBe(0);
    await asUser(db, null);
    const again = (await db.query<{ pred_points: number }>('select pred_points from public.players order by name')).rows;
    expect(again.map((r) => r.pred_points)).toEqual(after.map((r) => r.pred_points));
  });
});

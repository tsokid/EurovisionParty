// @vitest-environment node
// 105: every game change is pushed once to a private Realtime channel by a
// trigger; nothing reads the write-ahead log any more.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb } from './harness';

const ROOM = '10000000-0000-4000-8000-000000000105';
const USER = 'a0000000-0000-4000-8000-000000000105';

type Msg = { topic: string; event: string; payload: { table?: string; op?: string; new?: Record<string, unknown> | null; old?: Record<string, unknown> | null } };

describe('105 game updates as Broadcast', () => {
  let db: PGlite;
  let playerId: string;

  const sent = async (): Promise<Msg[]> =>
    (await db.query<Msg>('select topic, event, payload from realtime.sent order by n')).rows;

  beforeAll(async () => {
    db = await createDb({ upTo: '105' });
    // A write before the realtime schema exists (local databases) still works.
    await db.exec(`
      insert into auth.users (id) values ('${USER}');
      insert into public.rooms (id, code, host_id, host_name, phase, password_hash, year) values
        ('${ROOM}', 'BRD105', '${USER}', 'Α', 'lobby', 'secret-hash', public.live_contest_year());
      insert into public.players (room_id, user_id, name, is_host) values ('${ROOM}', '${USER}', 'Π', true);
    `);
    playerId = (await db.query<{ id: string }>("select id from public.players where name = 'Π'")).rows[0].id;
    // A stand-in for Supabase's realtime.send that records each push.
    await db.exec(`
      create schema if not exists realtime;
      create table realtime.sent (n serial, topic text, event text, payload jsonb, private boolean);
      create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
      returns void language sql as $$ insert into realtime.sent (topic, event, payload, private) values (topic, event, payload, private) $$;
    `);
  }, 120_000);

  afterAll(async () => { await db?.close(); });
  beforeEach(async () => { await db.exec('truncate realtime.sent'); });

  it('a score change is pushed once to the room channel, privately', async () => {
    await db.exec(`update public.players set quiz_points = 30 where id = '${playerId}'`);
    const m = await sent();
    expect(m).toHaveLength(1);
    expect(m[0].topic).toBe(`room:${ROOM}`);
    expect(m[0].event).toBe('players');
    expect(m[0].payload.op).toBe('UPDATE');
    expect(m[0].payload.new?.quiz_points).toBe(30);
    expect((await db.query<{ private: boolean }>('select private from realtime.sent')).rows[0].private).toBe(true);
  });

  it('an update of last_seen_at alone is not pushed', async () => {
    await db.exec(`update public.players set last_seen_at = now() where id = '${playerId}'`);
    expect(await sent()).toHaveLength(0);
  });

  it('a phase change is pushed without the password hash; activity alone is not', async () => {
    await db.exec(`update public.rooms set last_activity_at = now() - interval '1 minute' where id = '${ROOM}'`);
    expect(await sent()).toHaveLength(0);
    await db.exec(`update public.rooms set phase = 'predictions_open' where id = '${ROOM}'`);
    const m = await sent();
    expect(m).toHaveLength(1);
    expect(m[0].event).toBe('rooms');
    expect(m[0].payload.new?.phase).toBe('predictions_open');
    expect(m[0].payload.new).not.toHaveProperty('password_hash');
  });

  it('a notification goes only to that player\'s channel', async () => {
    await db.exec(`insert into public.notifications (room_id, player_id, type, payload)
                   values ('${ROOM}', '${playerId}', 'phase_change', '{}'::jsonb)`);
    const m = await sent();
    expect(m).toHaveLength(1);
    expect(m[0].topic).toBe(`player:${playerId}`);
    expect(m[0].event).toBe('notifications');
  });

  it('a player who leaves the room is pushed as a DELETE with the id', async () => {
    await db.exec(`insert into auth.users (id) values ('a0000000-0000-4000-8000-000000000205');
                   insert into public.players (room_id, user_id, name) values ('${ROOM}', 'a0000000-0000-4000-8000-000000000205', 'Χ')`);
    const other = (await db.query<{ id: string }>("select id from public.players where name = 'Χ'")).rows[0];
    await db.exec('truncate realtime.sent');
    await db.exec(`delete from public.players where id = '${other.id}'`);
    const m = await sent();
    expect(m).toHaveLength(1);
    expect(m[0].payload.op).toBe('DELETE');
    expect(m[0].payload.old?.id).toBe(other.id);
  });

  it('a failing push never fails the game write', async () => {
    await db.exec(`create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
                   returns void language plpgsql as $$ begin raise exception 'realtime down'; end $$;`);
    await db.exec(`update public.players set quiz_points = 40 where id = '${playerId}'`);
    const r = await db.query<{ quiz_points: number }>(`select quiz_points from public.players where id = '${playerId}'`);
    expect(r.rows[0].quiz_points).toBe(40);
    await db.exec(`create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
                   returns void language sql as $$ insert into realtime.sent (topic, event, payload, private) values (topic, event, payload, private) $$;`);
  });

  it('the game tables are out of the supabase_realtime publication', async () => {
    const r = await db.query<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename in ('rooms','players','notifications','duels','tie_votes','tie_vote_choices',
                           'sudden_death_rounds','sudden_death_answers','cms_documents')`);
    expect(r.rows).toEqual([]);
  });

  it('clients cannot call the push helpers', async () => {
    const r = await db.query<{ ok: boolean }>(
      "select has_function_privilege('authenticated', 'public.rt_push(text,text,jsonb)', 'execute') ok");
    expect(r.rows[0].ok).toBe(false);
  });
});

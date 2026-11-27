// @vitest-environment node
// 103 (security pack 2d): the password hash is not readable by players, anon
// writes no rooms, and the room cleanup never deletes the live year's rooms.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const PRODUCTION_GRANTS = `
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
  grant insert, update, delete on public.rooms to anon;
`;

describe('103 security pack 2d', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '102' });
    await db.exec(PRODUCTION_GRANTS);
    await db.exec(read('supabase/migrations/103_security_pack2d.sql'));
    await db.exec(`
      insert into auth.users (id) values ('a0000000-0000-4000-8000-000000000103');
      insert into public.rooms (id, code, host_id, host_name, phase, password_hash, year, last_activity_at) values
        ('10000000-0000-4000-8000-000000000103', 'OLD103', 'a0000000-0000-4000-8000-000000000103', 'Α', 'lobby', 'hash', public.live_contest_year() - 1, now() - interval '30 days'),
        ('20000000-0000-4000-8000-000000000103', 'NOW103', 'a0000000-0000-4000-8000-000000000103', 'Α', 'lobby', 'hash', public.live_contest_year(), now() - interval '30 days'),
        ('30000000-0000-4000-8000-000000000103', 'NEW103', 'a0000000-0000-4000-8000-000000000103', 'Α', 'lobby', 'hash', public.live_contest_year() - 1, now());
    `);
    await asUser(db, null);
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  const as = async (role: string, sql: string) => {
    await db.exec(`set role ${role}`);
    try { return await db.query(sql); } finally { await db.exec('reset role'); }
  };

  it('players read every room column except the password hash', async () => {
    await expect(as('authenticated', 'select password_hash from public.rooms')).rejects.toThrow(/permission denied/);
    await expect(as('authenticated', 'select * from public.rooms')).rejects.toThrow(/permission denied/);
    await expect(as('anon', 'select password_hash from public.rooms')).rejects.toThrow(/permission denied/);
    await expect(as('authenticated', 'select id, code, phase, year, last_activity_at from public.rooms')).resolves.toBeTruthy();
  });

  it('anon cannot write rooms', async () => {
    await expect(as('anon', `insert into public.rooms (code, host_name, phase, password_hash) values ('ANON03', 'x', 'lobby', '')`))
      .rejects.toThrow(/permission denied/);
    await expect(as('anon', `update public.rooms set phase = 'final'`)).rejects.toThrow(/permission denied/);
    await expect(as('anon', `delete from public.rooms`)).rejects.toThrow(/permission denied/);
  });

  it('cleanup deletes only an earlier year\'s inactive room, never the live year\'s', async () => {
    await db.query('select public.cleanup_inactive_rooms()');
    const r = await db.query<{ code: string }>(`select code from public.rooms where code like '%103' order by code`);
    expect(r.rows.map((x) => x.code)).toEqual(['NEW103', 'NOW103']);
  });

  it('triggers still fire after their functions are closed to the API roles', async () => {
    await db.exec("insert into public.players (room_id, user_id, name, is_host) values ('30000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000103', 'Π', true)");
    const r = await db.query<{ n: number }>("select count(*)::int n from public.players where room_id = '30000000-0000-4000-8000-000000000103'");
    expect(r.rows[0].n).toBe(1);
    const can = await db.query<{ ok: boolean }>("select has_function_privilege('anon', 'public.touch_room_activity()', 'EXECUTE') ok");
    expect(can.rows[0].ok).toBe(false);
  });

  it('players cannot run the cleanup', async () => {
    await expect(as('authenticated', 'select public.cleanup_inactive_rooms()')).rejects.toThrow(/permission denied/);
  });

  it('the rollback applies', async () => {
    await db.exec(read('supabase/rollbacks/103_security_pack2d_rollback.sql'));
    await expect(as('authenticated', 'select password_hash from public.rooms')).resolves.toBeTruthy();
  });
});

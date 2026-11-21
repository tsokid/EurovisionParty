// @vitest-environment node
// 082: player_secrets RLS. Runs supabase/tests/082_player_identity.test.sql
// (plain SQL that raises on the first failed check) against PGlite with every
// migration applied, then checks the schema shape the app relies on.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL_TEST = path.resolve(here, '../../supabase/tests/082_player_identity.test.sql');

describe('082 player identity', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await asUser(db, null); // auth.uid() then reads request.jwt.claims
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('the SQL RLS proof passes and leaves nothing behind', async () => {
    await db.exec(readFileSync(SQL_TEST, 'utf8'));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.player_secrets`);
    expect(left.rows[0].n).toBe(0);
    const rooms = await db.query<{ n: number }>(`select count(*)::int as n from public.rooms where code in ('RLS082', 'RLS083')`);
    expect(rooms.rows[0].n).toBe(0);
  });

  it('a failing check makes the script raise', async () => {
    const broken = readFileSync(SQL_TEST, 'utf8').replace(
      `'B (member) reads A before final');`,
      `'B (member) reads A before final');\nselect pg_temp.expect_rows($q$select 1$q$, 0, 'deliberate');`,
    );
    await expect(db.exec(broken)).rejects.toThrow(/FAIL deliberate/);
    await db.exec('rollback; reset role;').catch(() => undefined);
  });

  it('players.avatar_id exists; player_secrets is not in the realtime publication', async () => {
    const col = await db.query(
      `select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'avatar_id'`,
    );
    expect(col.rows).toHaveLength(1);
    const pub = await db.query(
      `select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'player_secrets'`,
    );
    expect(pub.rows).toHaveLength(0);
  });

  it('real_name must be 1–50 non-blank characters', async () => {
    await db.exec(`
      insert into auth.users (id) values ('f0000000-0000-4000-8000-00000000000f') on conflict do nothing;
      insert into public.rooms (id, code, host_id, host_name) values ('30000000-0000-4000-8000-000000000003', 'LEN082', 'f0000000-0000-4000-8000-00000000000f', 'X');
      insert into public.players (id, room_id, user_id, name) values ('ffffffff-0000-4000-8000-00000000000f', '30000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-00000000000f', 'X');
    `);
    await expect(db.query(`insert into public.player_secrets values ('ffffffff-0000-4000-8000-00000000000f', '   ')`)).rejects.toThrow();
    await expect(db.query(`insert into public.player_secrets values ('ffffffff-0000-4000-8000-00000000000f', $1)`, ['x'.repeat(51)])).rejects.toThrow();
    await db.query(`insert into public.player_secrets (player_id, real_name) values ('ffffffff-0000-4000-8000-00000000000f', 'Ά')`);
  });
});

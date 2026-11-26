// @vitest-environment node
// 095: join_room checks the password on the server, limits failed attempts,
// one row per user per room, is_host from the room.
// Runs supabase/tests/095_join_room.test.sql.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL_TEST = path.resolve(here, '../../supabase/tests/095_join_room.test.sql');

describe('095 join_room', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await asUser(db, null);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('the SQL proof passes and leaves nothing behind', async () => {
    await db.exec(readFileSync(SQL_TEST, 'utf8'));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.rooms where code = 'JRM095'`);
    expect(left.rows[0].n).toBe(0);
  });
});

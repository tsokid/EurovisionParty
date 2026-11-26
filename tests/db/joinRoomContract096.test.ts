// @vitest-environment node
// 096: guests can't insert their players row directly; hosts can (own room);
// join_room still admits guests. Runs supabase/tests/096_join_room_contract.test.sql.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL_TEST = path.resolve(here, '../../supabase/tests/096_join_room_contract.test.sql');

describe('096 join_room contract', () => {
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
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.rooms where code in ('JRC096', 'JRC097')`);
    expect(left.rows[0].n).toBe(0);
  });
});

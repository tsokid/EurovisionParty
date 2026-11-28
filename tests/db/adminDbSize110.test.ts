// @vitest-environment node
// 110: the admin overview reads the database size; nobody else can.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000110';
const PLAYER = 'a0000000-0000-4000-8000-000000000110';

describe('110 admin_db_size', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createDb({ upTo: '110' });
    await makeAdmin(db, ADMIN, 'admin@example.test');
    await db.query(`insert into auth.users (id) values ($1)`, [PLAYER]);
  }, 120_000);
  afterAll(async () => { await db?.close(); });

  it('a super admin gets the size in bytes', async () => {
    await asUser(db, ADMIN);
    const r = await db.query<{ n: string }>('select public.admin_db_size()::text as n');
    expect(Number(r.rows[0].n)).toBeGreaterThan(0);
  });

  it('anyone else is refused', async () => {
    await asUser(db, PLAYER);
    await expect(db.query('select public.admin_db_size()')).rejects.toThrow(/forbidden/);
    await asUser(db, null);
  });

  it('the anonymous role cannot even call it', async () => {
    const r = await db.query<{ ok: boolean }>("select has_function_privilege('anon', 'public.admin_db_size()', 'execute') ok");
    expect(r.rows[0].ok).toBe(false);
  });
});

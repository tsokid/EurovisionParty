// @vitest-environment node
// 097 (security pack 2a). The database is built up to 096, given the broad
// table grants production has, then 097 is applied, so every refusal in the
// SQL proof is 097's doing. Also checks that the rollback applies cleanly.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

// Supabase grants these to the API roles by default; the harness does not.
const PRODUCTION_GRANTS = `
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
  grant insert, update on public.notifications, public.quiz_answers to anon;
`;

describe('097 security pack 2a', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '096' });
    await db.exec(PRODUCTION_GRANTS);
    await db.exec(read('supabase/migrations/097_security_pack2a.sql'));
    await asUser(db, null);
  }, 90_000);

  afterAll(async () => {
    await db?.close();
  });

  it('the SQL proof passes and leaves nothing behind', async () => {
    await db.exec(read('supabase/tests/097_security_pack2a.test.sql'));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.rooms where code like 'SEC09%'`);
    expect(left.rows[0].n).toBe(0);
  });

  it('the rollback applies, then 097 applies again', async () => {
    await db.exec(read('supabase/rollbacks/097_security_pack2a_rollback.sql'));
    const back = await db.query<{ ok: boolean }>(
      `select has_function_privilege('anon', 'public.verify_room_password(character varying, text)', 'EXECUTE') as ok`);
    expect(back.rows[0].ok).toBe(true);
    await db.exec(read('supabase/migrations/097_security_pack2a.sql'));
    const again = await db.query<{ ok: boolean }>(
      `select has_function_privilege('anon', 'public.verify_room_password(character varying, text)', 'EXECUTE') as ok`);
    expect(again.rows[0].ok).toBe(false);
  });
});

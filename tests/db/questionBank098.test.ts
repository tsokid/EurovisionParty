// @vitest-environment node
// 098 (question bank). The database is built up to 097, given the broad
// table grants production has, then 098 is applied, so every refusal in the
// SQL proof is 098's doing. Also checks that the rollback applies cleanly.
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
`;

describe('098 question bank', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '097' });
    await db.exec(PRODUCTION_GRANTS);
    await db.exec(read('supabase/migrations/098_question_bank.sql'));
    await asUser(db, null);
  }, 90_000);

  afterAll(async () => {
    await db?.close();
  });

  it('the SQL proof passes', async () => {
    await db.exec(read('supabase/tests/098_question_bank.test.sql'));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.quiz_questions where id >= 90001 or fact ilike '2090%'`);
    expect(left.rows[0].n).toBe(0);
  });

  it('existing id + flag rows survive 098 and scoring still reads them', async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.quiz_questions where question_en is null`);
    expect(r.rows[0].n).toBeGreaterThan(0);
  });

  it('the rollback applies, then 098 applies again', async () => {
    await db.exec(read('supabase/rollbacks/098_question_bank_rollback.sql'));
    const gone = await db.query<{ n: number }>(
      `select count(*)::int as n from information_schema.columns where table_name = 'quiz_questions' and column_name = 'fact'`);
    expect(gone.rows[0].n).toBe(0);
    await db.exec(read('supabase/migrations/098_question_bank.sql'));
    const back = await db.query<{ n: number }>(
      `select count(*)::int as n from information_schema.columns where table_name = 'quiz_questions' and column_name = 'fact'`);
    expect(back.rows[0].n).toBe(1);
  });
});

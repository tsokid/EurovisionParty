// @vitest-environment node
// 099 (the server serves and scores every question). The database is built
// up to 098, given the broad table grants production has, then 099 is
// applied, so every refusal in the SQL proof is 099's doing. Also checks
// that the rollback applies cleanly.
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
  grant insert, update on public.notifications to anon;
`;

describe('099 question serving', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '098' });
    await db.exec(PRODUCTION_GRANTS);
    // 097 narrowed duels and quiz tables; re-apply it over the broad grants, as production has it.
    await db.exec(read('supabase/migrations/097_security_pack2a.sql'));
    await db.exec(read('supabase/migrations/098_question_bank.sql'));
    await db.exec(read('supabase/migrations/099_question_serving.sql'));
    await asUser(db, null);
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it('the SQL proof passes and leaves nothing behind', async () => {
    await db.exec(read('supabase/tests/099_question_serving.test.sql'));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.rooms where code = 'SRV099'`);
    expect(left.rows[0].n).toBe(0);
  });

  it('the rollback applies, then 099 applies again', async () => {
    await db.exec(read('supabase/rollbacks/099_question_serving_rollback.sql'));
    const gone = await db.query<{ n: number }>(`select count(*)::int as n from pg_tables where tablename = 'question_serves'`);
    expect(gone.rows[0].n).toBe(0);
    await db.exec(read('supabase/migrations/099_question_serving.sql'));
    const back = await db.query<{ n: number }>(`select count(*)::int as n from pg_tables where tablename = 'question_serves'`);
    expect(back.rows[0].n).toBe(1);
  });
});

describe('100 question serving contract', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createDb({ upTo: '099' });
    await db.exec(PRODUCTION_GRANTS);
    await db.exec(read('supabase/migrations/100_question_serving_contract.sql'));
  }, 120_000);
  afterAll(async () => { await db?.close(); });

  const canRun = async (sig: string) => (await db.query<{ ok: boolean }>(
    `select has_function_privilege('authenticated', '${sig}', 'EXECUTE') as ok`)).rows[0].ok;
  const QUIZ = 'public.submit_quiz_answer(uuid, uuid, integer, integer, integer, boolean, timestamp with time zone, integer)';
  const DUEL = 'public.submit_duel_answers(uuid, uuid, jsonb, integer, integer[])';

  it('closes the old answer paths and keeps the served ones', async () => {
    expect(await canRun(QUIZ)).toBe(false);
    expect(await canRun(DUEL)).toBe(false);
    expect(await canRun('public.quiz_answer(uuid, integer)')).toBe(true);
    expect(await canRun('public.duel_answer(uuid, integer)')).toBe(true);
  });

  it('the rollback reopens them', async () => {
    await db.exec(read('supabase/rollbacks/100_question_serving_contract_rollback.sql'));
    expect(await canRun(QUIZ)).toBe(true);
    expect(await canRun(DUEL)).toBe(true);
  });
});

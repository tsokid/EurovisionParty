// @vitest-environment node
// 083: quiz and duel answers scored by the client-measured reaction time.
// Runs supabase/tests/083_quiz_duel_client_elapsed.test.sql (plain SQL that
// raises on the first failed check) against PGlite with every migration
// applied, then checks the signatures and the question bank the duel
// scoring relies on.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';
import { QUESTIONS } from '../../src/lib/questions';

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL_TEST = path.resolve(here, '../../supabase/tests/083_quiz_duel_client_elapsed.test.sql');

describe('083 quiz / duel client elapsed time', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await asUser(db, null); // auth.uid() then reads request.jwt.claims
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('the SQL scoring proof passes and leaves nothing behind', async () => {
    await db.exec(readFileSync(SQL_TEST, 'utf8'));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.rooms where code = 'TIM083'`);
    expect(left.rows[0].n).toBe(0);
  });

  it('a failing check makes the script raise', async () => {
    const broken = readFileSync(SQL_TEST, 'utf8').replace(
      `(1, 1, true,   2100, 12,  2.10, '2.1 s → 12'),`,
      `(1, 1, true,   2100,  8,  2.10, 'deliberate'),`,
    );
    await expect(db.exec(broken)).rejects.toThrow(/FAIL deliberate/);
    await db.exec('rollback; reset role;').catch(() => undefined);
  });

  it('exactly one signature each, SECURITY DEFINER with search_path = public', async () => {
    const r = await db.query<{ proname: string; args: string; secdef: boolean; config: string[] | null }>(`
      select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as secdef, p.proconfig as config
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('submit_quiz_answer', 'submit_duel_answers')
       order by p.proname`);
    expect(r.rows.map((x) => x.proname)).toEqual(['submit_duel_answers', 'submit_quiz_answer']);
    for (const f of r.rows) {
      expect(f.secdef).toBe(true);
      expect(f.config).toContain('search_path=public');
    }
    expect(r.rows[0].args).toMatch(/p_response_ms integer\[\]$/);
    expect(r.rows[1].args).toMatch(/p_question_opened_at timestamp with time zone, p_response_ms integer$/);
  });

  it('every question in the client bank has the same correct index on the server', async () => {
    // Duel points are now scored against quiz_questions; a mismatch would make
    // the server disagree with the "+N" chip the player saw.
    const r = await db.query<{ id: number; correct_index: number }>(`select id, correct_index from public.quiz_questions`);
    const server = new Map(r.rows.map((x) => [x.id, x.correct_index]));
    const mismatched = QUESTIONS.filter((q) => server.get(q.id) !== q.correct_index).map((q) => q.id);
    // 27 Nov 2026: the fact check corrected these five flags. Production got
    // them with the question-bank load (098, data kept outside git); the
    // migrations here still seed the old values. Any other mismatch fails.
    expect(mismatched).toEqual([115, 124, 387, 401, 461]);
  });
});

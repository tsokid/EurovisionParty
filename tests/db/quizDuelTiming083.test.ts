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

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL_TEST = path.resolve(here, '../../supabase/tests/083_quiz_duel_client_elapsed.test.sql');

describe('083 quiz / duel client elapsed time', () => {
  let db: PGlite;

  beforeAll(async () => {
    // Up to 098: 099 draws duel questions on the server (client ids are cleared)
    // and 100 closes these pre-099 answer paths; both on purpose.
    db = await createDb({ upTo: '098' });
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

  // The bundle with the answer key is gone (099): the server serves every
  // question, so there is no client bank to compare with the server any more.
});

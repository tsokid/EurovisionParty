// @vitest-environment node
// 084: scoring RPC caller checks, duel question binding, server-owned
// players / duels columns and frozen picks outside predictions_open.
// Runs supabase/tests/084_scoring_rpc_caller_checks.test.sql (plain SQL that
// raises on the first failed check) against PGlite with every migration.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL_TEST = path.resolve(here, '../../supabase/tests/084_scoring_rpc_caller_checks.test.sql');

describe('084 scoring RPC caller checks', () => {
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

  it('the SQL proof passes and leaves nothing behind', async () => {
    await db.exec(readFileSync(SQL_TEST, 'utf8'));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.rooms where code in ('SEC084', 'SEC085')`);
    expect(left.rows[0].n).toBe(0);
  });

  it('a failing check makes the script raise', async () => {
    const broken = readFileSync(SQL_TEST, 'utf8').replace(
      `'12', 'quiz: A answers as A');`,
      `'8', 'deliberate');`,
    );
    await expect(db.exec(broken)).rejects.toThrow(/FAIL deliberate/);
    await db.exec('rollback; reset role;').catch(() => undefined);
  });

  it('the three scoring RPCs keep one signature each, SECURITY DEFINER, search_path pinned', async () => {
    const r = await db.query<{ proname: string; n: number; secdef: boolean; config: string[] | null }>(`
      select p.proname, count(*) over (partition by p.proname)::int as n, p.prosecdef as secdef, p.proconfig as config
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname in ('submit_quiz_answer', 'submit_duel_answers', 'apply_duel_decision')
       order by p.proname`);
    expect(r.rows.map((x) => x.proname)).toEqual(['apply_duel_decision', 'submit_duel_answers', 'submit_quiz_answer']);
    for (const f of r.rows) {
      expect(f.n).toBe(1);
      expect(f.secdef).toBe(true);
      expect(f.config).toContain('search_path=public');
    }
  });
});

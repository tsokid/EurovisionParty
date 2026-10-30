// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb } from './harness';

describe('migration 072: old 2026 tables dropped', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createDb();
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  it('old tables are gone', async () => {
    const r = await db.query<{ p: string | null; r: string | null }>(
      `select to_regclass('public.eurovision_2026_participants')::text as p,
              to_regclass('public.eurovision_2026_results')::text as r`,
    );
    expect(r.rows[0]).toEqual({ p: null, r: null });
  });

  it('no live public function references the old tables', async () => {
    const r = await db.query<{ proname: string }>(
      `select p.proname from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosrc like '%eurovision\_2026\_%'`,
    );
    expect(r.rows.map((x) => x.proname)).toEqual([]);
  });
});

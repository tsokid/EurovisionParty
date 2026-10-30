// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin, applyMigration } from './harness';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

async function tableExists(db: PGlite, name: string): Promise<boolean> {
  const r = await db.query<{ t: string | null }>(`select to_regclass($1)::text as t`, [`public.${name}`]);
  return r.rows[0].t !== null;
}

async function functionExists(db: PGlite, name: string): Promise<boolean> {
  const r = await db.query<{ n: number }>(
    `select count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname = $1`,
    [name],
  );
  return r.rows[0].n > 0;
}

describe('PGlite migration harness', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('applies every migration', async () => {
    // 069 is the last migration; its revoke ran only if everything before it did.
    expect(await tableExists(db, 'eurovision_2026_participants')).toBe(true);
    expect(await functionExists(db, 'compute_winners')).toBe(true);
  });

  it('auth.uid follows asUser', async () => {
    await asUser(db, A);
    expect((await db.query<{ u: string }>('select auth.uid()::text as u')).rows[0].u).toBe(A);
    await asUser(db, null);
    expect((await db.query<{ u: string | null }>('select auth.uid()::text as u')).rows[0].u).toBeNull();
  });

  it('is_super_admin true only for admins', async () => {
    await makeAdmin(db, A, 'admin-a@example.test');
    await asUser(db, A);
    expect((await db.query<{ v: boolean }>('select public.is_super_admin() as v')).rows[0].v).toBe(true);
    await asUser(db, B);
    expect((await db.query<{ v: boolean }>('select public.is_super_admin() as v')).rows[0].v).toBe(false);
    await asUser(db, null);
  });
});

describe('partial migration runs', () => {
  it('upTo stops early', async () => {
    const db = await createDb({ upTo: '020' });
    try {
      expect(await tableExists(db, 'eurovision_2026_live')).toBe(true);
      expect(await tableExists(db, 'contests')).toBe(false);
      // 021_parser_split renames _live to _participants; it must not have run.
      expect(await tableExists(db, 'eurovision_2026_participants')).toBe(false);
    } finally {
      await db.close();
    }
  }, 60_000);

  it('applyMigration applies a single file on top of upTo', async () => {
    const db = await createDb({ upTo: '019' });
    try {
      // 019 runs, 019b (alphabetically after 019_) does not.
      expect(await tableExists(db, 'winners')).toBe(true);
      expect(await functionExists(db, 'open_sudden_death')).toBe(false);
      await applyMigration(db, '019b');
      expect(await functionExists(db, 'open_sudden_death')).toBe(true);
    } finally {
      await db.close();
    }
  }, 60_000);

  it('applyMigration rejects an ambiguous or unknown prefix', async () => {
    const db = await createDb({ upTo: '001' });
    try {
      await expect(applyMigration(db, '021')).rejects.toThrow(/ambiguous|2 migrations/i);
      await expect(applyMigration(db, '999')).rejects.toThrow(/no migration/i);
    } finally {
      await db.close();
    }
  }, 60_000);
});

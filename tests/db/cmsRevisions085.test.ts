// @vitest-environment node
// 085 + 087: the CMS history and the editors' read access. Runs
// supabase/tests/085_087_cms_revisions.test.sql (plain SQL that raises on the
// first failed check) in PGlite with every migration applied, then checks
// the seed of existing drafts and that both migrations run twice.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { applyMigration, asUser, createDb } from './harness';

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL_TEST = path.resolve(here, '../../supabase/tests/085_087_cms_revisions.test.sql');

describe('085 cms_revisions + 087 read RLS', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await asUser(db, null); // auth.uid() then reads request.jwt.claims
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it('the SQL proof passes and leaves nothing behind', async () => {
    await db.exec(readFileSync(SQL_TEST, 'utf8'));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.cms_revisions where doc_id like 't085-%'`);
    expect(left.rows[0].n).toBe(0);
  });

  it('a failing check makes the script raise', async () => {
    const broken = readFileSync(SQL_TEST, 'utf8').replace(
      `'first save opens a checkpoint');`,
      `'first save opens a checkpoint');\nselect pg_temp.expect_rows($q$select 1$q$, 0, 'deliberate');`,
    );
    await expect(db.exec(broken)).rejects.toThrow(/FAIL deliberate/);
    await db.exec('rollback');
  });

  it('both migrations run twice without error', async () => {
    await applyMigration(db, '085');
    await applyMigration(db, '087');
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cms_documents'`,
    );
    expect(r.rows[0].n).toBe(1);
  });
});

describe('085 seeds the drafts that exist when it runs', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '084' });
    await db.exec(`insert into public.cms_documents (doc_id, doc_type, data) values ('faq', 'faq', '{"en":{"a":1},"el":{"a":2}}')`);
    await applyMigration(db, '085');
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it('one seed revision per draft, with its data; a second run adds none', async () => {
    const q = () => db.query<{ kind: string; data: unknown }>(`select kind, data from public.cms_revisions where doc_id = 'faq'`);
    expect((await q()).rows).toEqual([{ kind: 'seed', data: { en: { a: 1 }, el: { a: 2 } } }]);
    await applyMigration(db, '085');
    expect((await q()).rows).toHaveLength(1);
  });
});

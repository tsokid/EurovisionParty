// @vitest-environment node
// 089: the avatars library. Runs supabase/tests/089_avatars_library.test.sql
// (plain SQL that raises on the first failed check) against PGlite with every
// migration applied: anon sees only published rows, a non-admin cannot
// write, an admin can; usage, reorder and purge. Then the schema shape.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, applyMigration, makeAdmin } from './harness';
import { IMAGE_AVATARS } from '../../src/components/stage/avatars/images.generated';

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL_TEST = path.resolve(here, '../../supabase/tests/089_avatars_library.test.sql');

describe('089 avatars library', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await asUser(db, null); // auth.uid() then reads request.jwt.claims
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it('the SQL RLS proof passes and leaves nothing behind', async () => {
    await db.exec(readFileSync(SQL_TEST, 'utf8'));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.avatars where id like 't089-%'`);
    expect(left.rows[0].n).toBe(0);
  });

  it('a failing check makes the script raise', async () => {
    const broken = readFileSync(SQL_TEST, 'utf8').replace(
      `'anon sees t089-pub');`,
      `'anon sees t089-pub');\nselect pg_temp.expect_rows($q$select 1$q$, 0, 'deliberate');`,
    );
    await expect(db.exec(broken)).rejects.toThrow(/FAIL deliberate/);
    await db.exec('rollback');
  });

  it('seeds every shipped owner avatar, in registry order, with its static files', async () => {
    const r = await db.query<{ id: string; thumb_path: string; full_path: string; title_el: string }>(
      `select id, thumb_path, full_path, title_el from public.avatars where deleted_at is null order by sort, id`,
    );
    expect(r.rows.map((x) => x.id)).toEqual(IMAGE_AVATARS.map((a) => a.id));
    expect(r.rows.map((x) => [x.thumb_path, x.full_path])).toEqual(IMAGE_AVATARS.map((a) => [a.thumb, a.full]));
  });

  it('players.avatar_id has no foreign key', async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from information_schema.key_column_usage k
         join information_schema.table_constraints c on c.constraint_name = k.constraint_name
        where k.table_name = 'players' and k.column_name = 'avatar_id' and c.constraint_type = 'FOREIGN KEY'`,
    );
    expect(r.rows[0].n).toBe(0);
  });

  it('refuses paths that are neither a static /avatars file nor a bucket object', async () => {
    await expect(db.query(
      `insert into public.avatars (id, title_en, thumb_path, full_path) values ('bad', 'Bad', 'https://evil.example/x.webp', 'bad-512.webp')`,
    )).rejects.toThrow(/thumb_path/);
  });

  it('final review I4: with a storage schema, an admin can delete avatar objects (remove() needs SELECT too); nobody else can', async () => {
    const ADMIN = '00000000-0000-4000-8000-000000000891';
    const STRANGER = '00000000-0000-4000-8000-000000000892';
    const sdb = await createDb({ upTo: '088' });
    try {
      // A minimal stand-in for Supabase's storage schema (as tests/db/cmsMedia.test.ts).
      await sdb.exec(`
        create schema storage;
        create table storage.buckets (
          id text primary key, name text not null, public boolean default false,
          file_size_limit bigint, allowed_mime_types text[]);
        create table storage.objects (
          id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
          name text, owner uuid);
        alter table storage.objects enable row level security;
        grant usage on schema storage to anon, authenticated, service_role;
        grant select, insert, update, delete on storage.objects to anon, authenticated;
      `);
      await makeAdmin(sdb, ADMIN, 'admin891@example.test');
      await applyMigration(sdb, '089');
      await applyMigration(sdb, '089'); // idempotent, policies included

      const pols = await sdb.query<{ policyname: string; cmd: string }>(
        `select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'avatars_%' order by cmd`);
      expect(pols.rows.map((p) => p.cmd)).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);

      // Storage's remove() is a DELETE ... WHERE name IN (...): it needs to see the rows.
      const del = () => sdb.query(`delete from storage.objects where bucket_id = 'avatars' and name in ('t-96.webp', 't-512.webp')`);
      await sdb.exec(`set role authenticated`);
      try {
        await asUser(sdb, ADMIN);
        await sdb.query(`insert into storage.objects (bucket_id, name) values ('avatars', 't-96.webp'), ('avatars', 't-512.webp')`);
        await asUser(sdb, STRANGER);
        expect((await del()).affectedRows).toBe(0);
        await asUser(sdb, ADMIN);
        expect((await del()).affectedRows).toBe(2);
      } finally {
        await sdb.exec(`reset role`);
      }
      expect((await sdb.query(`select * from storage.objects where bucket_id = 'avatars'`)).rows).toHaveLength(0);
    } finally {
      await sdb.close();
    }
  }, 120_000);
});

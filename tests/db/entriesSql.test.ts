// @vitest-environment node
// scripts/cms/entries-sql.ts: Claude's write path for public entries runs
// the CMS RPC as a super admin, all or nothing.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, makeAdmin } from './harness';
import { entriesSql, validate, type EntriesFile } from '../../scripts/cms/entries-sql';

const ADMIN = '00000000-0000-4000-8000-000000000001';

describe('entries-sql', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin@example.test');
    await db.exec(`
      update public.contests set stage = 'archived', archived_at = now() where year = 2026;
      insert into public.contests (year, host_iso, city, city_slug, stage) values (2027, 'BG', 'Burgas', 'burgas', 'current');
    `);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  const semis: EntriesFile = {
    year: 2027,
    entries: [
      { iso: 'GR', fields: { artist: "Akylas O'Neil", song: 'Ferto', semi: 1, semi_running_order: 4, semi_place: 2, semi_points: 180, qualified: true } },
      { iso: 'MD', fields: { semi: 1, semi_running_order: 9, semi_place: 14, semi_points: 20, qualified: false } },
    ],
  };

  it('writes the semi-final data through upsert_contest_entry as the admin', async () => {
    await db.exec(entriesSql(semis, 'admin@example.test'));
    const r = await db.query(
      `select iso, artist, semi, semi_running_order, semi_place, semi_points, qualified, in_final
         from public.contest_entries where year = 2027 order by iso`,
    );
    expect(r.rows).toEqual([
      { iso: 'GR', artist: "Akylas O'Neil", semi: 1, semi_running_order: 4, semi_place: 2, semi_points: 180, qualified: true, in_final: false },
      { iso: 'MD', artist: null, semi: 1, semi_running_order: 9, semi_place: 14, semi_points: 20, qualified: false, in_final: false },
    ]);
  });

  it('writes nothing when one row is refused (all or nothing)', async () => {
    const bad: EntriesFile = { year: 2027, entries: [{ iso: 'SE', fields: { semi: 2 } }, { iso: 'ZZ', fields: { semi: 2 } }] };
    await expect(db.exec(entriesSql(bad, 'admin@example.test'))).rejects.toThrow();
    await db.exec('rollback');
    expect((await db.query(`select 1 from public.contest_entries where year = 2027 and iso = 'SE'`)).rows).toEqual([]);
  });

  it('refuses an unknown email: not a super admin', async () => {
    await expect(db.exec(entriesSql(semis, 'nobody@example.test'))).rejects.toThrow(/not a super admin/);
    await db.exec('rollback');
  });

  it('validates the file before any SQL', () => {
    expect(() => validate({ year: 2027, entries: [{ iso: 'gr', fields: { semi: 1 } }] })).toThrow(/bad iso/);
    expect(() => validate({ year: 2027, entries: [{ iso: 'GR', fields: { colour: 'blue' } }] })).toThrow(/unknown field colour/);
    expect(() => validate({ year: 2027, entries: [{ iso: 'GR', fields: { semi: 1 } }, { iso: 'GR', fields: { semi: 2 } }] })).toThrow(/duplicate/);
    expect(() => entriesSql(semis, "x' or 1=1 --@y")).toThrow(/bad email/);
  });
});

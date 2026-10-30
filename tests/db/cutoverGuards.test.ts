// @vitest-environment node
// Final-review I2: cutover data guards in 070 (before the 2026 copy) and 072
// (before dropping the old tables), and 072 dropping without cascade.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, applyMigration, seed2026Lineup } from './harness';

describe('070 guard: old 2026 lineup must look like a grand final', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '069' });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  const contestsTable = async () =>
    (await db.query<{ t: string | null }>(`select to_regclass('public.contests')::text as t`)).rows[0].t;

  it('raises on an empty participants table and creates nothing', async () => {
    await expect(applyMigration(db, '070')).rejects.toThrow(/eurovision_2026_participants has 0 rows; expected 20-30/);
    await db.exec(`rollback`);
    expect(await contestsTable()).toBeNull();
  });

  it('raises on an ISO missing from the countries seed, listing every unknown one', async () => {
    await seed2026Lineup(db, 23);
    await db.exec(`
      insert into public.eurovision_2026_participants (iso, name, artist, song, source) values
        ('XX', 'Nowhere', 'A', 'S', 'parser'),
        ('QQ', 'Elsewhere', 'B', 'T', 'parser');
    `);
    await expect(applyMigration(db, '070')).rejects.toThrow(/unknown ISO.*QQ, XX/);
    await db.exec(`rollback`);
    expect(await contestsTable()).toBeNull();
  });

  it('passes on a 25-row lineup of known ISOs', async () => {
    await db.exec(`delete from public.eurovision_2026_participants where iso in ('XX', 'QQ')`);
    await seed2026Lineup(db, 25);
    await applyMigration(db, '070');
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.contest_entries where year = 2026 and in_final`);
    expect(r.rows[0].n).toBe(25);
  });
});

describe('072 guard: copy must match before the old tables are dropped', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '071' });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  const oldTables = async () =>
    (
      await db.query<{ p: string | null; r: string | null }>(
        `select to_regclass('public.eurovision_2026_participants')::text as p,
                to_regclass('public.eurovision_2026_results')::text as r`,
      )
    ).rows[0];

  it('raises when the finalist count differs and keeps both tables', async () => {
    await db.exec(`update public.contest_entries set in_final = false where year = 2026 and iso = (
                     select min(iso) from public.contest_entries where year = 2026 and in_final)`);
    await expect(applyMigration(db, '072')).rejects.toThrow(/2026 finalists in contest_entries: 24; old participants: 25/);
    await db.exec(`rollback`);
    expect(await oldTables()).toEqual({ p: 'eurovision_2026_participants', r: 'eurovision_2026_results' });
    await db.exec(`update public.contest_entries set in_final = true where year = 2026 and source <> 'manual'`);
  });

  it('raises when the result count differs', async () => {
    const iso = (await db.query<{ iso: string }>(`select min(iso) as iso from public.eurovision_2026_participants`)).rows[0].iso;
    await db.query(
      `insert into public.eurovision_2026_results (iso, ranking, total_points, jury_points, televote_points, source)
       values ($1, 1, 400, 200, 200, 'parser')`,
      [iso],
    );
    await expect(applyMigration(db, '072')).rejects.toThrow(/2026 results in contest_entries: 0; old results: 1/);
    await db.exec(`rollback`);
    expect(await oldTables()).toEqual({ p: 'eurovision_2026_participants', r: 'eurovision_2026_results' });
    await db.exec(`delete from public.eurovision_2026_results`);
  });

  it('fails instead of cascading when a dependent view exists', async () => {
    await db.exec(`create view public.old_results_probe as select iso from public.eurovision_2026_results`);
    await expect(applyMigration(db, '072')).rejects.toThrow(/cannot drop table eurovision_2026_results because other objects depend on it/);
    await db.exec(`rollback`);
    expect(await oldTables()).toEqual({ p: 'eurovision_2026_participants', r: 'eurovision_2026_results' });
    const v = await db.query<{ v: string | null }>(`select to_regclass('public.old_results_probe')::text as v`);
    expect(v.rows[0].v).toBe('old_results_probe');
    await db.exec(`drop view public.old_results_probe`);
  });

  it('drops both tables when the counts match', async () => {
    await applyMigration(db, '072');
    expect(await oldTables()).toEqual({ p: null, r: null });
  });
});

// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, applyMigration } from './harness';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(here, '../../data/history');
const jsonEntryCount = readdirSync(DATA)
  .filter((f) => f.endsWith('.json'))
  .reduce((n, f) => n + JSON.parse(readFileSync(path.join(DATA, f), 'utf8')).entries.length, 0);

async function snapshot2026(db: PGlite) {
  const c = await db.query(`select to_jsonb(c) - 'updated_at' as row from public.contests c where year = 2026`);
  const e = await db.query(
    `select coalesce(jsonb_agg(to_jsonb(e) - 'updated_at' order by iso), '[]'::jsonb) as rows
       from public.contest_entries e where year = 2026`,
  );
  return { contest: c.rows, entries: e.rows };
}

async function fingerprint(db: PGlite) {
  const r = await db.query<{ contests: string; entries: string }>(`
    select (select md5(string_agg((to_jsonb(c) - 'updated_at')::text, ',' order by year))
              from public.contests c) as contests,
           (select md5(string_agg((to_jsonb(e) - 'updated_at')::text, ',' order by year, iso))
              from public.contest_entries e) as entries`);
  return r.rows[0];
}

describe('073 history import', () => {
  let db: PGlite;
  let before2026: Awaited<ReturnType<typeof snapshot2026>>;

  beforeAll(async () => {
    db = await createDb({ upTo: '072' });
    before2026 = await snapshot2026(db);
    // Plain migration inserts: app.writer is unset, so 071's parser guard
    // does not apply.
    await applyMigration(db, '073');
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('creates 70 archived, non-indexable contests 1956–2025', async () => {
    const r = await db.query<{ n: number; lo: number; hi: number; idx: number }>(
      `select count(*)::int as n, min(year) as lo, max(year) as hi, count(*) filter (where indexable)::int as idx
         from public.contests where stage = 'archived'`,
    );
    expect(r.rows[0]).toEqual({ n: 70, lo: 1956, hi: 2025, idx: 0 });
  });

  it('inserts every entry from data/history with source import:wikipedia', async () => {
    const r = await db.query<{ n: number; other: number }>(
      `select count(*)::int as n, count(*) filter (where source <> 'import:wikipedia')::int as other
         from public.contest_entries where year <= 2025`,
    );
    expect(r.rows[0]).toEqual({ n: jsonEntryCount, other: 0 });
  });

  it('leaves 2026 unchanged', async () => {
    expect(await snapshot2026(db)).toEqual(before2026);
    const r = await db.query<{ stage: string }>(`select stage from public.contests where year = 2026`);
    expect(r.rows[0].stage).toBe('finalized');
  });

  it('stores spot-checked facts', async () => {
    const r = await db.query(
      `select iso, artist, song, final_place, total_points, jury_points, televote_points, semi, qualified
         from public.contest_entries where year = 2023 and final_place = 1`,
    );
    expect(r.rows).toEqual([
      { iso: 'SE', artist: 'Loreen', song: 'Tattoo', final_place: 1, total_points: 583, jury_points: 340, televote_points: 243, semi: 1, qualified: true },
    ]);
    const c = await db.query(`select host_iso, city, city_slug, final_date::text from public.contests where year in (2011, 2019) order by year`);
    expect(c.rows).toEqual([
      { host_iso: 'DE', city: 'Düsseldorf', city_slug: 'dusseldorf', final_date: '2011-05-14' },
      { host_iso: 'IL', city: 'Tel Aviv', city_slug: 'tel-aviv', final_date: '2019-05-18' },
    ]);
  });

  it('stores 2020 with entries and no results', async () => {
    const r = await db.query<{ n: number; results: number; finalists: number }>(
      `select count(*)::int as n,
              count(*) filter (where final_place is not null or total_points is not null or semi_points is not null)::int as results,
              count(*) filter (where in_final)::int as finalists
         from public.contest_entries where year = 2020`,
    );
    expect(r.rows[0]).toEqual({ n: 41, results: 0, finalists: 0 });
  });

  it('is a no-op when applied again', async () => {
    const before = await fingerprint(db);
    await applyMigration(db, '073');
    expect(await fingerprint(db)).toEqual(before);
  });

  it('archived years refuse parser writes afterwards', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query(`select set_config('app.writer', 'parser', true)`);
        await tx.query(`update public.contest_entries set total_points = 0 where year = 2023 and iso = 'SE'`);
      }),
    ).rejects.toThrow(/archived; parser writes refused/);
  });
});

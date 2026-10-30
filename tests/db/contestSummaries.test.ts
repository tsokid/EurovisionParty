// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000001';
const USER = '00000000-0000-4000-8000-000000000002';
const ROOM_27 = '30000000-0000-4000-8000-000000000027';

type Row = Record<string, unknown>;

describe('071 section D: contest_summaries and contest_has_rooms', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin@example.test');
    await db.query(`insert into auth.users (id, email) values ($1, 'user@example.test')`, [USER]);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  // 2025 archived (2 finalists of 3 entries), 2026 finalized (seeded by 070),
  // 2027 upcoming with one entry and one room, 2028 upcoming with nothing.
  beforeEach(async () => {
    await asUser(db, null);
    await db.exec(`
      delete from public.rooms where true;
      delete from public.contests where year >= 2027;
      delete from public.contest_entries where year in (2025, 2027);
      insert into public.contests (year, host_iso, city, city_slug, stage, final_date, indexable)
      values (2025, 'CH', 'Basel', 'basel', 'archived', '2025-05-17', true)
      on conflict (year) do update set stage = 'archived', final_date = '2025-05-17', indexable = true;
      insert into public.contest_entries (year, iso, artist, song, in_final) values
        (2025, 'AT', 'JJ', 'Wasted Love', true),
        (2025, 'IL', 'Yuval Raphael', 'New Day Will Rise', true),
        (2025, 'MD', 'X', 'Y', false);
      insert into public.contests (year, host_iso, city, city_slug, stage)
      values (2027, 'AT', 'Vienna', 'vienna', 'upcoming'),
             (2028, null, 'TBD', 'tbd', 'upcoming');
      insert into public.contest_entries (year, iso, artist, song) values (2027, 'GR', 'A', 'S');
      insert into public.rooms (id, code, host_id, host_name, year, phase)
      values ('${ROOM_27}', 'T27A', '${ADMIN}', 'h', 2027, 'lobby');
    `);
    await asUser(db, ADMIN);
  });

  it('contest_summaries returns one row per contest, newest first, with counts', async () => {
    const { rows } = await db.query<Row>(`select * from public.contest_summaries()`);
    const years = rows.map((r) => r.year);
    expect(years).toEqual([...years].sort((a, b) => (b as number) - (a as number)));
    const byYear = new Map(rows.map((r) => [r.year as number, r]));

    expect(byYear.get(2025)).toMatchObject({
      city: 'Basel',
      city_slug: 'basel',
      host_iso: 'CH',
      stage: 'archived',
      indexable: true,
      entry_count: 3,
      finalist_count: 2,
    });
    expect(byYear.get(2027)).toMatchObject({ stage: 'upcoming', entry_count: 1, finalist_count: 0 });
    expect(byYear.get(2028)).toMatchObject({ host_iso: null, entry_count: 0, finalist_count: 0 });
    const fd = byYear.get(2025)!.final_date as Date | string;
    expect(fd instanceof Date ? fd.toISOString().slice(0, 10) : fd).toBe('2025-05-17');
  });

  it('contest_has_rooms is true only for years with rooms', async () => {
    const q = async (y: number) =>
      (await db.query<{ r: boolean }>(`select public.contest_has_rooms($1) as r`, [y])).rows[0].r;
    expect(await q(2027)).toBe(true);
    expect(await q(2028)).toBe(false);
    expect(await q(2026)).toBe(false);
  });

  it.each([
    ['contest_summaries', `select * from public.contest_summaries()`],
    ['contest_has_rooms', `select public.contest_has_rooms(2027)`],
  ])('non-admin forbidden: %s', async (_name, call) => {
    for (const uid of [USER, null]) {
      await asUser(db, uid);
      await expect(db.query(call)).rejects.toThrow(/forbidden/);
    }
  });
});

// @vitest-environment node
// Final-review C1: production 2026 has no semi data (070 copies the grand
// final only). 075 backfills semi, semi_place, semi_points and qualified for
// every 2026 entry that ran in a semi-final, from data/history/2026.json.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, applyMigration } from './harness';
import { build075 } from '../../scripts/history/backfill2026Semis';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.resolve(here, '../../supabase/migrations/075_backfill_2026_semis.sql');
const JSON_2026 = JSON.parse(readFileSync(path.resolve(here, '../../data/history/2026.json'), 'utf8')) as {
  entries: { iso: string; semi: number | null; semi_place: number | null; semi_points: number | null; qualified: boolean | null }[];
};

async function counts(db: PGlite) {
  const r = await db.query<{ semi: number; in_final: number; placed: number; total: number }>(`
    select count(*) filter (where semi is not null)::int as semi,
           count(*) filter (where in_final)::int as in_final,
           count(*) filter (where final_place is not null)::int as placed,
           count(*)::int as total
      from public.contest_entries where year = 2026`);
  return r.rows[0];
}

describe('075: backfill 2026 semi-final data', () => {
  let db: PGlite;
  let before: Awaited<ReturnType<typeof counts>>;

  beforeAll(async () => {
    db = await createDb({ upTo: '074' });
    before = await counts(db);
    await applyMigration(db, '075');
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('starts from a 2026 lineup with no semi data (as production)', () => {
    expect(before.semi).toBe(0);
    expect(before.total).toBe(35);
  });

  it('sets semi on the 30 entries that ran in a semi-final', async () => {
    expect((await counts(db)).semi).toBe(30);
  });

  it('copies semi, semi_place, semi_points and qualified from data/history/2026.json', async () => {
    const r = await db.query<{ iso: string; semi: number | null; semi_place: number | null; semi_points: number | null; qualified: boolean | null }>(
      `select iso, semi, semi_place, semi_points, qualified from public.contest_entries where year = 2026 and semi is not null order by iso`,
    );
    const expected = JSON_2026.entries
      .filter((e) => e.semi !== null)
      .map(({ iso, semi, semi_place, semi_points, qualified }) => ({ iso, semi, semi_place, semi_points, qualified }))
      .sort((a, b) => (a.iso < b.iso ? -1 : 1));
    expect(r.rows).toEqual(expected);
  });

  it('leaves in_final and final_place counts unchanged (072 guard data)', async () => {
    const after = await counts(db);
    expect(after.in_final).toBe(before.in_final);
    expect(after.placed).toBe(before.placed);
    expect(after.total).toBe(before.total);
  });

  it('is idempotent: a second run changes nothing', async () => {
    const stamp = async () =>
      (await db.query<{ m: string }>(`select max(updated_at)::text as m from public.contest_entries where year = 2026`)).rows[0].m;
    const t0 = await stamp();
    await applyMigration(db, '075');
    expect((await counts(db)).semi).toBe(30);
    expect(await stamp()).toBe(t0);
  });

  it('is generated deterministically from data/history/2026.json', () => {
    // A Windows checkout (core.autocrlf) may turn LF into CRLF.
    expect(readFileSync(MIGRATION, 'utf8').replace(/\r\n/g, '\n')).toBe(build075());
  });
});

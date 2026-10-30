// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';

type Row = Record<string, unknown>;

const ALL_COLS = `iso, artist, song, language, semi, semi_running_order, semi_place, semi_points, qualified,
  in_final, final_running_order, final_place, total_points, jury_points, televote_points, source`;

/** Semi rows as rows.ts semiRows builds them: [iso, running order, place, points, qualified]. */
const semis = (year: number, semi: number, rows: [string, number, number | null, number | null, boolean | null][]) =>
  JSON.stringify(
    rows.map(([iso, ro, place, points, qualified]) => ({
      year, iso, semi, semi_running_order: ro, semi_place: place, semi_points: points, qualified, source: 'parser',
    })),
  );

describe('071 parser_upsert_entries kind semis', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  // 2026 finalized with one grand finalist (GR) carrying final results and
  // one semi-only entry (MD); 2025 archived with one entry; 2027 upcoming.
  beforeEach(async () => {
    await asUser(db, null);
    await db.exec(`
      reset role;
      delete from public.contests where year >= 2027;
      delete from public.contest_entries where year in (2025, 2026);
      insert into public.contests (year, host_iso, city, city_slug, stage)
      values (2025, 'CH', 'Basel', 'basel', 'upcoming')
      on conflict (year) do update set stage = 'upcoming', archived_at = null;
      update public.contests set stage = 'finalized', archived_at = null where year = 2026;
      insert into public.contest_entries
        (year, iso, artist, song, language, semi, semi_running_order, semi_place, semi_points, qualified,
         in_final, final_running_order, final_place, total_points, jury_points, televote_points, source) values
        (2026, 'GR', 'Akylas', 'Ferto', 'Greek', 1, 4, 3, 150, true, true, 7, 2, 300, 200, 100, 'import:test'),
        (2026, 'MD', 'Satoshi', 'Viva, Moldova!', null, null, null, null, null, null, false, null, null, null, null, null, 'manual'),
        (2025, 'AT', 'JJ', 'Wasted Love', null, null, null, null, null, null, true, 9, 1, 436, 258, 178, 'import:test');
      update public.contests set stage = 'archived', archived_at = now() where year = 2025;
    `);
  });

  /** Calls the RPC as service_role, like the edge function does. */
  async function upsert(year: number, rows: string, kind = 'semis'): Promise<number> {
    await db.exec(`set role service_role`);
    try {
      const r = await db.query<{ n: number }>(`select public.parser_upsert_entries($1, $2::jsonb, $3) as n`, [year, rows, kind]);
      return r.rows[0].n;
    } finally {
      await db.exec(`reset role`);
    }
  }

  const entries = async (year: number) =>
    (await db.query<Row>(`select ${ALL_COLS} from public.contest_entries where year = $1 order by iso`, [year])).rows;

  /** Runs sql as the parser with app.writer_kind = kind, in a transaction that is always rolled back. */
  async function asParser(kind: string, sql: string): Promise<void> {
    await db.exec(`begin`);
    try {
      await db.exec(`select set_config('app.writer', 'parser', true), set_config('app.writer_kind', '${kind}', true)`);
      await db.exec(sql);
    } finally {
      await db.exec(`rollback`);
    }
  }

  it('semis on a finalized year write only the semi columns and insert missing countries', async () => {
    const before = await entries(2026);
    const n = await upsert(2026, semis(2026, 2, [['GR', 11, 1, 210, true], ['MD', 3, 12, 20, false], ['SE', 6, 2, 190, true]]));
    expect(n).toBe(3);

    const after = await entries(2026);
    const gr = after.find((r) => r.iso === 'GR')!;
    // Semi columns and source change; artist, language, in_final, final_* and points do not.
    expect(gr).toEqual({
      ...before.find((r) => r.iso === 'GR'),
      semi: 2, semi_running_order: 11, semi_place: 1, semi_points: 210, qualified: true, source: 'parser',
    });
    expect(after.find((r) => r.iso === 'MD')).toEqual({
      ...before.find((r) => r.iso === 'MD'),
      semi: 2, semi_running_order: 3, semi_place: 12, semi_points: 20, qualified: false, source: 'parser',
    });
    // SE had no row: inserted with semi data only, not a finalist.
    expect(after.find((r) => r.iso === 'SE')).toEqual({
      iso: 'SE', artist: null, song: null, language: null,
      semi: 2, semi_running_order: 6, semi_place: 2, semi_points: 190, qualified: true,
      in_final: false, final_running_order: null, final_place: null,
      total_points: null, jury_points: null, televote_points: null, source: 'parser',
    });

    // Both settings are transaction-local.
    const s = await db.query<Row>(
      `select nullif(current_setting('app.writer', true), '') as w, nullif(current_setting('app.writer_kind', true), '') as k`,
    );
    expect(s.rows[0]).toEqual({ w: null, k: null });
  });

  it('semis on a current year work the same way', async () => {
    await db.exec(`update public.contests set stage = 'upcoming' where year = 2026;
                   insert into public.contests (year, host_iso, city, city_slug, stage) values (2027, 'CH', 'Basel', 'basel', 'current');`);
    expect(await upsert(2027, semis(2027, 1, [['UA', 5, 1, 137, true], ['AZ', 10, 15, 7, false]]))).toBe(2);
    expect((await entries(2027)).map((r) => [r.iso, r.semi, r.semi_place, r.qualified, r.in_final])).toEqual([
      ['AZ', 1, 15, false, false],
      ['UA', 1, 1, true, false],
    ]);
  });

  it('semis on an archived year are refused', async () => {
    const before = await entries(2025);
    await expect(upsert(2025, semis(2025, 1, [['AT', 1, 1, 100, true]]))).rejects.toThrow(
      /contest 2025 is archived; parser writes refused/,
    );
    await expect(upsert(2025, semis(2025, 1, [['UA', 5, 1, 137, true]]))).rejects.toThrow(/archived/);
    expect(await entries(2025)).toEqual(before);
  });

  it('other kinds stay refused on a finalized year', async () => {
    await expect(
      upsert(2026, JSON.stringify([{ iso: 'GR', artist: 'X', song: 'Y', final_running_order: 1, source: 'parser' }]), 'participants'),
    ).rejects.toThrow(/contest 2026 is finalized; parser writes refused/);
  });

  it('unknown country raises for semis', async () => {
    await expect(upsert(2026, semis(2026, 1, [['ZZ', 1, 1, 1, true]]))).rejects.toThrow(/unknown country ZZ/);
  });

  it('the guard refuses a semis write that touches anything but the semi columns', async () => {
    await expect(asParser('semis', `update public.contest_entries set in_final = false where year = 2026 and iso = 'GR'`)).rejects.toThrow(
      /semis writes may only change semi columns/,
    );
    await expect(asParser('semis', `update public.contest_entries set total_points = 1 where year = 2026 and iso = 'GR'`)).rejects.toThrow(
      /semis writes may only change semi columns/,
    );
    await expect(asParser('semis', `update public.contest_entries set artist = 'X' where year = 2026 and iso = 'MD'`)).rejects.toThrow(
      /semis writes may only change semi columns/,
    );
    await expect(
      asParser('semis', `insert into public.contest_entries (year, iso, semi, in_final) values (2026, 'SE', 1, true)`),
    ).rejects.toThrow(/semis writes may only change semi columns/);
    await expect(
      asParser('semis', `insert into public.contest_entries (year, iso, semi, artist) values (2026, 'SE', 1, 'KAJ')`),
    ).rejects.toThrow(/semis writes may only change semi columns/);
    await expect(asParser('semis', `delete from public.contest_entries where year = 2026 and iso = 'MD'`)).rejects.toThrow(
      /semis writes may only change semi columns/,
    );
    // The semi columns themselves pass.
    await expect(
      asParser('semis', `update public.contest_entries set semi_place = 9, qualified = false, source = 'parser' where year = 2026 and iso = 'GR'`),
    ).resolves.toBeUndefined();
  });

  it('the guard applies the column rule on an upcoming year too', async () => {
    await db.exec(`insert into public.contests (year, host_iso, city, city_slug, stage) values (2027, 'CH', 'Basel', 'basel', 'upcoming');
                   insert into public.contest_entries (year, iso, artist, in_final) values (2027, 'GR', 'A', true);`);
    await expect(asParser('semis', `update public.contest_entries set in_final = false where year = 2027`)).rejects.toThrow(
      /semis writes may only change semi columns/,
    );
    // Without the semis kind the parser may still write an upcoming year freely.
    await expect(asParser('participants', `update public.contest_entries set in_final = false where year = 2027`)).resolves.toBeUndefined();
  });
});

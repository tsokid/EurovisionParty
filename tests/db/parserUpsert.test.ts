// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000001';

type Row = Record<string, unknown>;

/** Participant rows for 2027 as rows.ts builds them: [iso, artist, running order]. */
const lineup = (rows: [string, string, number | null][]) =>
  JSON.stringify(
    rows.map(([iso, artist, ro]) => ({
      year: 2027, iso, artist, song: artist + ' song', final_running_order: ro, source: 'parser',
    })),
  );

describe('071 parser_upsert_entries', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin@example.test');
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  // Baseline: 2026 finalized (seeded by 070), 2027 upcoming with no entries.
  beforeEach(async () => {
    await asUser(db, null);
    await db.exec(`
      reset role;
      reset app.writer;
      delete from public.contests where year >= 2027;
      update public.contests set stage = 'finalized', archived_at = null where year = 2026;
      insert into public.contests (year, host_iso, city, city_slug, stage) values (2027, 'CH', 'Basel', 'basel', 'upcoming');
    `);
  });

  /** Calls the RPC as service_role, like the edge function does. */
  async function upsert(year: number, rows: string, kind: string): Promise<number> {
    await db.exec(`set role service_role`);
    try {
      const r = await db.query<{ n: number }>(`select public.parser_upsert_entries($1, $2::jsonb, $3) as n`, [year, rows, kind]);
      return r.rows[0].n;
    } finally {
      await db.exec(`reset role`);
    }
  }

  const entries = async (year: number) =>
    (
      await db.query<Row>(
        `select iso, artist, final_running_order, final_place, total_points, jury_points, televote_points, source
           from public.contest_entries where year = $1 order by iso`,
        [year],
      )
    ).rows;

  const blank = { final_place: null, total_points: null, jury_points: null, televote_points: null };

  it('participants upsert the lineup and return the row count', async () => {
    expect(await upsert(2027, lineup([['GR', 'Akylas', 1], ['AT', 'Cosmo', 2]]), 'participants')).toBe(2);
    expect(await entries(2027)).toEqual([
      { iso: 'AT', artist: 'Cosmo', final_running_order: 2, ...blank, source: 'parser' },
      { iso: 'GR', artist: 'Akylas', final_running_order: 1, ...blank, source: 'parser' },
    ]);
    // app.writer is transaction-local: nothing leaks into the session.
    const w = await db.query<{ w: string | null }>(`select nullif(current_setting('app.writer', true), '') as w`);
    expect(w.rows[0].w).toBeNull();
  });

  it('participants absent from a re-parse keep their rows with final_running_order null', async () => {
    await upsert(2027, lineup([['GR', 'Akylas', 1], ['AT', 'Cosmo', 2], ['SE', 'KAJ', 3]]), 'participants');
    expect(await upsert(2027, lineup([['SE', 'KAJ', 1], ['GR', 'Akylas', 2]]), 'participants')).toBe(2);
    expect((await entries(2027)).map((r) => [r.iso, r.artist, r.final_running_order])).toEqual([
      ['AT', 'Cosmo', null],
      ['GR', 'Akylas', 2],
      ['SE', 'KAJ', 1],
    ]);
  });

  it('results are written only for finalists of the year', async () => {
    await upsert(2027, lineup([['GR', 'Akylas', 1], ['AT', 'Cosmo', 2]]), 'participants');
    // MD is a semi-only entry (no final_running_order); SE has no row at all.
    await db.query(`insert into public.contest_entries (year, iso, artist, semi) values (2027, 'MD', 'M', 1)`);
    const result = (iso: string, place: number, total: number, jury: number, televote: number) => ({
      year: 2027, iso, final_place: place, total_points: total, jury_points: jury, televote_points: televote, source: 'parser',
    });
    const results = JSON.stringify([
      result('AT', 1, 436, 258, 178),
      result('GR', 2, 300, 200, 100),
      result('MD', 3, 50, 25, 25),
      result('SE', 4, 40, 20, 20),
    ]);
    expect(await upsert(2027, results, 'results')).toBe(2);
    expect(await entries(2027)).toEqual([
      { iso: 'AT', artist: 'Cosmo', final_running_order: 2, final_place: 1, total_points: 436, jury_points: 258, televote_points: 178, source: 'parser' },
      { iso: 'GR', artist: 'Akylas', final_running_order: 1, final_place: 2, total_points: 300, jury_points: 200, televote_points: 100, source: 'parser' },
      { iso: 'MD', artist: 'M', final_running_order: null, ...blank, source: null },
    ]);
  });

  it('refused after finalize', async () => {
    // The harness has no legacy 2026 lineup, so make one 2026 entry a
    // finalist (as a non-parser writer) for the results call to target.
    const iso = (await entries(2026))[0].iso as string;
    await db.query(`update public.contest_entries set final_running_order = 1 where year = 2026 and iso = $1`, [iso]);
    const before = await entries(2026);
    await expect(
      upsert(2026, JSON.stringify([{ iso, artist: 'X', song: 'Y', final_running_order: 2, source: 'parser' }]), 'participants'),
    ).rejects.toThrow(/contest 2026 is finalized; parser writes refused/);
    await expect(
      upsert(2026, JSON.stringify([{ iso, final_place: 1, total_points: 1, jury_points: 1, televote_points: 0 }]), 'results'),
    ).rejects.toThrow(/contest 2026 is finalized; parser writes refused/);
    expect(await entries(2026)).toEqual(before);
  });

  it('unknown country raises', async () => {
    await expect(upsert(2027, lineup([['GR', 'Akylas', 1], ['ZZ', 'Nobody', 2]]), 'participants')).rejects.toThrow(
      /unknown country ZZ/,
    );
    expect(await entries(2027)).toEqual([]);
  });

  it('unknown kind and mismatched row year raise', async () => {
    await expect(upsert(2027, '[]', 'lineup')).rejects.toThrow(/unknown kind lineup/);
    await expect(upsert(2027, JSON.stringify([{ year: 2026, iso: 'GR' }]), 'participants')).rejects.toThrow(
      /row year 2026 does not match 2027/,
    );
  });

  it('not executable by authenticated or anon', async () => {
    await asUser(db, ADMIN);
    for (const role of ['authenticated', 'anon']) {
      await db.exec(`set role ${role}`);
      try {
        await expect(db.query(`select public.parser_upsert_entries(2027, '[]'::jsonb, 'participants')`)).rejects.toThrow(
          /permission denied/,
        );
      } finally {
        await db.exec(`reset role`);
      }
    }
  });
});

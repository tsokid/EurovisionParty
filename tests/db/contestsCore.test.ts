// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, applyMigration, asUser } from './harness';
import { COUNTRIES_2026 } from '../../src/lib/countries2026';
import { COUNTRY_TO_ISO } from '../../supabase/functions/eurovision-parse/parse';

// Finalist fixtures as they sit in the old 2026 tables before 070 runs.
// ES is deliberately not in COUNTRIES_2026 (boycott), so the overlap is 3
// (GR, AT, DE). ES and DE have a null running_order, as the production
// parser leaves it.
const PARTICIPANTS = [
  { iso: 'GR', name: 'Greece', artist: 'Akylas', song: 'Ferto', running_order: 1, source: 'parser' },
  { iso: 'AT', name: 'Austria', artist: 'Cosmó', song: 'Tanzschein', running_order: 2, source: 'parser' },
  { iso: 'ES', name: 'Spain', artist: 'Fixture Artist', song: 'Fixture Song', running_order: null, source: 'manual' },
  { iso: 'DE', name: 'Germany', artist: 'Fixture DE', song: 'Fixture DE Song', running_order: null, source: 'parser' },
];
const RESULTS = [
  { iso: 'GR', ranking: 2, total_points: 400, jury_points: 150, televote_points: 250, source: 'manual' },
  { iso: 'AT', ranking: 1, total_points: 500, jury_points: 300, televote_points: 200, source: 'parser' },
];

type Entry = {
  iso: string;
  artist: string | null;
  song: string | null;
  in_final: boolean;
  final_running_order: number | null;
  final_place: number | null;
  total_points: number | null;
  jury_points: number | null;
  televote_points: number | null;
  qualified: boolean | null;
  source: string | null;
};

describe('070 contests core', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '069' });
    for (const p of PARTICIPANTS) {
      await db.query(
        `insert into public.eurovision_2026_participants (iso, name, artist, song, running_order, source)
         values ($1, $2, $3, $4, $5, $6)`,
        [p.iso, p.name, p.artist, p.song, p.running_order, p.source],
      );
    }
    for (const r of RESULTS) {
      await db.query(
        `insert into public.eurovision_2026_results (iso, ranking, total_points, jury_points, televote_points, source)
         values ($1, $2, $3, $4, $5, $6)`,
        [r.iso, r.ranking, r.total_points, r.jury_points, r.televote_points, r.source],
      );
    }
    await applyMigration(db, '070');
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  async function entries(): Promise<Entry[]> {
    const r = await db.query<Entry>(
      `select iso, artist, song, in_final, final_running_order, final_place, total_points, jury_points,
              televote_points, qualified, source
         from public.contest_entries where year = 2026 order by iso`,
    );
    return r.rows;
  }

  it('copies 2026 participants and results losslessly', async () => {
    const byIso = new Map((await entries()).map((e) => [e.iso, e]));
    for (const p of PARTICIPANTS) {
      const e = byIso.get(p.iso);
      const r = RESULTS.find((x) => x.iso === p.iso);
      expect(e, p.iso).toBeDefined();
      expect(e).toMatchObject({
        artist: p.artist,
        song: p.song,
        in_final: true,
        final_running_order: p.running_order,
        final_place: r?.ranking ?? null,
        total_points: r?.total_points ?? null,
        jury_points: r?.jury_points ?? null,
        televote_points: r?.televote_points ?? null,
        source: r?.source ?? p.source,
      });
    }
    expect(byIso.get('ES')!.final_place).toBeNull();
  });

  it('2026 copy marks all participants in_final even with null running_order', async () => {
    const all = await entries();
    const finalists = all.filter((e) => e.in_final).map((e) => e.iso).sort();
    expect(finalists).toEqual(PARTICIPANTS.map((p) => p.iso).sort());
    expect(all.find((e) => e.iso === 'ES')).toMatchObject({ in_final: true, final_running_order: null });
    expect(all.find((e) => e.iso === 'DE')).toMatchObject({ in_final: true, final_running_order: null });
    const lineup = await db.query<{ iso: string }>(`select iso from public.current_participants order by iso`);
    expect(lineup.rows.map((x) => x.iso)).toEqual(['AT', 'DE', 'ES', 'GR']);
  });

  it('adds non-finalist 2026 countries from COUNTRIES_2026', async () => {
    const all = await entries();
    const finalists = new Set(PARTICIPANTS.map((p) => p.iso));
    const overlap = COUNTRIES_2026.filter((c) => finalists.has(c.id)).length;
    expect(COUNTRIES_2026).toHaveLength(35);
    expect(all).toHaveLength(PARTICIPANTS.length + (35 - overlap));

    for (const c of COUNTRIES_2026.filter((x) => !finalists.has(x.id))) {
      const e = all.find((x) => x.iso === c.id);
      expect(e, c.id).toMatchObject({
        artist: c.artist,
        song: c.song,
        in_final: false,
        final_running_order: null,
        qualified: false,
        source: 'manual',
      });
    }
  });

  it('current_participants has finalists only, with names', async () => {
    const r = await db.query<{ iso: string; name_en: string | null; name_el: string | null }>(
      `select iso, name_en, name_el from public.current_participants order by final_running_order nulls last, iso`,
    );
    expect(r.rows.map((x) => x.iso)).toEqual(['GR', 'AT', 'DE', 'ES']);
    for (const row of r.rows) {
      expect(row.name_en).toBeTruthy();
      expect(row.name_el).toBeTruthy();
    }
    expect(r.rows[0]).toMatchObject({ name_en: 'Greece', name_el: 'Ελλάδα' });

    const all = await db.query<{ n: number }>(`select count(*)::int as n from public.current_entries`);
    expect(all.rows[0].n).toBe((await entries()).length);
  });

  it('one live contest', async () => {
    await expect(
      db.query(
        `insert into public.contests (year, host_iso, city, city_slug, stage)
         values (2027, 'BG', 'Sofia', 'sofia', 'current')`,
      ),
    ).rejects.toThrow(/one_live_contest|duplicate key|unique/i);

    // An upcoming year alongside the finalized one is fine.
    await db.query(`begin`);
    await db.query(
      `insert into public.contests (year, host_iso, city, city_slug) values (2027, 'BG', 'Sofia', 'sofia')`,
    );
    await db.query(`rollback`);
  });

  it('live_contest_year', async () => {
    const r = await db.query<{ y: number }>(`select public.live_contest_year() as y`);
    expect(r.rows[0].y).toBe(2026);
  });

  it('every parser ISO is a country', async () => {
    const isos = [...new Set(Object.values(COUNTRY_TO_ISO))];
    expect(isos).toHaveLength(41);
    const r = await db.query<{ iso: string }>(`select iso from public.countries where iso = any($1::text[])`, [isos]);
    expect(r.rows.map((x) => x.iso).sort()).toEqual([...isos].sort());
  });

  it('countries seed covers historical entities with symmetric related_iso', async () => {
    const r = await db.query<{ iso: string; slug: string; related_iso: string[] }>(
      `select iso, slug, related_iso from public.countries`,
    );
    const byIso = new Map(r.rows.map((x) => [x.iso, x]));
    for (const iso of ['YU', 'CS', 'MA', 'MC', 'AD', 'TR', 'SK', 'HU', 'BY', 'RU']) {
      expect(byIso.has(iso), iso).toBe(true);
    }
    for (const row of r.rows) {
      expect(row.slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
      for (const other of row.related_iso) {
        expect(byIso.get(other)?.related_iso, `${row.iso}->${other}`).toContain(row.iso);
      }
    }
    expect(byIso.get('YU')!.related_iso.sort()).toEqual(['BA', 'CS', 'HR', 'ME', 'MK', 'RS', 'SI']);
  });

  it('anon can read the three tables', async () => {
    await db.query(`set role anon`);
    try {
      const r = await db.query<{ c: number; n: number; e: number }>(
        `select (select count(*)::int from public.contests) as c,
                (select count(*)::int from public.countries) as n,
                (select count(*)::int from public.current_participants) as e`,
      );
      expect(r.rows[0].c).toBeGreaterThan(0);
      expect(r.rows[0].n).toBeGreaterThan(0);
      expect(r.rows[0].e).toBe(PARTICIPANTS.length);
      await expect(
        db.query(`insert into public.countries (iso, name_en, name_el, slug) values ('XX', 'X', 'X', 'x')`),
      ).rejects.toThrow();
    } finally {
      await db.query(`reset role`);
    }
  });

  it('rooms default year', async () => {
    const host = '00000000-0000-4000-8000-0000000000c1';
    await asUser(db, null);
    await db.query(`insert into auth.users (id, email) values ($1, 'host@example.test')`, [host]);
    const r = await db.query<{ year: number }>(
      `insert into public.rooms (code, host_id, host_name) values ('TST070', $1, 'Host') returning year`,
      [host],
    );
    expect(r.rows[0].year).toBe(2026);

    // 2026 is also the old literal default, so check the default follows the live year.
    const d = await db.query<{ d: string }>(
      `select column_default as d from information_schema.columns
        where table_schema = 'public' and table_name = 'rooms' and column_name = 'year'`,
    );
    expect(d.rows[0].d).toContain('live_contest_year()');
  });

  it('re-running 070 changes nothing', async () => {
    const snap = async () =>
      (
        await db.query<{ c: number; n: number; e: number }>(
          `select (select count(*)::int from public.contests) as c,
                  (select count(*)::int from public.countries) as n,
                  (select count(*)::int from public.contest_entries) as e`,
        )
      ).rows[0];
    const before = await snap();
    await applyMigration(db, '070');
    expect(await snap()).toEqual(before);
    expect(before.n).toBe(52);
  });
});

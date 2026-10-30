// @vitest-environment node
// Final-review fixes in 071: I1 (demoted rows never count), I3 (phase
// triggers year-scoped), M4 (semis keep an existing source), M6 (archive
// requires Y+1 upcoming).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000001';
const R26 = '30000000-0000-4000-8000-000000000026';
const R27 = '30000000-0000-4000-8000-000000000027';

type Row = Record<string, unknown>;

const lineup = (isos: string[]) =>
  JSON.stringify(
    isos.map((iso) => ({ year: 2027, iso, artist: iso + ' artist', song: iso + ' song', in_final: true, final_running_order: null, source: 'parser' })),
  );

const results = (rows: [string, number, number][]) =>
  JSON.stringify(
    rows.map(([iso, place, total]) => ({
      year: 2027, iso, final_place: place, total_points: total, jury_points: total - 100, televote_points: 100, source: 'parser',
    })),
  );

const RESULT_COLS = 'iso, in_final, final_place, total_points, jury_points, televote_points';
const NO_RESULT = { final_place: null, total_points: null, jury_points: null, televote_points: null };

describe('071 final-review fixes', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin@example.test');
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  // Baseline: 2026 archived, 2027 current with idle parse jobs, two rooms in
  // pre_night (one per year), each with an active host.
  beforeEach(async () => {
    await asUser(db, null);
    await db.exec(`
      reset role;
      delete from public.rooms where true;
      delete from public.notifications where true;
      delete from public.contests where year >= 2027;
      delete from public.parse_jobs where year >= 2027;
      update public.contests set stage = 'archived', archived_at = now() where year = 2026;
      insert into public.contests (year, host_iso, city, city_slug, stage) values (2027, 'BG', 'Burgas', 'burgas', 'current');
      insert into public.parse_jobs (year, kind, status) values (2027, 'participants', 'idle'), (2027, 'results', 'idle');

      insert into public.rooms (id, code, host_id, host_name, year, phase) values
        ('${R26}', 'F26', '${ADMIN}', 'h', 2026, 'pre_night'),
        ('${R27}', 'F27', '${ADMIN}', 'h', 2027, 'pre_night');
      insert into public.players (room_id, name, is_host) select id, 'host-' || code, true from public.rooms;
    `);
  });

  async function upsert(rows: string, kind: string): Promise<number> {
    await db.exec(`set role service_role`);
    try {
      const r = await db.query<{ n: number }>(`select public.parser_upsert_entries(2027, $1::jsonb, $2) as n`, [rows, kind]);
      return r.rows[0].n;
    } finally {
      await db.exec(`reset role`);
    }
  }

  const entry = async (iso: string) =>
    (await db.query<Row>(`select ${RESULT_COLS} from public.contest_entries where year = 2027 and iso = $1`, [iso])).rows[0];

  const phase = async (id: string) =>
    (await db.query<{ phase: string }>(`select phase from public.rooms where id = $1`, [id])).rows[0].phase;

  const notified = async (id: string) =>
    (await db.query<{ n: number }>(`select count(*)::int as n from public.notifications where room_id = $1`, [id])).rows[0].n;

  async function addPredictions(): Promise<void> {
    await db.exec(`
      insert into public.predictions (room_id, player_id, top5, worst5)
      select p.room_id, p.id, array['GR','SE'], array['SE','GR'] from public.players p where p.room_id = '${R27}';
    `);
  }

  const ranking = async () =>
    (await db.query<{ r: string[] }>(`select final_ranking as r from public.results where room_id = $1`, [R27])).rows[0]?.r;

  // ── I1 ────────────────────────────────────────────────────────────────
  describe('I1 demoted rows never count', () => {
    it('re-parse without AT after results nulls AT results and finalize_results ranks finalists only', async () => {
      await upsert(lineup(['GR', 'AT', 'SE']), 'participants');
      await upsert(results([['AT', 1, 500], ['GR', 2, 400], ['SE', 3, 300]]), 'results');
      await upsert(lineup(['GR', 'SE']), 'participants');

      expect(await entry('AT')).toEqual({ iso: 'AT', in_final: false, ...NO_RESULT });
      expect(await entry('GR')).toMatchObject({ in_final: true, final_place: 2, total_points: 400 });

      await addPredictions();
      await asUser(db, ADMIN);
      expect((await db.query<{ n: number }>(`select public.finalize_results(2027) as n`)).rows[0].n).toBe(1);
      expect(await ranking()).toEqual(['GR', 'SE']);
    });

    it('finalize_results ignores a non-finalist that carries a final_place', async () => {
      await upsert(lineup(['GR', 'SE']), 'participants');
      await upsert(results([['GR', 2, 400], ['SE', 3, 300]]), 'results');
      // A non-finalist with a place, written directly (not through an RPC).
      await db.exec(`insert into public.contest_entries (year, iso, in_final, final_place, total_points)
                     values (2027, 'MD', false, 1, 999)`);
      await addPredictions();
      await asUser(db, ADMIN);
      await db.query(`select public.finalize_results(2027)`);
      expect(await ranking()).toEqual(['GR', 'SE']);
    });

    it('finalize_contest refuses when only non-finalists have a final_place', async () => {
      await upsert(lineup(['GR', 'SE']), 'participants');
      await db.exec(`insert into public.contest_entries (year, iso, in_final, final_place) values (2027, 'MD', false, 1)`);
      await asUser(db, ADMIN);
      await expect(db.query(`select public.finalize_contest(2027)`)).rejects.toThrow(/contest 2027 has no results/);
    });

    it('unticking in_final via upsert_contest_entry nulls the result columns', async () => {
      await upsert(lineup(['GR', 'AT']), 'participants');
      await upsert(results([['AT', 1, 500], ['GR', 2, 400]]), 'results');
      await asUser(db, ADMIN);
      await db.query(`select public.upsert_contest_entry(2027, 'AT', '{"in_final": false}'::jsonb)`);
      expect(await entry('AT')).toEqual({ iso: 'AT', in_final: false, ...NO_RESULT });
      // Even when the same call also sends a place: a non-finalist has none.
      await db.query(`select public.upsert_contest_entry(2027, 'GR', '{"in_final": false, "final_place": 3}'::jsonb)`);
      expect(await entry('GR')).toEqual({ iso: 'GR', in_final: false, ...NO_RESULT });
      // A finalist edit keeps its results.
      await db.query(`select public.upsert_contest_entry(2027, 'GR', '{"in_final": true, "final_place": 2, "total_points": 400}'::jsonb)`);
      expect(await entry('GR')).toMatchObject({ in_final: true, final_place: 2, total_points: 400 });
    });
  });

  // ── I3 ────────────────────────────────────────────────────────────────
  describe('I3 phase triggers only touch rooms of the job year', () => {
    it('participants done for 2027 opens predictions in 2027 rooms only', async () => {
      await db.exec(`update public.parse_jobs set status = 'done' where year = 2027 and kind = 'participants'`);
      expect(await phase(R27)).toBe('predictions_open');
      expect(await phase(R26)).toBe('pre_night');
      expect(await notified(R27)).toBe(1);
      expect(await notified(R26)).toBe(0);
    });

    it('results running for 2027 opens voting in 2027 rooms only', async () => {
      await db.exec(`update public.rooms set phase = 'predictions_open' where true`);
      await db.exec(`update public.parse_jobs set status = 'running' where year = 2027 and kind = 'results'`);
      expect(await phase(R27)).toBe('voting_live');
      expect(await phase(R26)).toBe('predictions_open');
      expect(await notified(R26)).toBe(0);
    });

    it('results finalized for 2027 moves 2027 rooms to final only', async () => {
      await db.exec(`update public.rooms set phase = 'voting_live' where true`);
      await db.exec(`update public.parse_jobs set status = 'finalized' where year = 2027 and kind = 'results'`);
      expect(await phase(R27)).toBe('final');
      expect(await phase(R26)).toBe('voting_live');
      expect(await notified(R26)).toBe(0);
    });

    it('helpers take the year, the zero-argument ones are gone, and no client role can call them', async () => {
      const r = await db.query<Row>(
        `select p.oid::regprocedure::text as sig,
                has_function_privilege('anon', p.oid, 'execute') as anon,
                has_function_privilege('authenticated', p.oid, 'execute') as authed
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname in ('_open_predictions_for_pre_night_rooms', '_open_voting_for_predictions_rooms', '_move_all_to_final')
          order by 1`,
      );
      expect(r.rows).toEqual([
        { sig: '_move_all_to_final(integer)', anon: false, authed: false },
        { sig: '_open_predictions_for_pre_night_rooms(integer)', anon: false, authed: false },
        { sig: '_open_voting_for_predictions_rooms(integer)', anon: false, authed: false },
      ]);
    });

    it('finalizing 2027 through finalize_results leaves a 2026 room unchanged', async () => {
      await upsert(lineup(['GR', 'SE']), 'participants');
      await upsert(results([['GR', 1, 400], ['SE', 2, 300]]), 'results');
      await asUser(db, ADMIN);
      await db.query(`select public.finalize_results(2027)`);
      expect(await phase(R27)).toBe('final');
      expect(await phase(R26)).toBe('pre_night');
    });
  });

  // ── M4 ────────────────────────────────────────────────────────────────
  it('M4 semis keep an existing source and set it on new rows', async () => {
    await db.exec(`insert into public.contest_entries (year, iso, artist, song, source) values (2027, 'GR', 'A', 'S', 'manual'),
                                                                                           (2027, 'AT', 'B', 'T', null)`);
    const semi = (iso: string, ro: number) => ({
      year: 2027, iso, artist: null, song: null, semi: 1, semi_running_order: ro, semi_place: ro, semi_points: 100 - ro,
      qualified: true, source: 'parser',
    });
    await upsert(JSON.stringify([semi('GR', 1), semi('AT', 2), semi('SE', 3)]), 'semis');
    const r = await db.query<Row>(`select iso, semi_place, source from public.contest_entries where year = 2027 order by iso`);
    expect(r.rows).toEqual([
      { iso: 'AT', semi_place: 2, source: 'parser' },
      { iso: 'GR', semi_place: 1, source: 'manual' },
      { iso: 'SE', semi_place: 3, source: 'parser' },
    ]);
  });

  // ── M6 ────────────────────────────────────────────────────────────────
  it('M6 archive_contest refuses when Y+1 is not upcoming', async () => {
    await db.exec(`
      insert into public.contest_entries (year, iso, artist, song) values (2027, 'GR', 'A', 'S');
      update public.contests set stage = 'archived', archived_at = now() where year = 2027;
      update public.contests set stage = 'finalized', archived_at = null where year = 2026;
    `);
    await asUser(db, ADMIN);
    await expect(db.query(`select public.archive_contest(2026)`)).rejects.toThrow(
      /contest 2027 is archived; archive of 2026 requires it upcoming/,
    );
    const s = await db.query<Row>(`select year, stage from public.contests where year in (2026, 2027) order by year`);
    expect(s.rows).toEqual([
      { year: 2026, stage: 'finalized' },
      { year: 2027, stage: 'archived' },
    ]);
  });
});

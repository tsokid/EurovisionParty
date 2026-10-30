// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000001';

// Room fixtures. R26A/R26B are 2026 rooms with predictions and no results.
// R25 is a finished 2025 room (results row, scored prediction).
// R25_OPEN is a 2025 room with a prediction but no results.
const R26A = '10000000-0000-4000-8000-00000000026a';
const R26B = '10000000-0000-4000-8000-00000000026b';
const R25 = '10000000-0000-4000-8000-000000000025';
const R25_OPEN = '10000000-0000-4000-8000-0000000025f0';

const ENTRY_COLS = `iso, semi, semi_running_order, semi_place, semi_points, qualified,
  in_final, final_running_order, final_place, total_points, jury_points, televote_points, source`;

type Row = Record<string, unknown>;

describe('071 result RPCs on contest_entries', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin@example.test');
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await asUser(db, null);
    await seed();
    await asUser(db, ADMIN);
  });

  async function seed(): Promise<void> {
    await db.exec(`
      delete from public.rooms where true;
      delete from public.contest_entries where year in (2025, 2026);

      insert into public.contests (year, host_iso, city, city_slug, stage)
      values (2025, 'CH', 'Basel', 'basel', 'archived')
      on conflict (year) do update set stage = 'archived';
      update public.contests set stage = 'current' where year = 2026;

      -- 2026: three grand finalists without results, one semi-finalist that did not qualify.
      insert into public.contest_entries (year, iso, artist, song, semi, semi_running_order, semi_place, semi_points, qualified, in_final, final_running_order, source) values
        (2026, 'GR', 'A1', 'S1', 1, 4, 2, 180, true, true, 1, 'parser'),
        (2026, 'AT', 'A2', 'S2', null, null, null, null, null, true, 2, 'parser'),
        (2026, 'SE', 'A3', 'S3', 2, 7, 1, 220, true, true, 3, 'parser'),
        (2026, 'MD', 'A4', 'S4', 1, 9, 12, 20, false, false, null, 'parser');

      -- 2025: archived, with results.
      insert into public.contest_entries (year, iso, artist, song, in_final, final_running_order, final_place, total_points, jury_points, televote_points, source) values
        (2025, 'AT', 'JJ', 'Wasted Love', true, 9, 1, 436, 258, 178, 'import:test'),
        (2025, 'IL', 'Yuval Raphael', 'New Day Will Rise', true, 20, 2, 357, 60, 297, 'import:test');

      insert into public.parse_jobs (year, kind) values (2026, 'results') on conflict (year, kind) do nothing;
      update public.parse_jobs
         set status = 'idle', manual_override = true, stopped_at = null
       where year = 2026 and kind = 'results';

      insert into public.rooms (id, code, host_id, host_name, year, phase, created_at) values
        ('${R26A}', 'T26A', '${ADMIN}', 'h', 2026, 'predictions_open', now() - interval '2 hours'),
        ('${R26B}', 'T26B', '${ADMIN}', 'h', 2026, 'predictions_open', now() - interval '2 hours'),
        ('${R25}', 'T25X', '${ADMIN}', 'h', 2025, 'final', now() - interval '2 hours'),
        ('${R25_OPEN}', 'T25O', '${ADMIN}', 'h', 2025, 'predictions_open', now() - interval '2 hours');

      insert into public.players (room_id, name, is_host, quiz_points, pred_points, duel_points)
      select id, 'host-' || code, true, 10, case when id = '${R25}' then 70 else 0 end, 5
        from public.rooms;

      insert into public.predictions (room_id, player_id, top5, worst5, top5_points, worst5_points, scored_at, is_locked)
      select p.room_id, p.id, array['SE','GR','AT'], array['AT','GR','SE'],
             case when p.room_id = '${R25}' then 70 end,
             case when p.room_id = '${R25}' then 0 end,
             case when p.room_id = '${R25}' then now() end,
             p.room_id = '${R25}'
        from public.players p;

      insert into public.results (room_id, final_ranking, confirmed_by)
      select '${R25}', '["AT","IL"]'::jsonb, id from public.players where room_id = '${R25}';
    `);
  }

  async function entries(year: number): Promise<Row[]> {
    return (await db.query<Row>(`select ${ENTRY_COLS} from public.contest_entries where year = $1 order by iso`, [year])).rows;
  }

  async function roomState(roomId: string) {
    const results = (await db.query<Row>(`select final_ranking from public.results where room_id = $1`, [roomId])).rows;
    const preds = (
      await db.query<Row>(
        `select top5_points, worst5_points, scored_at is not null as scored, is_locked from public.predictions where room_id = $1`,
        [roomId],
      )
    ).rows;
    const players = (
      await db.query<Row>(`select quiz_points, pred_points, duel_points from public.players where room_id = $1`, [roomId])
    ).rows;
    const room = (await db.query<Row>(`select id from public.rooms where id = $1`, [roomId])).rows;
    return { results, preds, players, exists: room.length === 1 };
  }

  async function commit(isos: string[]) {
    return db.query<{ n: number }>(`select public.commit_manual_results(2026, $1::text[]) as n`, [isos]);
  }

  // ── commit_manual_results ────────────────────────────────────────────
  it('commit_manual_results only replaces p_year results', async () => {
    const before25 = await entries(2025);
    const r = await commit(['SE', 'GR', 'AT']);
    expect(r.rows[0].n).toBe(3);

    const got = (
      await db.query<Row>(
        `select iso, final_place, total_points, jury_points, televote_points, source
           from public.contest_entries where year = 2026 and in_final order by final_place`,
      )
    ).rows;
    expect(got).toEqual([
      { iso: 'SE', final_place: 1, total_points: null, jury_points: null, televote_points: null, source: 'manual' },
      { iso: 'GR', final_place: 2, total_points: null, jury_points: null, televote_points: null, source: 'manual' },
      { iso: 'AT', final_place: 3, total_points: null, jury_points: null, televote_points: null, source: 'manual' },
    ]);
    expect(await entries(2025)).toEqual(before25);
  });

  it('commit_manual_results replaces an earlier commit of the same year', async () => {
    await commit(['SE', 'GR', 'AT']);
    await db.query(`update public.parse_jobs set status = 'idle' where year = 2026 and kind = 'results'`);
    await commit(['AT', 'SE', 'GR']);
    const places = (
      await db.query<Row>(`select iso, final_place from public.contest_entries where year = 2026 order by iso`)
    ).rows;
    expect(places).toEqual([
      { iso: 'AT', final_place: 1 },
      { iso: 'GR', final_place: 3 },
      { iso: 'MD', final_place: null },
      { iso: 'SE', final_place: 2 },
    ]);
  });

  it('commit_manual_results rejects ISOs that are not finalists of p_year', async () => {
    // MD is a 2026 entry but not a grand finalist; IL is a 2025 finalist only.
    await expect(commit(['SE', 'GR', 'MD'])).rejects.toThrow(/not .*finalist/i);
    await expect(commit(['SE', 'GR', 'IL'])).rejects.toThrow(/not .*finalist/i);
    await expect(commit(['SE', 'GR'])).rejects.toThrow(/expected 3 rankings/);
    await expect(commit(['SE', 'SE', 'GR'])).rejects.toThrow(/duplicate/);
    expect((await entries(2026)).every((e) => e.final_place === null)).toBe(true);
  });

  it('commit_manual_results defines finalists by in_final, not running order', async () => {
    // AT loses its running order but stays a finalist; MD gets one but is not a finalist.
    await asUser(db, null);
    await db.exec(`
      update public.contest_entries set final_running_order = null where year = 2026 and iso = 'AT';
      update public.contest_entries set final_running_order = 4 where year = 2026 and iso = 'MD';
    `);
    await asUser(db, ADMIN);
    await expect(commit(['SE', 'GR', 'MD'])).rejects.toThrow(/not .*finalist/i);
    expect((await commit(['AT', 'SE', 'GR'])).rows[0].n).toBe(3);
    expect(
      (await db.query<Row>(`select iso, final_place from public.contest_entries where year = 2026 and final_place is not null order by final_place`)).rows,
    ).toEqual([
      { iso: 'AT', final_place: 1 },
      { iso: 'SE', final_place: 2 },
      { iso: 'GR', final_place: 3 },
    ]);
  });

  // ── finalize_results ─────────────────────────────────────────────────
  it('finalize_results reads contest_entries', async () => {
    await commit(['SE', 'GR', 'AT']);
    for (const id of [R26A, R26B]) {
      const s = await roomState(id);
      expect(s.results).toEqual([{ final_ranking: ['SE', 'GR', 'AT'] }]);
      expect(s.preds[0]).toMatchObject({ scored: true, is_locked: true });
    }
    const job = await db.query<Row>(`select status from public.parse_jobs where year = 2026 and kind = 'results'`);
    expect(job.rows[0].status).toBe('finalized');
  });

  it('finalize_results only propagates to rooms of p_year', async () => {
    const before25 = await roomState(R25);
    const r = await db.query<{ n: number }>(`select public.commit_manual_results(2026, array['SE','GR','AT']) as n`);
    expect(r.rows[0].n).toBe(3);
    expect((await roomState(R25_OPEN)).results).toEqual([]);
    expect(await roomState(R25)).toEqual(before25);
  });

  it('finalize_results returns 0 and writes nothing when p_year has no places', async () => {
    const n = await db.query<{ n: number }>(`select public.finalize_results(2026) as n`);
    expect(n.rows[0].n).toBe(0);
    expect((await roomState(R26A)).results).toEqual([]);
  });

  // ── reset_manual_results ─────────────────────────────────────────────
  it('reset_manual_results only touches p_year', async () => {
    await commit(['SE', 'GR', 'AT']);
    const before25 = await entries(2025);
    const r25 = await roomState(R25);

    await db.query(`select public.reset_manual_results(2026)`);

    for (const e of await entries(2026)) {
      expect(e).toMatchObject({ final_place: null, total_points: null, jury_points: null, televote_points: null });
    }
    expect((await entries(2026)).map((e) => e.final_running_order)).toEqual([2, 1, null, 3]);
    for (const id of [R26A, R26B]) {
      const s = await roomState(id);
      expect(s.results).toEqual([]);
      expect(s.preds[0]).toMatchObject({ top5_points: null, worst5_points: null, scored: false, is_locked: false });
      expect(s.players[0]).toMatchObject({ pred_points: 0, quiz_points: 10 });
    }
    expect(await entries(2025)).toEqual(before25);
    expect(await roomState(R25)).toEqual(r25);
    const job = await db.query<Row>(`select status from public.parse_jobs where year = 2026 and kind = 'results'`);
    expect(job.rows[0].status).toBe('idle');
  });

  // ── reset_contest ────────────────────────────────────────────────────
  it('reset_contest only touches p_year', async () => {
    await commit(['SE', 'GR', 'AT']);
    const before25 = await entries(2025);
    const r25 = await roomState(R25);

    await db.query(`select public.reset_contest(2026, false, false, false)`);

    const e26 = await entries(2026);
    expect(e26.map((e) => e.iso)).toEqual(['AT', 'GR', 'MD', 'SE']);
    for (const e of e26) {
      expect(e).toMatchObject({
        in_final: false,
        final_running_order: null,
        final_place: null,
        total_points: null,
        jury_points: null,
        televote_points: null,
        qualified: null,
      });
    }
    // Semi data survives.
    expect(e26.find((e) => e.iso === 'MD')).toMatchObject({ semi: 1, semi_running_order: 9, semi_place: 12, semi_points: 20 });
    for (const id of [R26A, R26B]) {
      const s = await roomState(id);
      expect(s.exists).toBe(true);
      expect(s.results).toEqual([]);
      expect(s.preds).toHaveLength(1);
      expect(s.preds[0]).toMatchObject({ scored: false, is_locked: false });
      expect(s.players[0]).toMatchObject({ pred_points: 0, quiz_points: 10, duel_points: 5 });
    }
    expect(await entries(2025)).toEqual(before25);
    expect(await roomState(R25)).toEqual(r25);
  });

  it('reset_contest options delete predictions, points and rooms of p_year only', async () => {
    const r25 = await roomState(R25);
    const r25open = await roomState(R25_OPEN);

    await db.query(`select public.reset_contest(2026, true, true, false)`);
    for (const id of [R26A, R26B]) {
      const s = await roomState(id);
      expect(s.preds).toEqual([]);
      expect(s.players[0]).toMatchObject({ quiz_points: 0, pred_points: 0, duel_points: 0 });
    }
    expect(await roomState(R25)).toEqual(r25);
    expect(await roomState(R25_OPEN)).toEqual(r25open);

    await db.query(`select public.reset_contest(2026, false, false, true)`);
    expect((await roomState(R26A)).exists).toBe(false);
    expect((await roomState(R26B)).exists).toBe(false);
    expect(await roomState(R25)).toEqual(r25);
    expect(await roomState(R25_OPEN)).toEqual(r25open);
  });

  it('reset_contest resets the parse jobs of p_year only', async () => {
    await db.exec(`
      insert into public.parse_jobs (year, kind, status) values (2025, 'results', 'done')
      on conflict (year, kind) do update set status = 'done';
      update public.parse_jobs set poll_count = 7 where year = 2026;
    `);
    await db.query(`select public.reset_contest(2026, false, false, false)`);
    const jobs = (await db.query<Row>(`select year, status, poll_count from public.parse_jobs where kind = 'results' and year in (2025, 2026) order by year`)).rows;
    expect(jobs).toEqual([
      { year: 2025, status: 'done', poll_count: 0 },
      { year: 2026, status: 'idle', poll_count: 0 },
    ]);
  });

  it('reset_contest refuses finalized', async () => {
    await db.query(`update public.contests set stage = 'finalized' where year = 2026`);
    await expect(db.query(`select public.reset_contest(2026, false, false, false)`)).rejects.toThrow(
      /contest 2026 is finalized; reset refused/,
    );
    await expect(db.query(`select public.reset_contest(2025, false, false, false)`)).rejects.toThrow(
      /contest 2025 is archived; reset refused/,
    );
    expect((await entries(2026)).filter((e) => e.in_final)).toHaveLength(3);
  });

  it('legacy reset_contest(int) gone', async () => {
    const r = await db.query<{ p: string | null }>(`select to_regprocedure('public.reset_contest(int)')::text as p`);
    expect(r.rows[0].p).toBeNull();
  });

  // ── contract ─────────────────────────────────────────────────────────
  it('keeps signatures, return types, security definer and the admin gate', async () => {
    const r = await db.query<Row>(
      `select p.oid::regprocedure::text as sig, p.prorettype::regtype::text as ret, p.prosecdef as definer,
              array_to_string(p.proconfig, ',') as cfg
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('finalize_results', 'commit_manual_results', 'reset_manual_results', 'reset_contest')
        order by 1`,
    );
    expect(r.rows).toEqual([
      { sig: 'commit_manual_results(integer,text[])', ret: 'integer', definer: true, cfg: 'search_path=public' },
      { sig: 'finalize_results(integer)', ret: 'integer', definer: true, cfg: 'search_path=public' },
      { sig: 'reset_contest(integer,boolean,boolean,boolean)', ret: 'void', definer: true, cfg: 'search_path=public' },
      { sig: 'reset_manual_results(integer)', ret: 'void', definer: true, cfg: 'search_path=public' },
    ]);

    await asUser(db, null);
    for (const call of [
      `select public.finalize_results(2026)`,
      `select public.commit_manual_results(2026, array['SE','GR','AT'])`,
      `select public.reset_manual_results(2026)`,
      `select public.reset_contest(2026, false, false, false)`,
    ]) {
      await expect(db.query(call), call).rejects.toThrow(/forbidden/);
    }
  });
});

// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin, applyMigration } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000001';
const USER = '00000000-0000-4000-8000-000000000002';

const ROOM_DONE = '20000000-0000-4000-8000-000000000001'; // 2027 room that already has winners
const ROOM_OPEN = '20000000-0000-4000-8000-000000000002'; // 2027 room without winners
const ROOM_OTHER = '20000000-0000-4000-8000-000000000003'; // 2028 room, never touched

const URL_2027 = 'https://www.eurovision.com/eurovision-song-contest/basel-2027/basel-2027-grand-final/';

type Row = Record<string, unknown>;

describe('071 lifecycle and entry RPCs', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin@example.test');
    await db.query(`insert into auth.users (id, email) values ($1, 'user@example.test')`, [USER]);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  // Baseline: 2025 archived (with results), 2026 finalized (seeded by 070),
  // no 2027/2028 contests, no rooms, parser writer unset.
  beforeEach(async () => {
    await asUser(db, null);
    await db.exec(`
      reset app.writer;
      delete from public.rooms where true;
      delete from public.contests where year >= 2027;
      delete from public.parse_jobs where year >= 2027;
      update public.contests set stage = 'finalized', archived_at = null where year = 2026;

      insert into public.contests (year, host_iso, city, city_slug, stage, archived_at)
      values (2025, 'CH', 'Basel', 'basel', 'archived', now())
      on conflict (year) do update set stage = 'archived';
      delete from public.contest_entries where year = 2025;
      insert into public.contest_entries (year, iso, artist, song, in_final, final_running_order, final_place, total_points, source) values
        (2025, 'AT', 'JJ', 'Wasted Love', true, 9, 1, 436, 'import:test'),
        (2025, 'IL', 'Yuval Raphael', 'New Day Will Rise', true, 20, 2, 357, 'import:test');

      insert into public.parse_jobs (year, kind, manual_override) values (2025, 'results', true)
      on conflict (year, kind) do update set manual_override = true;
    `);
    await asUser(db, ADMIN);
  });

  const one = async <T extends Row>(sql: string, params: unknown[] = []): Promise<T> =>
    (await db.query<T>(sql, params)).rows[0];

  const stage = async (year: number) =>
    (await one<{ stage: string | null }>(`select stage from public.contests where year = $1`, [year]))?.stage ?? null;

  async function addContest(year: number, s: string): Promise<void> {
    await db.query(
      `insert into public.contests (year, host_iso, city, city_slug, stage) values ($1, 'CH', 'Basel', 'basel', $2::public.contest_stage)`,
      [year, s],
    );
  }

  async function addEntry(year: number, iso: string): Promise<void> {
    await db.query(`insert into public.contest_entries (year, iso, artist, song) values ($1, $2, 'A', 'S')`, [year, iso]);
  }

  const entries2025 = async () =>
    (await db.query<Row>(`select iso, final_place, total_points from public.contest_entries where year = 2025 order by iso`)).rows;

  // ── create_contest ───────────────────────────────────────────────────
  it('create_contest seeds parse_jobs with derived URL', async () => {
    await db.query(`select public.create_contest(2027, 'Basel', 'basel', 'CH', '2027-05-11', '2027-05-13', '2027-05-15')`);
    expect(
      await one(`select host_iso, city, city_slug, semi1_date::text, semi2_date::text, final_date::text, stage from public.contests where year = 2027`),
    ).toEqual({
      host_iso: 'CH',
      city: 'Basel',
      city_slug: 'basel',
      semi1_date: '2027-05-11',
      semi2_date: '2027-05-13',
      final_date: '2027-05-15',
      stage: 'upcoming',
    });
    const jobs = (await db.query<Row>(`select kind, source_url from public.parse_jobs where year = 2027 order by kind`)).rows;
    expect(jobs).toEqual([
      { kind: 'participants', source_url: URL_2027 },
      { kind: 'results', source_url: URL_2027 },
    ]);
  });

  it('create_contest leaves existing parse_jobs alone', async () => {
    await db.query(`insert into public.parse_jobs (year, kind, source_url) values (2027, 'results', 'https://custom.test/')`);
    await db.query(`select public.create_contest(2027, 'Basel', 'basel', 'CH', null, null, null)`);
    expect(await one(`select source_url from public.parse_jobs where year = 2027 and kind = 'results'`)).toEqual({
      source_url: 'https://custom.test/',
    });
  });

  // ── update_contest ───────────────────────────────────────────────────
  it('update_contest sets allowed fields only', async () => {
    await addContest(2027, 'upcoming');
    await db.query(`select public.update_contest(2027, $1::jsonb)`, [
      JSON.stringify({ city: 'Geneva', city_slug: 'geneva', final_date: '2027-05-22', indexable: true }),
    ]);
    expect(
      await one(`select city, city_slug, host_iso, final_date::text, indexable, stage from public.contests where year = 2027`),
    ).toEqual({ city: 'Geneva', city_slug: 'geneva', host_iso: 'CH', final_date: '2027-05-22', indexable: true, stage: 'upcoming' });
  });

  it('update_contest rejects unknown field', async () => {
    await addContest(2027, 'upcoming');
    await expect(db.query(`select public.update_contest(2027, '{"stage":"current"}'::jsonb)`)).rejects.toThrow(
      /unknown field stage/,
    );
    await expect(db.query(`select public.update_contest(2027, '{"city":"X","year":2030}'::jsonb)`)).rejects.toThrow(
      /unknown field year/,
    );
    expect(await one(`select city, stage from public.contests where year = 2027`)).toEqual({ city: 'Basel', stage: 'upcoming' });
  });

  // ── entries ──────────────────────────────────────────────────────────
  it('upsert_contest_entry inserts then merges', async () => {
    await addContest(2027, 'upcoming');
    await db.query(`select public.upsert_contest_entry(2027, 'GR', '{"artist":"A","song":"S","semi":1}'::jsonb)`);
    await db.query(`select public.upsert_contest_entry(2027, 'GR', '{"song":"S2","semi_running_order":4}'::jsonb)`);
    expect(
      await one(`select artist, song, semi, semi_running_order, in_final from public.contest_entries where year = 2027 and iso = 'GR'`),
    ).toEqual({ artist: 'A', song: 'S2', semi: 1, semi_running_order: 4, in_final: false });
    // in_final is editable; a JSON null resets it to false (the column is not null).
    await db.query(`select public.upsert_contest_entry(2027, 'GR', '{"in_final":true}'::jsonb)`);
    expect(await one(`select in_final, artist from public.contest_entries where year = 2027 and iso = 'GR'`)).toEqual({
      in_final: true,
      artist: 'A',
    });
    await db.query(`select public.upsert_contest_entry(2027, 'GR', '{"in_final":null}'::jsonb)`);
    expect(await one(`select in_final from public.contest_entries where year = 2027 and iso = 'GR'`)).toEqual({ in_final: false });
    await expect(
      db.query(`select public.upsert_contest_entry(2027, 'GR', '{"year":2030}'::jsonb)`),
    ).rejects.toThrow(/unknown field year/);

    await db.query(`select public.delete_contest_entry(2027, 'GR')`);
    expect((await db.query(`select 1 from public.contest_entries where year = 2027`)).rows).toEqual([]);
  });

  it('admin entry edits are allowed on an archived year (Edit + Republish)', async () => {
    await db.query(`select public.upsert_contest_entry(2025, 'AT', '{"total_points":437}'::jsonb)`);
    await db.query(`select public.upsert_contest_entry(2025, 'GR', '{"artist":"x"}'::jsonb)`);
    await db.query(`select public.delete_contest_entry(2025, 'IL')`);
    expect(await entries2025()).toEqual([
      { iso: 'AT', final_place: 1, total_points: 437 },
      { iso: 'GR', final_place: null, total_points: null },
    ]);
    expect(await stage(2025)).toBe('archived');
  });

  it('parser writes on an archived year are still refused', async () => {
    const before = await entries2025();
    await asUser(db, null);
    await db.exec(`set app.writer = 'parser'`);
    await expect(
      db.query(`insert into public.contest_entries (year, iso, artist) values (2025, 'GR', 'p')`),
    ).rejects.toThrow(/contest 2025 is archived; parser writes refused/);
    await expect(db.query(`delete from public.contest_entries where year = 2025`)).rejects.toThrow(
      /contest 2025 is archived; parser writes refused/,
    );
    await db.exec(`reset app.writer`);
    expect(await entries2025()).toEqual(before);
  });

  // ── start_contest ────────────────────────────────────────────────────
  it('start_contest refuses while another is live', async () => {
    await addContest(2027, 'upcoming');
    await expect(db.query(`select public.start_contest(2027)`)).rejects.toThrow(/2026 is finalized/);
    expect(await stage(2027)).toBe('upcoming');

    await db.query(`update public.contests set stage = 'archived' where year = 2026`);
    await db.query(`select public.start_contest(2027)`);
    expect(await stage(2027)).toBe('current');
    // Not upcoming any more.
    await expect(db.query(`select public.start_contest(2027)`)).rejects.toThrow(/contest 2027 is current/);
  });

  // ── finalize_contest ─────────────────────────────────────────────────
  it('finalize_contest computes winners only for rooms without winners', async () => {
    await db.query(`update public.contests set stage = 'archived' where year = 2026`);
    await addContest(2027, 'current');
    await addContest(2028, 'upcoming');
    await db.exec(`
      insert into public.parse_jobs (year, kind) values (2027, 'results');
      insert into public.contest_entries (year, iso, in_final, final_running_order, final_place) values
        (2027, 'SE', true, 1, 1), (2027, 'GR', true, 2, 2);
      insert into public.rooms (id, code, host_id, host_name, year, phase) values
        ('${ROOM_DONE}', 'L27D', '${ADMIN}', 'h', 2027, 'final'),
        ('${ROOM_OPEN}', 'L27O', '${ADMIN}', 'h', 2027, 'final'),
        ('${ROOM_OTHER}', 'L28X', '${ADMIN}', 'h', 2028, 'final');
      insert into public.players (room_id, name, is_host, quiz_points) values
        ('${ROOM_DONE}', 'd1', true, 30), ('${ROOM_DONE}', 'd2', false, 10),
        ('${ROOM_OPEN}', 'o1', true, 5),  ('${ROOM_OPEN}', 'o2', false, 40),
        ('${ROOM_OTHER}', 'x1', true, 50);
      insert into public.winners (room_id, category, player_id, metric_value)
      select room_id, 'champion', id, 999 from public.players where name = 'd2';
    `);

    const r = await one<{ n: number }>(`select public.finalize_contest(2027) as n`);
    expect(r.n).toBe(1);

    expect(await one(`select stage, finalized_at is not null as stamped from public.contests where year = 2027`)).toEqual({
      stage: 'finalized',
      stamped: true,
    });
    expect(await one(`select status from public.parse_jobs where year = 2027 and kind = 'results'`)).toEqual({
      status: 'finalized',
    });
    const winners = (
      await db.query<Row>(
        `select w.room_id, p.name, w.category, w.metric_value::int as v
           from public.winners w join public.players p on p.id = w.player_id order by p.name`,
      )
    ).rows;
    expect(winners).toEqual([
      { room_id: ROOM_DONE, name: 'd2', category: 'champion', v: 999 }, // untouched
      { room_id: ROOM_OPEN, name: 'o2', category: 'champion', v: 40 },
    ]);
  });

  it('finalize_contest requires current', async () => {
    await expect(db.query(`select public.finalize_contest(2026)`)).rejects.toThrow(/contest 2026 is finalized/);
    await expect(db.query(`select public.finalize_contest(2031)`)).rejects.toThrow(/contest 2031 not found/);
  });

  it('finalize refuses without results', async () => {
    await db.query(`update public.contests set stage = 'archived' where year = 2026`);
    await addContest(2027, 'current');
    await db.exec(`
      insert into public.parse_jobs (year, kind, status) values (2027, 'results', 'idle');
      insert into public.contest_entries (year, iso, in_final, final_running_order) values (2027, 'SE', true, 1), (2027, 'GR', true, 2);
    `);
    const jobsBefore = (await db.query<Row>(`select * from public.parse_jobs where year = 2027 order by kind`)).rows;
    await expect(db.query(`select public.finalize_contest(2027)`)).rejects.toThrow(
      /contest 2027 has no results; finalize refused/,
    );
    expect(await one(`select stage, finalized_at from public.contests where year = 2027`)).toEqual({
      stage: 'current',
      finalized_at: null,
    });
    expect((await db.query<Row>(`select * from public.parse_jobs where year = 2027 order by kind`)).rows).toEqual(jobsBefore);
  });

  // ── archive_contest ──────────────────────────────────────────────────
  it('archive refuses unless finalized', async () => {
    await addContest(2027, 'upcoming');
    await addEntry(2027, 'GR');
    await db.query(`update public.contests set stage = 'current' where year = 2026`);
    await expect(db.query(`select public.archive_contest(2026)`)).rejects.toThrow(/contest 2026 is current/);
    await expect(db.query(`select public.archive_contest(2025)`)).rejects.toThrow(/contest 2025 is archived/);
    expect([await stage(2026), await stage(2027)]).toEqual(['current', 'upcoming']);
  });

  it('archive refuses when next year has no entries', async () => {
    await expect(db.query(`select public.archive_contest(2026)`)).rejects.toThrow(/2027/);
    await addContest(2027, 'upcoming');
    await expect(db.query(`select public.archive_contest(2026)`)).rejects.toThrow(/no entries for 2027/);
    expect([await stage(2026), await stage(2027)]).toEqual(['finalized', 'upcoming']);
  });

  it('archive flips both years', async () => {
    await addContest(2027, 'upcoming');
    await addEntry(2027, 'GR');
    await db.query(`select public.archive_contest(2026)`);
    expect(
      await one(`select stage, archived_at is not null as stamped from public.contests where year = 2026`),
    ).toEqual({ stage: 'archived', stamped: true });
    expect(await stage(2027)).toBe('current');
    expect(await one(`select public.live_contest_year() as y`)).toEqual({ y: 2027 });
  });

  // ── unarchive_contest ────────────────────────────────────────────────
  it('unarchive refuses when rooms exist for next year', async () => {
    await addContest(2027, 'upcoming');
    await addEntry(2027, 'GR');
    await db.query(`select public.archive_contest(2026)`);
    await db.query(
      `insert into public.rooms (id, code, host_id, host_name, year, phase) values ($1, 'U27R', $2, 'h', 2027, 'lobby')`,
      [ROOM_OPEN, ADMIN],
    );
    await expect(db.query(`select public.unarchive_contest(2026)`)).rejects.toThrow(
      /rooms exist for 2027; un-archive refused/,
    );
    expect([await stage(2026), await stage(2027)]).toEqual(['archived', 'current']);
  });

  it('unarchive refuses unless latest archived year with next year current', async () => {
    // 2025 is archived but not the latest once 2026 is archived.
    await addContest(2027, 'upcoming');
    await addEntry(2027, 'GR');
    await db.query(`select public.archive_contest(2026)`);
    await expect(db.query(`select public.unarchive_contest(2025)`)).rejects.toThrow(/not the latest archived/);
    // 2026 finalized is not archived.
    await db.query(`select public.unarchive_contest(2026)`);
    await expect(db.query(`select public.unarchive_contest(2026)`)).rejects.toThrow(/contest 2026 is finalized/);
  });

  it('unarchive restores and keeps next-year entries', async () => {
    await addContest(2027, 'upcoming');
    await addEntry(2027, 'GR');
    await addEntry(2027, 'SE');
    await db.query(`select public.archive_contest(2026)`);
    await db.query(`select public.unarchive_contest(2026)`);
    expect(
      await one(`select stage, archived_at, finalized_at is not null as fin from public.contests where year = 2026`),
    ).toEqual({ stage: 'finalized', archived_at: null, fin: true });
    expect(await stage(2027)).toBe('upcoming');
    expect((await db.query(`select iso from public.contest_entries where year = 2027 order by iso`)).rows).toEqual([
      { iso: 'GR' },
      { iso: 'SE' },
    ]);
    expect(await one(`select public.live_contest_year() as y`)).toEqual({ y: 2026 });
  });

  // ── parser write guard ───────────────────────────────────────────────
  it('parser writes refused after finalize', async () => {
    await addContest(2027, 'upcoming');
    await asUser(db, null);
    await db.exec(`set app.writer = 'parser'`);
    // upcoming: parser may write.
    await db.query(`insert into public.contest_entries (year, iso, artist) values (2027, 'GR', 'p')`);
    // finalized and archived: refused, insert and update.
    await expect(
      db.query(`insert into public.contest_entries (year, iso, artist) values (2026, 'GR', 'p') on conflict (year, iso) do update set artist = excluded.artist`),
    ).rejects.toThrow(/contest 2026 is finalized; parser writes refused/);
    await expect(db.query(`update public.contest_entries set total_points = 1 where year = 2025`)).rejects.toThrow(
      /contest 2025 is archived; parser writes refused/,
    );
    // Other writers are not affected.
    await db.exec(`reset app.writer`);
    await db.query(`update public.contest_entries set artist = artist where year = 2026 and iso = 'GR'`);
  });

  it('parser deletes and year moves out of a finalized year are refused', async () => {
    await addContest(2027, 'upcoming');
    await asUser(db, null);
    const gr2026 = await one(`select * from public.contest_entries where year = 2026 and iso = 'GR'`);
    expect(gr2026).toBeDefined();
    await db.exec(`set app.writer = 'parser'`);
    await expect(db.query(`delete from public.contest_entries where year = 2026 and iso = 'GR'`)).rejects.toThrow(
      /contest 2026 is finalized; parser writes refused/,
    );
    await expect(
      db.query(`update public.contest_entries set year = 2027 where year = 2026 and iso = 'GR'`),
    ).rejects.toThrow(/contest 2026 is finalized; parser writes refused/);
    // Upcoming rows can still be deleted by the parser.
    await db.query(`insert into public.contest_entries (year, iso) values (2027, 'SE')`);
    await db.query(`delete from public.contest_entries where year = 2027 and iso = 'SE'`);
    await db.exec(`reset app.writer`);
    expect(await one(`select * from public.contest_entries where year = 2026 and iso = 'GR'`)).toEqual(gr2026);
  });

  // ── manual results refused on finalized / archived (controller ruling 1) ──
  it('manual result RPCs refuse finalized and archived years; archived results survive', async () => {
    const before = await entries2025();
    await db.query(`update public.contest_entries set final_place = 1 where year = 2026 and iso = 'GR'`);
    await expect(db.query(`select public.reset_manual_results(2025)`)).rejects.toThrow(
      /contest 2025 is archived; manual results refused/,
    );
    await expect(db.query(`select public.commit_manual_results(2025, array['IL','AT'])`)).rejects.toThrow(
      /contest 2025 is archived; manual results refused/,
    );
    await expect(db.query(`select public.reset_manual_results(2026)`)).rejects.toThrow(
      /contest 2026 is finalized; manual results refused/,
    );
    await expect(db.query(`select public.commit_manual_results(2026, array['GR'])`)).rejects.toThrow(
      /contest 2026 is finalized; manual results refused/,
    );
    expect(await entries2025()).toEqual(before);
    expect(await one(`select final_place from public.contest_entries where year = 2026 and iso = 'GR'`)).toEqual({
      final_place: 1,
    });
  });

  // ── contract ─────────────────────────────────────────────────────────
  const SIGS = [
    'archive_contest(integer)',
    'create_contest(integer,text,text,text,date,date,date)',
    'delete_contest_entry(integer,text)',
    'finalize_contest(integer)',
    'start_contest(integer)',
    'unarchive_contest(integer)',
    'update_contest(integer,jsonb)',
    'upsert_contest_entry(integer,text,jsonb)',
  ];

  it('every RPC is security definer, search_path=public, authenticated-only', async () => {
    const r = await db.query<Row>(
      `select p.oid::regprocedure::text as sig, p.prosecdef as definer, array_to_string(p.proconfig, ',') as cfg,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authed
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.oid::regprocedure::text = any($1::text[])
        order by 1`,
      [SIGS],
    );
    expect(r.rows).toEqual(
      SIGS.map((sig) => ({ sig, definer: true, cfg: 'search_path=public', anon: false, authed: true })),
    );
    expect(
      await one(`select p.prorettype::regtype::text as ret from pg_proc p where p.oid = 'public.finalize_contest(integer)'::regprocedure`),
    ).toEqual({ ret: 'integer' });
  });

  it.each([
    ['create_contest', `select public.create_contest(2027, 'Basel', 'basel', 'CH', null, null, null)`],
    ['update_contest', `select public.update_contest(2026, '{"city":"x"}'::jsonb)`],
    ['upsert_contest_entry', `select public.upsert_contest_entry(2026, 'GR', '{"artist":"x"}'::jsonb)`],
    ['delete_contest_entry', `select public.delete_contest_entry(2026, 'GR')`],
    ['upsert_contest_entry on an archived year', `select public.upsert_contest_entry(2025, 'AT', '{"total_points":1}'::jsonb)`],
    ['delete_contest_entry on an archived year', `select public.delete_contest_entry(2025, 'AT')`],
    ['start_contest', `select public.start_contest(2026)`],
    ['finalize_contest', `select public.finalize_contest(2026)`],
    ['archive_contest', `select public.archive_contest(2026)`],
    ['unarchive_contest', `select public.unarchive_contest(2025)`],
  ])('non-admin forbidden: %s', async (_name, call) => {
    for (const uid of [USER, null]) {
      await asUser(db, uid);
      await expect(db.query(call)).rejects.toThrow(/forbidden/);
    }
  });
});

// Supabase grants anon execute on public functions, directly and through
// default privileges, so `revoke … from public` alone leaves anon in.
// Simulate that before applying 071 and prove its revokes cover anon.
describe('071 revokes execute from anon under Supabase default privileges', () => {
  let db: PGlite;

  const SIGS_071 = [
    'archive_contest(integer)',
    'commit_manual_results(integer,text[])',
    'create_contest(integer,text,text,text,date,date,date)',
    'delete_contest_entry(integer,text)',
    'finalize_contest(integer)',
    'finalize_results(integer)',
    'reset_contest(integer,boolean,boolean,boolean)',
    'reset_manual_results(integer)',
    'start_contest(integer)',
    'unarchive_contest(integer)',
    'update_contest(integer,jsonb)',
    'upsert_contest_entry(integer,text,jsonb)',
  ];

  beforeAll(async () => {
    db = await createDb({ upTo: '070' });
    await db.exec(`
      grant execute on all functions in schema public to anon, authenticated;
      alter default privileges in schema public grant execute on functions to anon, authenticated;
    `);
    // Sanity: the simulation really grants anon on pre-existing functions.
    const pre = await db.query<{ ok: boolean }>(
      `select has_function_privilege('anon', 'public.finalize_results(integer)', 'execute') as ok`,
    );
    expect(pre.rows[0].ok).toBe(true);
    await applyMigration(db, '071');
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('all 12 RPCs: anon cannot execute, authenticated can', async () => {
    const r = await db.query<Row>(
      `select p.oid::regprocedure::text as sig,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authed
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.oid::regprocedure::text = any($1::text[])
        order by 1`,
      [SIGS_071],
    );
    expect(r.rows).toEqual(SIGS_071.map((sig) => ({ sig, anon: false, authed: true })));
  });
});

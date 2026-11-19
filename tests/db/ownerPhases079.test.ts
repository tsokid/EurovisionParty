// @vitest-environment node
// 079: the owner drives the game phases with set_game_phase; the parser
// only fetches data; Finalize ends the year's games; the host only starts.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000001';
const USER = '00000000-0000-4000-8000-000000000002';
const R26 = '30000000-0000-4000-8000-000000000026';
const R27 = '30000000-0000-4000-8000-000000000027';
const R27L = '30000000-0000-4000-8000-000000000271';

describe('079 owner phase buttons', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin@example.test');
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  // 2026 archived, 2027 current; a 2026 and a 2027 room in pre_night, a
  // 2027 room in the lobby; every room has an active host.
  beforeEach(async () => {
    await asUser(db, null);
    await db.exec(`
      reset role;
      delete from public.rooms where true;
      delete from public.notifications where true;
      delete from public.contests where year >= 2027;
      delete from public.parse_jobs where year >= 2027;
      update public.contests set stage = 'archived', archived_at = now(), game_phase = 'final' where year = 2026;
      insert into public.contests (year, host_iso, city, city_slug, stage) values (2027, 'BG', 'Burgas', 'burgas', 'current');
      insert into public.parse_jobs (year, kind, status) values (2027, 'participants', 'idle'), (2027, 'results', 'idle');
      insert into public.rooms (id, code, host_id, host_name, year, phase) values
        ('${R26}', 'P26', '${ADMIN}', 'h', 2026, 'pre_night'),
        ('${R27}', 'P27', '${ADMIN}', 'h', 2027, 'pre_night'),
        ('${R27L}', 'L27', '${ADMIN}', 'h', 2027, 'lobby');
      insert into public.players (room_id, name, is_host) select id, 'host-' || code, true from public.rooms;
    `);
  });

  const phase = async (id: string) =>
    (await db.query<{ phase: string }>(`select phase from public.rooms where id = $1`, [id])).rows[0].phase;
  const gamePhase = async (y: number) =>
    (await db.query<{ g: string }>(`select game_phase as g from public.contests where year = $1`, [y])).rows[0].g;
  const notified = async (id: string) =>
    (await db.query<{ n: number }>(`select count(*)::int as n from public.notifications where room_id = $1`, [id])).rows[0].n;
  const hostOf = async (id: string) =>
    (await db.query<{ id: string }>(`select id from public.players where room_id = $1 and is_host`, [id])).rows[0].id;
  const start = async (room: string, player: string) =>
    (await db.query<{ p: string }>(`select public.advance_room_phase($1, $2) as p`, [room, player])).rows[0].p;

  async function setPhase(year: number, p: string): Promise<number> {
    await asUser(db, ADMIN);
    try {
      return (await db.query<{ n: number }>(`select public.set_game_phase($1, $2) as n`, [year, p])).rows[0].n;
    } finally {
      await asUser(db, null);
    }
  }

  it('a participants parse turning done no longer opens predictions', async () => {
    await db.exec(`update public.parse_jobs set status = 'done' where year = 2027 and kind = 'participants'`);
    expect(await phase(R27)).toBe('pre_night');
    expect(await notified(R27)).toBe(0);
  });

  it('a results parse starting no longer opens voting', async () => {
    await db.exec(`update public.rooms set phase = 'predictions_open' where id = '${R27}'`);
    await db.exec(`update public.parse_jobs set status = 'running' where year = 2027 and kind = 'results'`);
    expect(await phase(R27)).toBe('predictions_open');
  });

  it('Open predictions moves that year only, skips the lobby, and notifies', async () => {
    expect(await setPhase(2027, 'predictions_open')).toBe(1);
    expect(await phase(R27)).toBe('predictions_open');
    expect(await phase(R27L)).toBe('lobby');
    expect(await phase(R26)).toBe('pre_night');
    expect(await gamePhase(2027)).toBe('predictions_open');
    expect(await notified(R27)).toBe(1);
    expect(await notified(R26)).toBe(0);
  });

  it('Close predictions moves predictions_open rooms of that year to voting', async () => {
    await setPhase(2027, 'predictions_open');
    expect(await setPhase(2027, 'voting_live')).toBe(1);
    expect(await phase(R27)).toBe('voting_live');
    expect(await gamePhase(2027)).toBe('voting_live');
  });

  it('works on a closed year for testing and never touches final rooms', async () => {
    await db.exec(`update public.rooms set phase = 'final' where id = '${R27}'`);
    expect(await setPhase(2026, 'predictions_open')).toBe(1);
    expect(await phase(R26)).toBe('predictions_open');
    expect(await setPhase(2027, 'predictions_open')).toBe(0);
    expect(await phase(R27)).toBe('final');
  });

  it('refuses final, unknown phases, unknown years and non-admins', async () => {
    await expect(setPhase(2027, 'final')).rejects.toThrow(/final comes from Finalize/);
    await expect(setPhase(2027, 'lobby')).rejects.toThrow(/invalid phase/);
    await expect(setPhase(2099, 'predictions_open')).rejects.toThrow(/not found/);
    await asUser(db, USER);
    await expect(db.query(`select public.set_game_phase(2027, 'predictions_open')`)).rejects.toThrow(/forbidden/);
    await asUser(db, null);
    expect(await phase(R27)).toBe('pre_night');
  });

  it('the host start lands on pre_night, or on the year phase once predictions are open', async () => {
    const host = await hostOf(R27L);
    expect(await start(R27L, host)).toBe('pre_night');
    await db.exec(`update public.rooms set phase = 'lobby' where id = '${R27L}'`);
    await setPhase(2027, 'predictions_open');
    expect(await start(R27L, host)).toBe('predictions_open');
  });

  it('the host cannot move a room past the lobby', async () => {
    const host = await hostOf(R27);
    await expect(start(R27, host)).rejects.toThrow(/Only the lobby/);
    expect(await phase(R27)).toBe('pre_night');
  });

  it('Finalize (results finalized) ends the games of that year and sets game_phase final', async () => {
    await setPhase(2027, 'voting_live');
    await db.exec(`update public.parse_jobs set status = 'finalized' where year = 2027 and kind = 'results'`);
    expect(await phase(R27)).toBe('final');
    expect(await phase(R27L)).toBe('final');
    expect(await phase(R26)).toBe('pre_night');
    expect(await gamePhase(2027)).toBe('final');
  });

  it('reset_contest puts game_phase back to pre_night', async () => {
    await setPhase(2027, 'voting_live');
    await asUser(db, ADMIN);
    await db.query(`select public.reset_contest(2027)`);
    await asUser(db, null);
    expect(await gamePhase(2027)).toBe('pre_night');
  });

  it('the unscoped bulk switch is gone; set_game_phase is for signed-in admins only', async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_proc where proname = 'admin_advance_all_rooms'`,
    );
    expect(r.rows[0].n).toBe(0);
    const g = await db.query<{ anon: boolean; authed: boolean }>(
      `select has_function_privilege('anon', 'public.set_game_phase(int, text)', 'execute') as anon,
              has_function_privilege('authenticated', 'public.set_game_phase(int, text)', 'execute') as authed`,
    );
    expect(g.rows[0]).toEqual({ anon: false, authed: true });
  });
});

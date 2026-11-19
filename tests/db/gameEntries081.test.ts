// @vitest-environment node
// 081: game data (game_entries, parser) and public data (contest_entries,
// CMS) are separate; copy_game_to_public is the only bridge.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000001';
const USER = '00000000-0000-4000-8000-000000000002';

type Row = Record<string, unknown>;

describe('081 game entries and Copy to public', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin@example.test');
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  // 2026 archived; 2027 current with a public line-up from the CMS (GR with
  // semi data and a curated artist, CY a public finalist the game does not
  // have) and a parsed game line-up (GR, SE) with results.
  beforeEach(async () => {
    await asUser(db, null);
    await db.exec(`
      reset role;
      delete from public.contests where year >= 2027;
      delete from public.parse_jobs where year >= 2027;
      update public.contests set stage = 'archived', archived_at = now() where year = 2026;
      insert into public.contests (year, host_iso, city, city_slug, stage) values (2027, 'BG', 'Burgas', 'burgas', 'current');
      insert into public.parse_jobs (year, kind, status) values (2027, 'participants', 'idle'), (2027, 'results', 'idle');
      insert into public.contest_entries (year, iso, artist, song, semi, semi_place, qualified, in_final, final_place, source) values
        (2027, 'GR', 'Curated Artist', 'Curated Song', 1, 2, true, true, null, 'manual'),
        (2027, 'CY', 'C', 'D', 2, 5, true, true, 7, 'manual');
      insert into public.game_entries (year, iso, artist, song, in_final, final_running_order, final_place, total_points, jury_points, televote_points, source) values
        (2027, 'GR', 'Parsed Artist', 'Parsed Song', true, 3, 2, 400, 250, 150, 'parser'),
        (2027, 'SE', 'KAJ', 'Bara', true, 5, 1, 500, 300, 200, 'parser'),
        (2027, 'MD', 'M', 'N', false, null, null, null, null, null, 'parser');
    `);
  });

  const pub = async () =>
    (
      await db.query<Row>(
        `select iso, artist, song, semi, semi_place, qualified, in_final, final_running_order, final_place, total_points, source
           from public.contest_entries where year = 2027 order by iso`,
      )
    ).rows;
  async function copy(): Promise<number> {
    await asUser(db, ADMIN);
    try {
      return (await db.query<{ n: number }>(`select public.copy_game_to_public(2027) as n`)).rows[0].n;
    } finally {
      await asUser(db, null);
    }
  }

  it('backfills every public grand finalist that has an artist or song', async () => {
    const r = await db.query<{ pub: number; game: number }>(
      `select (select count(*)::int from public.contest_entries
                where year <= 2026 and in_final and (coalesce(btrim(artist), '') <> '' or coalesce(btrim(song), '') <> '')) as pub,
              (select count(*)::int from public.game_entries where year <= 2026) as game`,
    );
    expect(r.rows[0].game).toBeGreaterThan(0);
    expect(r.rows[0].game).toBe(r.rows[0].pub);
  });

  it('the game views read game_entries, never the public data', async () => {
    const r = await db.query<{ iso: string; artist: string }>(
      `select iso, artist from public.entries_with_names where year = 2027 and in_final order by iso`,
    );
    expect(r.rows).toEqual([
      { iso: 'GR', artist: 'Parsed Artist' },
      { iso: 'SE', artist: 'KAJ' },
    ]);
  });

  it('refuses Copy to public before Finalize, and for non-admins', async () => {
    await expect(copy()).rejects.toThrow(/contest 2027 is current; copy to public requires finalized/);
    await db.exec(`update public.contests set stage = 'finalized' where year = 2027`);
    await asUser(db, USER);
    await expect(db.query(`select public.copy_game_to_public(2027)`)).rejects.toThrow(/forbidden/);
    await asUser(db, null);
  });

  it('copies the final line-up and ranking, keeps CMS names and semi data, demotes the rest', async () => {
    await db.exec(`update public.contests set stage = 'finalized' where year = 2027`);
    expect(await copy()).toBe(2);
    expect(await pub()).toEqual([
      // A public finalist the game does not have: no longer a finalist, its semi data stays.
      { iso: 'CY', artist: 'C', song: 'D', semi: 2, semi_place: 5, qualified: true, in_final: false, final_running_order: null, final_place: null, total_points: null, source: 'manual' },
      // Curated names kept; results from the game.
      { iso: 'GR', artist: 'Curated Artist', song: 'Curated Song', semi: 1, semi_place: 2, qualified: true, in_final: true, final_running_order: 3, final_place: 2, total_points: 400, source: 'manual' },
      // New public row from the game.
      { iso: 'SE', artist: 'KAJ', song: 'Bara', semi: null, semi_place: null, qualified: null, in_final: true, final_running_order: 5, final_place: 1, total_points: 500, source: 'parser' },
    ]);
    // Idempotent.
    const once = await pub();
    await copy();
    expect(await pub()).toEqual(once);
  });

  it('refuses a year without game results', async () => {
    await db.exec(`
      update public.game_entries set final_place = null where year = 2027;
      update public.contests set stage = 'finalized' where year = 2027;
    `);
    await expect(copy()).rejects.toThrow(/has no game results to copy/);
  });

  it('reset_contest clears the game data and never the public data', async () => {
    const before = await pub();
    await asUser(db, ADMIN);
    await db.query(`select public.reset_contest(2027)`);
    await asUser(db, null);
    expect((await db.query(`select 1 from public.game_entries where year = 2027`)).rows).toEqual([]);
    expect(await pub()).toEqual(before);
  });

  it('the parser guard covers game_entries too', async () => {
    await db.exec(`update public.contests set stage = 'finalized' where year = 2027`);
    await db.exec(`set role service_role`);
    try {
      await expect(
        db.query(`select public.parser_upsert_entries(2027, '[{"iso":"GR","artist":"X","song":"Y"}]'::jsonb, 'participants')`),
      ).rejects.toThrow(/contest 2027 is finalized; parser writes refused/);
    } finally {
      await db.exec(`reset role`);
    }
  });
});

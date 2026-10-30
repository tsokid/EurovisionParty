// @vitest-environment node
// 074: publish_runs, begin_publish / end_publish, publish_input,
// unpublished_summary.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin } from './harness';
import { buildSnapshotFiles, type SnapshotInput } from '../../supabase/functions/publish-content/snapshot';

const ADMIN = '00000000-0000-4000-8000-000000000001';
const STRANGER = '00000000-0000-4000-8000-0000000000ff';

type Summary = { changed_years: number[]; since: string | null };

describe('074 publish_runs', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin@example.test');
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(`reset role`);
    await asUser(db, null);
    await db.exec(`delete from public.publish_runs where true`);
    await asUser(db, ADMIN);
  });

  async function asService<T>(fn: () => Promise<T>): Promise<T> {
    await db.exec(`set role service_role`);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role`);
    }
  }

  const begin = async () => (await db.query<{ id: string }>(`select public.begin_publish() as id`)).rows[0].id;
  const end = (id: string | number, status: string, sha: string | null, files: number | null, error: string | null) =>
    asService(() => db.query(`select public.end_publish($1, $2, $3, $4, $5)`, [id, status, sha, files, error]));
  const summary = async () =>
    (await db.query<{ s: Summary }>(`select public.unpublished_summary() as s`)).rows[0].s;
  const run = async (id: string | number) =>
    (await db.query<Record<string, unknown>>(`select * from public.publish_runs where id = $1`, [id])).rows[0];
  const allYears = async () =>
    (await db.query<{ year: number }>(`select year from public.contests order by year`)).rows.map((r) => r.year);

  it('begin_publish inserts a running row started by the caller', async () => {
    const id = await begin();
    const r = await run(id);
    expect(r.status).toBe('running');
    expect(r.started_by).toBe(ADMIN);
    expect(r.finished_at).toBeNull();
  });

  it('begin_publish refuses while a run is running, then allows after end_publish', async () => {
    const id = await begin();
    await expect(begin()).rejects.toThrow(/publish already running/);
    await end(id, 'noop', null, 0, null);
    const id2 = await begin();
    expect(Number(id2)).toBeGreaterThan(Number(id));
  });

  it('a running row older than 10 minutes does not block, and is closed as error', async () => {
    const id = await begin();
    await db.query(`update public.publish_runs set started_at = now() - interval '11 minutes' where id = $1`, [id]);
    const id2 = await begin();
    expect(Number(id2)).toBeGreaterThan(Number(id));
    const stale = await run(id);
    expect(stale.status).toBe('error');
    expect(stale.error).toMatch(/timed out/);
    expect(stale.finished_at).not.toBeNull();
  });

  it('end_publish records the outcome and refuses a run that is not running', async () => {
    const id = await begin();
    await end(id, 'error', null, null, 'GitHub 409: Update is not a fast forward');
    const r = await run(id);
    expect(r.status).toBe('error');
    expect(r.error).toBe('GitHub 409: Update is not a fast forward');
    expect(r.finished_at).not.toBeNull();
    await expect(end(id, 'ok', 'abc', 1, null)).rejects.toThrow(/not running/);
    const id2 = await begin();
    await expect(end(id2, 'running', null, null, null)).rejects.toThrow(/invalid status/);
  });

  it('an ok run stamps contests.published_at and records sha and file count', async () => {
    await asUser(db, null);
    await db.exec(`update public.contests set published_at = null`);
    await asUser(db, ADMIN);
    const id = await begin();
    await end(id, 'ok', 'deadbeef', 3, null);
    const r = await run(id);
    expect(r).toMatchObject({ status: 'ok', commit_sha: 'deadbeef', files_changed: 3, error: null });
    const unstamped = await db.query(`select year from public.contests where published_at is distinct from $1`, [r.finished_at]);
    expect(unstamped.rows).toEqual([]);
  });

  it('an error run does not stamp published_at', async () => {
    await asUser(db, null);
    await db.exec(`update public.contests set published_at = null`);
    await asUser(db, ADMIN);
    const id = await begin();
    await end(id, 'error', null, null, 'boom');
    const stamped = await db.query(`select year from public.contests where published_at is not null`);
    expect(stamped.rows).toEqual([]);
  });

  it('unpublished_summary: no successful run yet, since is null and every year counts', async () => {
    const s = await summary();
    expect(s.since).toBeNull();
    expect(s.changed_years).toEqual(await allYears());
  });

  it('unpublished_summary: after an ok run, only the year of an edited entry counts', async () => {
    const id = await begin();
    await end(id, 'ok', 'deadbeef', 3, null);
    const s0 = await summary();
    expect(s0.changed_years).toEqual([]);
    const started = new Date((await run(id)).started_at as Date).getTime();
    expect(Math.abs(new Date(s0.since!).getTime() - started)).toBeLessThan(1);

    await asUser(db, null);
    await db.exec(`update public.contest_entries set artist = artist, updated_at = now() where year = 1999 and iso = 'SE'`);
    await asUser(db, ADMIN);
    expect((await summary()).changed_years).toEqual([1999]);
  });

  it('unpublished_summary: a contest edit counts too, and an error run does not reset since', async () => {
    const id = await begin();
    await end(id, 'ok', 'deadbeef', 3, null);
    await asUser(db, null);
    await db.exec(`update public.contests set updated_at = now() where year = 1974`);
    await asUser(db, ADMIN);
    const id2 = await begin();
    await end(id2, 'error', null, null, 'boom');
    expect((await summary()).changed_years).toEqual([1974]);
  });

  it('unpublished_summary: an edit made while a run is in flight stays unpublished', async () => {
    const id = await begin();
    // The run has read publish_input; the admin edits before it ends.
    await asUser(db, null);
    await db.exec(`update public.contest_entries set artist = artist, updated_at = now() where year = 1999 and iso = 'SE'`);
    await asUser(db, ADMIN);
    await end(id, 'ok', 'deadbeef', 3, null);
    expect((await summary()).changed_years).toEqual([1999]);
  });

  it('unpublished_summary: a noop run counts as published', async () => {
    const id = await begin();
    await end(id, 'ok', 'deadbeef', 3, null);
    await asUser(db, null);
    await db.exec(`update public.contests set updated_at = now() where year = 1974`);
    await asUser(db, ADMIN);
    const id2 = await begin();
    await end(id2, 'noop', null, 0, null);
    expect((await summary()).changed_years).toEqual([]);
  });

  it('non-admins are forbidden from begin_publish and unpublished_summary', async () => {
    await asUser(db, STRANGER);
    await expect(begin()).rejects.toThrow(/forbidden/);
    await expect(summary()).rejects.toThrow(/forbidden/);
  });

  it('grants: anon cannot call the admin RPCs; authenticated cannot call the service-role ones', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        await expect(db.query(`select public.publish_input()`), role).rejects.toThrow(/permission denied/);
        await expect(db.query(`select public.end_publish(1, 'ok', null, 0, null)`), role).rejects.toThrow(/permission denied/);
        if (role === 'anon') {
          await expect(db.query(`select public.begin_publish()`)).rejects.toThrow(/permission denied/);
          await expect(db.query(`select public.unpublished_summary()`)).rejects.toThrow(/permission denied/);
        }
      } finally {
        await db.exec(`reset role`);
      }
    }
    await db.exec(`set role anon`);
    try {
      await expect(db.query(`select * from public.publish_runs`)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role`);
    }
  });

  it('super admins can read publish_runs; other users see nothing', async () => {
    await begin();
    await db.exec(`set role authenticated`);
    try {
      expect((await db.query(`select id from public.publish_runs`)).rows).toHaveLength(1);
      await asUser(db, STRANGER);
      expect((await db.query(`select id from public.publish_runs`)).rows).toHaveLength(0);
    } finally {
      await db.exec(`reset role`);
    }
  });

  it('publish_input returns exactly the snapshot row columns, and builds the seeded DB', async () => {
    const input = await asService(async () =>
      (await db.query<{ i: SnapshotInput }>(`select public.publish_input() as i`)).rows[0].i,
    );
    expect(Object.keys(input).sort()).toEqual(['contests', 'countries', 'entries', 'generated_at']);
    expect(Object.keys(input.contests[0]).sort()).toEqual(
      ['cancelled', 'city', 'city_slug', 'final_date', 'host_iso', 'indexable', 'semi1_date', 'semi2_date', 'stage', 'year'],
    );
    expect(Object.keys(input.countries[0]).sort()).toEqual(['iso', 'name_el', 'name_en', 'related_iso', 'slug']);
    expect(Object.keys(input.entries[0]).sort()).toEqual([
      'artist', 'final_place', 'final_running_order', 'in_final', 'iso', 'jury_points', 'language', 'qualified',
      'semi', 'semi_place', 'semi_points', 'semi_running_order', 'song', 'source', 'televote_points', 'total_points', 'year',
    ]);
    expect(input.contests.map((c) => c.year)).toEqual(await allYears());
    expect(input.generated_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);

    const y2025 = input.contests.find((c) => c.year === 2025)!;
    expect(typeof y2025.final_date === 'string' || y2025.final_date === null).toBe(true);
    if (y2025.final_date) expect(y2025.final_date).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(input.contests.find((c) => c.year === 2020)!.cancelled).toBe(true);

    const files = buildSnapshotFiles(input);
    const contestFiles = Object.keys(files).filter((f) => /^content\/contests\/\d{4}\.json$/.test(f));
    expect(contestFiles).toHaveLength(input.contests.length);
    expect(files['content/site.json']).toContain('"generated_at": "' + input.generated_at + '"');
    const c2025 = JSON.parse(files['content/contests/2025.json']);
    expect(c2025.entries.find((e: { iso: string; final_place: number }) => e.final_place === 1).iso).toBe('AT');
  });

  it('publish_input generated_at is stable while the data is unchanged', async () => {
    const read = () => asService(async () =>
      (await db.query<{ g: string }>(`select public.publish_input()->>'generated_at' as g`)).rows[0].g,
    );
    const a = await read();
    expect(await read()).toBe(a);
  });
});

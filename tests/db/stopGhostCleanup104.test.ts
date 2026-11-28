// @vitest-environment node
// 104: the server never marks a player as left. A player who minimised the
// app days ago (semi-final to final) keeps their place, points and host role.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb } from './harness';

describe('104 no server-side ghost cleanup', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '104' });
    await db.exec(`
      insert into auth.users (id) values ('a0000000-0000-4000-8000-000000000104');
      insert into public.rooms (id, code, host_id, host_name, phase, password_hash, year, last_activity_at) values
        ('10000000-0000-4000-8000-000000000104', 'NOW104', 'a0000000-0000-4000-8000-000000000104', 'Α', 'lobby', '', public.live_contest_year(), now() - interval '10 days');
      insert into public.players (room_id, user_id, name, is_host) values
        ('10000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000104', 'Π', true);
      update public.players set last_seen_at = now() - interval '9 days' where name = 'Π';
    `);
  }, 120_000);

  afterAll(async () => { await db?.close(); });

  it('the daily room cleanup leaves a long-unseen player active', async () => {
    await db.query('select public.cleanup_inactive_rooms()');
    const r = await db.query<{ status: string; is_active: boolean }>(
      "select status::text, is_active from public.players where name = 'Π'");
    expect(r.rows[0]).toEqual({ status: 'active', is_active: true });
  });

  it('no hourly ghost cleanup job is scheduled', async () => {
    const r = await db.query<{ n: number }>("select count(*)::int n from cron.job where jobname = 'cleanup-ghost-players'");
    expect(r.rows[0].n).toBe(0);
  });
});

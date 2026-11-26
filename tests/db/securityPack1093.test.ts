// @vitest-environment node
// 093: security pack 1. Players (anon, authenticated) can no longer call the
// legacy point / result / cleanup functions, can't write room results, and
// the owner's definer functions still can.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';

const LOCKED = [
  'public.increment_quiz_points(uuid, integer)',
  'public.increment_pred_points(uuid, integer)',
  'public.resolve_duel_points(uuid, uuid, integer)',
  'public.spend_points(uuid, integer)',
  'public.spend_intel_points(uuid, integer)',
  'public.save_results(uuid, uuid, jsonb)',
  'public.score_all_predictions(uuid)',
  'public.send_notification(uuid, uuid, text, jsonb)',
  'public.cleanup_ghost_players()',
  'public.cleanup_inactive_rooms()',
  'public.increment_poll_count(integer, text)',
  'public.resolve_sudden_death(uuid)',
];

describe('093 security pack 1', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await asUser(db, null);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('every locked function exists', async () => {
    for (const fn of LOCKED) {
      const r = await db.query<{ ok: boolean }>(`select to_regprocedure($1) is not null as ok`, [fn]);
      expect(r.rows[0].ok, fn).toBe(true);
    }
  });

  it('anon and authenticated lost EXECUTE; service_role and the owner keep it', async () => {
    for (const fn of LOCKED) {
      const r = await db.query<{ anon: boolean; auth: boolean; svc: boolean; pub: boolean }>(
        `select has_function_privilege('anon', $1, 'EXECUTE') as anon,
                has_function_privilege('authenticated', $1, 'EXECUTE') as auth,
                has_function_privilege('service_role', $1, 'EXECUTE') as svc,
                exists (select 1 from aclexplode((select proacl from pg_proc where oid = to_regprocedure($1)))
                        where grantee = 0 and privilege_type = 'EXECUTE') as pub`,
        [fn],
      );
      expect(r.rows[0], fn).toEqual({ anon: false, auth: false, svc: true, pub: false });
    }
  });

  it('every locked function has a fixed search_path', async () => {
    for (const fn of LOCKED) {
      const r = await db.query<{ cfg: string[] | null }>(
        `select proconfig as cfg from pg_proc where oid = to_regprocedure($1)`,
        [fn],
      );
      expect(r.rows[0].cfg ?? [], fn).toContain('search_path=public, pg_temp');
    }
  });

  it('players can read room results but not write them', async () => {
    const r = await db.query<{ policyname: string; cmd: string }>(
      `select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'results' order by policyname`,
    );
    expect(r.rows.map((p) => p.cmd)).toEqual(['SELECT']);
  });

  it('players hold no TRUNCATE, TRIGGER or REFERENCES on public tables', async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from information_schema.role_table_grants
        where table_schema = 'public' and grantee in ('anon', 'authenticated')
          and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')`,
    );
    expect(r.rows[0].n).toBe(0);
  });

  it('an authenticated player calling a locked function is refused', async () => {
    await db.exec(`set role authenticated`);
    try {
      await expect(
        db.query(`select public.increment_quiz_points('00000000-0000-0000-0000-000000000001'::uuid, 100000)`),
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await db.exec(`reset role`);
    }
  });
});

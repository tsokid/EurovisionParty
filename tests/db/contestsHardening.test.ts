// @vitest-environment node
// Final-review M3 (070 grants under Supabase default privileges), M5
// (contests.city_slug format check) and M1 (entries_with_names view).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, applyMigration, seed2026Lineup } from './harness';

const RELATIONS = ['contests', 'countries', 'contest_entries', 'current_entries', 'current_participants', 'entries_with_names'];
const WRITES = ['insert', 'update', 'delete', 'truncate'];

type Priv = { rel: string; role: string; priv: string; ok: boolean };

async function privileges(db: PGlite, roles: string[], privs: string[]): Promise<Priv[]> {
  const r = await db.query<Priv>(
    `select rel, role, priv, has_table_privilege(role, 'public.' || rel, priv) as ok
       from unnest($1::text[]) rel, unnest($2::text[]) role, unnest($3::text[]) priv
      order by 1, 2, 3`,
    [RELATIONS, roles, privs],
  );
  return r.rows;
}

// Supabase grants anon and authenticated everything on public tables, directly
// and through default privileges. Simulate that before 070 and prove 070
// leaves them read-only on its tables and views.
describe('070 grants under Supabase default privileges (M3)', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '069' });
    await seed2026Lineup(db, 25);
    await db.exec(`
      grant all on all tables in schema public to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated;
    `);
    await applyMigration(db, '070');
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('anon and authenticated can select but not write', async () => {
    const roles = ['anon', 'authenticated'];
    expect((await privileges(db, roles, ['select'])).every((p) => p.ok)).toBe(true);
    expect((await privileges(db, roles, WRITES)).filter((p) => p.ok)).toEqual([]);
  });

  it('anon insert into countries is refused', async () => {
    await db.exec(`set role anon`);
    try {
      await expect(
        db.query(`insert into public.countries (iso, name_en, name_el, slug) values ('XX', 'X', 'X', 'x')`),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role`);
    }
  });
});

describe('070 grants and city_slug check on a plain database (M3, M5)', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '070' });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('entries_with_names: every year, with names, security_invoker (M1)', async () => {
    await db.exec(`begin`);
    try {
      await db.exec(`
        insert into public.contests (year, city, city_slug, stage) values (2025, 'Basel', 'basel', 'archived');
        insert into public.contest_entries (year, iso, artist, in_final, final_place) values (2025, 'AT', 'JJ', true, 1);
      `);
      const r = await db.query<Record<string, unknown>>(
        `select year, iso, artist, in_final, final_place, name_en, name_el from public.entries_with_names
          where year = 2025`,
      );
      expect(r.rows).toEqual([
        { year: 2025, iso: 'AT', artist: 'JJ', in_final: true, final_place: 1, name_en: 'Austria', name_el: 'Αυστρία' },
      ]);
      const n = await db.query<{ v: number; e: number }>(
        `select (select count(*)::int from public.entries_with_names) as v,
                (select count(*)::int from public.contest_entries) as e`,
      );
      expect(n.rows[0].v).toBe(n.rows[0].e);
    } finally {
      await db.exec(`rollback`);
    }
    const o = await db.query<{ opts: string[] | null }>(
      `select reloptions as opts from pg_class where oid = 'public.entries_with_names'::regclass`,
    );
    expect(o.rows[0].opts).toContain('security_invoker=true');
  });

  it('service_role can select the three tables and the views', async () => {
    expect((await privileges(db, ['service_role'], ['select'])).filter((p) => !p.ok)).toEqual([]);
  });

  it.each(['Basel', 'new york', 'malmö', '-basel', 'basel-', 'basel--city', 'basel2', ''])(
    'rejects city_slug %j',
    async (slug) => {
      await expect(
        db.query(`insert into public.contests (year, city, city_slug) values (2040, 'X', $1)`, [slug]),
      ).rejects.toThrow(/contests_city_slug_check/);
    },
  );

  it('accepts lowercase hyphenated slugs', async () => {
    await db.exec(`begin`);
    try {
      await db.query(`insert into public.contests (year, city, city_slug) values (2040, 'X', 'basel')`);
      await db.query(`insert into public.contests (year, city, city_slug) values (2041, 'X', 'tel-aviv')`);
    } finally {
      await db.exec(`rollback`);
    }
  });
});

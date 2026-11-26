// @vitest-environment node
// 094: intel bought only for the caller, at the server's price; reveals only
// for members who bought them. Runs supabase/tests/094_intel_server_side.test.sql.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';
import { INTEL_COSTS } from '../../src/lib/constants';

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL_TEST = path.resolve(here, '../../supabase/tests/094_intel_server_side.test.sql');
const MIGRATION = path.resolve(here, '../../supabase/migrations/094_intel_server_side.sql');

describe('094 intel on the server', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await asUser(db, null);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('the SQL proof passes and leaves nothing behind', async () => {
    await db.exec(readFileSync(SQL_TEST, 'utf8'));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.rooms where code in ('INT094', 'INT095')`);
    expect(left.rows[0].n).toBe(0);
  });

  it('server prices match the client price list', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    for (const [type, cost] of Object.entries(INTEL_COSTS)) {
      expect(sql, type).toMatch(new RegExp(`when '${type}'\\s+then ${cost}\\b`));
    }
  });
});

// In-process Postgres (PGlite) with the Supabase migrations applied, for
// SQL-level tests. There is no Docker or Supabase CLI here, and production
// is locked, so this is where migration behaviour gets tested.
//
// Supabase platform objects (auth, cron, vault, net, roles, the realtime
// publication) are emulated by platformStubs.sql. Statements PGlite cannot
// run go through PATCHES, which must only ever touch platform constructs.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, '../../supabase/migrations');
const STUBS_FILE = path.join(here, 'platformStubs.sql');

/**
 * Per-migration text patches, keyed by full filename. Platform constructs
 * only (extensions, publications, cron/vault/net grants, Supabase role
 * privileges). Never tables, columns, functions, policies or triggers.
 * Every entry carries a one-line reason.
 */
export const PATCHES: Record<string, (sql: string) => string> = {};

/** Migration filenames in apply order (plain string sort, so 019_ < 019b_). */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * True when `prefix` names `file`. A bare number matches every file with
 * that number ('021' matches both 021_ files, '019' does not match 019b_);
 * anything longer is a plain filename prefix ('021_parser', '019b').
 */
function matches(file: string, prefix: string): boolean {
  if (!file.startsWith(prefix)) return false;
  if (/^\d+$/.test(prefix)) return /^[_.]/.test(file.slice(prefix.length));
  return true;
}

async function runFile(db: PGlite, file: string): Promise<void> {
  let sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  const patch = PATCHES[file];
  if (patch) sql = patch(sql);
  try {
    await db.exec(sql);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`migration ${file} failed: ${msg}`, { cause: e });
  }
}

/**
 * Fresh PGlite with platformStubs.sql and the migrations applied in order,
 * through the last file matching `upTo` (default: all of them).
 */
export async function createDb(opts: { upTo?: string } = {}): Promise<PGlite> {
  const files = migrationFiles();
  let last = files.length - 1;
  if (opts.upTo !== undefined) {
    const upTo = opts.upTo;
    last = files.findLastIndex((f) => matches(f, upTo));
    if (last < 0) throw new Error(`createDb: no migration matches upTo '${upTo}'`);
  }

  const db = await PGlite.create({ extensions: { pgcrypto } });
  try {
    await db.exec(readFileSync(STUBS_FILE, 'utf8'));
    for (const file of files.slice(0, last + 1)) await runFile(db, file);
  } catch (e) {
    await db.close();
    throw e;
  }
  return db;
}

/** Applies exactly one migration file (with PATCHES). The prefix must be unambiguous. */
export async function applyMigration(db: PGlite, prefix: string): Promise<void> {
  const hits = migrationFiles().filter((f) => matches(f, prefix));
  if (hits.length === 0) throw new Error(`applyMigration: no migration matches '${prefix}'`);
  if (hits.length > 1) {
    throw new Error(`applyMigration: '${prefix}' is ambiguous, ${hits.length} migrations match: ${hits.join(', ')}`);
  }
  await runFile(db, hits[0]);
}

/** Makes auth.uid() return `uid` for this connection; null means anonymous. */
export async function asUser(db: PGlite, uid: string | null): Promise<void> {
  await db.query(`select set_config('test.uid', $1, false)`, [uid ?? '']);
}

/** Inserts the auth.users and super_admins rows that make `uid` a super admin. */
export async function makeAdmin(db: PGlite, uid: string, email: string): Promise<void> {
  await db.query(`insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing`, [uid, email]);
  await db.query(
    `insert into public.super_admins (user_id, email) values ($1, $2) on conflict (user_id) do nothing`,
    [uid, email],
  );
}

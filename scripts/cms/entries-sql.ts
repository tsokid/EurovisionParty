// Claude's write path for public contest entries (owner, 19 Nov 2026: semi-final
// results reach the public pages by hand: the owner sends a link, Claude
// fetches it and updates the CMS).
//
// Turns an entries file into one SQL transaction that calls the CMS's own
// upsert_contest_entry RPC as a super admin, so every write goes through the
// same checks as the Contests editor (field allow-list, locked years, a
// non-finalist losing its final results). All or nothing. Nothing is
// published: the owner reviews in Contests → Edit and Publishes.
//
//   npx tsx scripts/cms/entries-sql.ts <entries.json> --as <admin email> > out.sql
//   psql "$PGURL" -v ON_ERROR_STOP=1 -f out.sql
//
// entries.json: { "year": 2027, "entries": [ { "iso": "GR", "fields": { "semi": 1, "semi_place": 3, "qualified": true } } ] }
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FIELDS = [
  'artist', 'song', 'language', 'semi', 'semi_running_order', 'semi_place', 'semi_points',
  'qualified', 'in_final', 'final_running_order', 'final_place', 'total_points', 'jury_points',
  'televote_points', 'source',
] as const;

export type EntriesFile = {
  year: number;
  entries: Array<{ iso: string; fields: Record<string, string | number | boolean | null> }>;
};

const quote = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/** Throws on anything the RPC would refuse that can be caught before the database. */
export function validate(file: EntriesFile): void {
  if (!Number.isInteger(file.year) || file.year < 1956 || file.year > 2100) throw new Error(`bad year ${file.year}`);
  if (!Array.isArray(file.entries) || file.entries.length === 0) throw new Error('no entries');
  const seen = new Set<string>();
  for (const e of file.entries) {
    if (!/^[A-Z]{2}$/.test(e.iso)) throw new Error(`bad iso ${e.iso}`);
    if (seen.has(e.iso)) throw new Error(`duplicate iso ${e.iso}`);
    seen.add(e.iso);
    const keys = Object.keys(e.fields ?? {});
    if (keys.length === 0) throw new Error(`${e.iso}: no fields`);
    for (const k of keys) {
      if (!(FIELDS as readonly string[]).includes(k)) throw new Error(`${e.iso}: unknown field ${k}`);
    }
  }
}

/** The SQL transaction: act as the admin `email`, then one upsert_contest_entry per country. */
export function entriesSql(file: EntriesFile, email: string): string {
  validate(file);
  if (!/^[^@\s']+@[^@\s']+$/.test(email)) throw new Error(`bad email ${email}`);
  const lines = [
    'begin;',
    `select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true)`,
    `  from public.super_admins where email = ${quote(email)};`,
    `do $$ begin if not public.is_super_admin() then raise exception 'not a super admin'; end if; end $$;`,
    ...file.entries.map(
      (e) => `select public.upsert_contest_entry(${file.year}, ${quote(e.iso)}, ${quote(JSON.stringify(e.fields))}::jsonb);`,
    ),
    'commit;',
  ];
  return lines.join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [path, flag, email] = process.argv.slice(2);
  if (!path || flag !== '--as' || !email) {
    console.error('usage: tsx scripts/cms/entries-sql.ts <entries.json> --as <admin email>');
    process.exit(2);
  }
  process.stdout.write(entriesSql(JSON.parse(readFileSync(path, 'utf8')) as EntriesFile, email));
}

// Builds the initial content/ snapshot without a database.
//
//   tsx scripts/snapshot/build-local.ts [--force]
//
// * 1956-2025: data/history/*.json (the same records migration 073 imports).
// * 2026: data/history/2026.json (imported with
//   `tsx scripts/history/import.ts --from 2026 --to 2026 --snapshot-only`,
//   never part of 073), as stage finalized like the 070 seed. If that file
//   is missing, falls back to the COUNTRIES_2026 lineup with no results
//   (only the Big Four and host marked as finalists).
// * countries: the VALUES block of migration 070 (single source).
//
// generated_at is fixed so rebuilding gives byte-identical files. The first
// production Publish replaces everything, 2026 included, with database data.
// From then on this script must not run: it would overwrite production 2026
// with the Wikipedia copy. It refuses when content/site.json carries a
// Publish's generated_at (anything but LOCAL_GENERATED_AT), unless --force.
//
// vercel.json gets the generated contest-year redirects through the same
// mergeVercelRedirects(generatedRedirects(contests)) as Publish, so the
// repo matches what Publish would write for this snapshot.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshotFiles } from '../../supabase/functions/publish-content/snapshot';
import { generatedRedirects, mergeVercelRedirects } from '../../supabase/functions/publish-content/redirects';
import type { ContestRow, EntryRow } from '../../src/content/contests/types';
import { DATA_DIR, loadRecords, slugify } from '../history/import';
import type { ContestRecord } from '../history/parseContest';
import { COUNTRIES_2026 } from '../../src/lib/countries2026';
import { readCountriesSeed } from './countriesSeed';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
export const LOCAL_GENERATED_AT = '1970-01-01T00:00:00Z';

/** The 2026 contest row as seeded in migration 070 (stage finalized, not indexable). */
const CONTEST_2026: ContestRow = {
  year: 2026,
  host_iso: 'AT',
  city: 'Vienna',
  city_slug: 'vienna',
  semi1_date: '2026-05-12',
  semi2_date: '2026-05-14',
  final_date: '2026-05-16',
  stage: 'finalized',
  indexable: false,
  cancelled: false,
};

const contestRow = (r: ContestRecord): ContestRow => ({
  year: r.year,
  host_iso: r.host_iso,
  city: r.city,
  city_slug: slugify(r.city),
  semi1_date: r.semi1_date,
  semi2_date: r.semi2_date,
  final_date: r.final_date,
  stage: 'archived',
  indexable: false,
  cancelled: r.cancelled,
});

const entryRows = (records: ContestRecord[]): EntryRow[] =>
  records.flatMap((r) =>
    r.entries.map((e) => ({
      year: r.year,
      iso: e.iso,
      artist: e.artist,
      song: e.song,
      language: null,
      semi: e.semi,
      semi_running_order: null,
      semi_place: e.semi_place,
      semi_points: e.semi_points,
      qualified: e.qualified,
      in_final: e.in_final,
      final_running_order: e.final_running_order,
      final_place: e.final_place,
      total_points: e.total_points,
      jury_points: e.jury_points,
      televote_points: e.televote_points,
      source: 'import:wikipedia',
    })),
  );

/** 2026 from data/history/2026.json, or null when the file is missing. */
export function load2026(file = path.join(DATA_DIR, '2026.json')): { contest: ContestRow; entries: EntryRow[] } | null {
  if (!existsSync(file)) return null;
  const r = JSON.parse(readFileSync(file, 'utf8')) as ContestRecord;
  if (r.year !== 2026) throw new Error(`${file}: year ${r.year}, expected 2026`);
  return {
    contest: { ...contestRow(r), stage: CONTEST_2026.stage, indexable: CONTEST_2026.indexable },
    entries: entryRows([r]),
  };
}

/** 2026 lineup from COUNTRIES_2026 with no results: the fallback when 2026.json is missing. */
function fallback2026(): EntryRow[] {
  const entries: EntryRow[] = [];
  for (const c of COUNTRIES_2026) {
    const inSemi = c.semi === 1 || c.semi === 2;
    entries.push({
      year: 2026,
      iso: c.id,
      artist: c.artist ?? null,
      song: c.song ?? null,
      language: c.language ?? null,
      semi: inSemi ? (c.semi as 1 | 2) : null,
      semi_running_order: inSemi ? (c.runningOrder ?? null) : null,
      semi_place: null,
      semi_points: null,
      qualified: null,
      in_final: !inSemi, // Big Four and host qualify automatically
      final_running_order: null,
      final_place: null,
      total_points: null,
      jury_points: null,
      televote_points: null,
      source: 'manual',
    });
  }
  return entries;
}

export function localInput() {
  const records = loadRecords();
  const contests = records.map(contestRow);
  const entries = entryRows(records);
  const y2026 = load2026();
  if (y2026) {
    contests.push(y2026.contest);
    entries.push(...y2026.entries);
  } else {
    console.warn('data/history/2026.json missing: 2026 falls back to COUNTRIES_2026 with no results');
    contests.push(CONTEST_2026);
    entries.push(...fallback2026());
  }
  return { contests, countries: readCountriesSeed(), entries, generated_at: LOCAL_GENERATED_AT };
}

/**
 * Throws unless `siteJson` (content/site.json text, or null when absent) is a
 * local build: after the first Publish, rebuilding locally would replace
 * production data. `force` skips the check.
 */
export function assertLocalSnapshot(siteJson: string | null, force: boolean): void {
  if (force || siteJson === null) return;
  const generatedAt = (JSON.parse(siteJson) as { generated_at?: string }).generated_at;
  if (generatedAt !== LOCAL_GENERATED_AT) {
    throw new Error(
      `content/site.json was written by Publish (generated_at ${generatedAt}); build-local would overwrite ` +
        'production data with the Wikipedia copy. Refusing. Pass --force only if you mean it.',
    );
  }
}

function main() {
  const siteFile = path.join(ROOT, 'content/site.json');
  assertLocalSnapshot(existsSync(siteFile) ? readFileSync(siteFile, 'utf8') : null, process.argv.includes('--force'));
  const input = localInput();
  const files = buildSnapshotFiles(input);
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(ROOT, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text, 'utf8');
  }
  const vercelFile = path.join(ROOT, 'vercel.json');
  const vercel = readFileSync(vercelFile, 'utf8').replace(/\r\n/g, '\n');
  writeFileSync(vercelFile, mergeVercelRedirects(vercel, generatedRedirects(input.contests)), 'utf8');
  console.log(`wrote ${Object.keys(files).length} files under content/ and vercel.json`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

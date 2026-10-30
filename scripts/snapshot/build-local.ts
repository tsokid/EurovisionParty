// Builds the initial content/ snapshot without a database.
//
//   tsx scripts/snapshot/build-local.ts
//
// * 1956-2025: data/history/*.json (the same records migration 073 imports).
// * 2026: the lineup from COUNTRIES_2026 plus the contest row seeded in 070
//   (Vienna, stage finalized). No places or points: the finalists are only
//   known from the production table 070 copied, so here only the
//   auto-qualifiers (Big Four and host) are marked in_final; semi-final
//   entrants have in_final false and qualified null (unknown).
// * countries: the VALUES block of migration 070 (single source).
//
// generated_at is fixed so rebuilding gives byte-identical files. The first
// production Publish replaces everything, 2026 included, with database data.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshotFiles } from '../../supabase/functions/publish-content/snapshot';
import type { ContestRow, EntryRow } from '../../src/content/contests/types';
import { loadRecords, slugify } from '../history/import';
import { COUNTRIES_2026 } from '../../src/lib/countries2026';
import { readCountriesSeed } from './countriesSeed';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
export const LOCAL_GENERATED_AT = '1970-01-01T00:00:00Z';

/** The 2026 contest row as seeded in migration 070. */
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

export function localInput() {
  const records = loadRecords();
  const contests: ContestRow[] = records.map((r) => ({
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
  }));
  const entries: EntryRow[] = records.flatMap((r) =>
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

  contests.push(CONTEST_2026);
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

  return { contests, countries: readCountriesSeed(), entries, generated_at: LOCAL_GENERATED_AT };
}

function main() {
  const files = buildSnapshotFiles(localInput());
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(ROOT, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text, 'utf8');
  }
  console.log(`wrote ${Object.keys(files).length} files under content/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

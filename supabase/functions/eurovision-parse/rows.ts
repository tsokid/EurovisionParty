// supabase/functions/eurovision-parse/rows.ts
// Pure mapping from parser output to contest_entries rows, as sent to
// parser_upsert_entries (migration 071, section C). No Deno APIs and no
// imports, so vitest can import it (tests/functions/parserRows.test.ts).
//
// Semi rows (Task 9) carry only the semi columns; parser_upsert_entries
// kind 'semis' never touches in_final, final_* or the points columns.
//
// Every parsed participant is a grand finalist (in_final: true); its
// running order is passed through as parsed, usually null.
//
// Country names are not written: contest_entries has no name column,
// names live in countries.

export interface ParticipantInput {
  iso: string;
  artist: string;
  song: string;
  runningOrder: number | null;
}

export interface ResultInput {
  iso: string;
  ranking: number;
  total: number;
  jury: number;
  televote: number;
}

export interface ParticipantEntryRow {
  year: number;
  iso: string;
  artist: string;
  song: string;
  in_final: true;
  final_running_order: number | null;
  source: string;
}

export interface ResultEntryRow {
  year: number;
  iso: string;
  final_place: number;
  total_points: number;
  jury_points: number;
  televote_points: number;
  source: string;
}

export function participantRows(
  year: number,
  parsed: ParticipantInput[],
  source: string,
): ParticipantEntryRow[] {
  return parsed.map((p) => ({
    year,
    iso: p.iso,
    artist: p.artist,
    song: p.song,
    in_final: true,
    final_running_order: p.runningOrder,
    source,
  }));
}

export function resultRows(
  year: number,
  parsed: ResultInput[],
  source: string,
): ResultEntryRow[] {
  return parsed.map((r) => ({
    year,
    iso: r.iso,
    final_place: r.ranking,
    total_points: r.total,
    jury_points: r.jury,
    televote_points: r.televote,
    source,
  }));
}

export interface SemiInput {
  iso: string;
  runningOrder: number | null;
  place: number | null;
  points: number | null;
  qualified: boolean | null;
}

export interface SemiEntryRow {
  year: number;
  iso: string;
  semi: 1 | 2;
  semi_running_order: number | null;
  semi_place: number | null;
  semi_points: number | null;
  qualified: boolean | null;
  source: string;
}

export function semiRows(
  year: number,
  semi: 1 | 2,
  parsed: SemiInput[],
  source: string,
): SemiEntryRow[] {
  return parsed.map((s) => ({
    year,
    iso: s.iso,
    semi,
    semi_running_order: s.runningOrder,
    semi_place: s.place,
    semi_points: s.points,
    qualified: s.qualified,
    source,
  }));
}

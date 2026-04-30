// supabase/functions/eurovision-parse/parseResults.ts
// Extracts the grand-final scoreboard from the eurovision.com page.
//
// Output shape matches the columns of public.eurovision_2026_results:
//   iso, ranking, total_points, jury_points, televote_points, source
//
// The scoreboard markup on eurovision.com is HTML-fragile. We support two
// shapes: a classic <table class="scoreboard"> with cells in column order
// (rank, country, total, jury, audience), and a data-attribute markup
// (data-iso="..." data-rank="..." data-total="..." data-jury="..." data-audience="...")
// that we suspect they may use during the live show. parseResults tries the
// data-attribute form first, then the table form.

import { COUNTRY_TO_ISO, isoFor, stripTags } from "./parse.ts";

export interface ResultRow {
  iso: string;
  ranking: number;
  total_points: number;
  jury_points: number;
  televote_points: number;
  source: string;
}

// ---------------------------------------------------------------------------
// Shape 1: data attributes
// e.g. <li data-iso="SE" data-rank="1" data-total="583" data-jury="340" data-audience="243">
// ---------------------------------------------------------------------------
const DATA_ATTR_RX =
  /data-iso="([A-Z]{2})"[^>]*data-rank="(\d{1,2})"[^>]*data-total="(\d{1,4})"[^>]*data-jury="(\d{1,4})"[^>]*data-audience="(\d{1,4})"/g;

function extractDataAttr(html: string, source: string): ResultRow[] {
  const rows: ResultRow[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(DATA_ATTR_RX)) {
    const iso = m[1];
    if (seen.has(iso)) continue;
    seen.add(iso);
    rows.push({
      iso,
      ranking: parseInt(m[2], 10),
      total_points: parseInt(m[3], 10),
      jury_points: parseInt(m[4], 10),
      televote_points: parseInt(m[5], 10),
      source,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Shape 2: <table class="scoreboard">
// Cell order assumed: rank, country, total, jury, audience.
// Tolerant of extra attributes inside <td>; tolerant of <a>, <span>, <img>
// inside the country cell (stripTags drops them).
// ---------------------------------------------------------------------------
const TABLE_RX =
  /<table[^>]*class="[^"]*scoreboard[^"]*"[^>]*>([\s\S]*?)<\/table>/i;

function extractTable(html: string, source: string): ResultRow[] {
  const tableMatch = TABLE_RX.exec(html);
  if (!tableMatch) return [];
  const tableHtml = tableMatch[1];
  const rows: ResultRow[] = [];
  const seen = new Set<string>();
  const trs = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const tr of trs) {
    const cells = [...tr[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
      .map((c) => stripTags(c[1]).trim());
    if (cells.length < 5) continue;
    const ranking = parseInt(cells[0], 10);
    if (!Number.isFinite(ranking)) continue; // header row
    const country = cells[1];
    const iso = isoFor(country);
    if (!iso || seen.has(iso)) continue;
    const total = parseInt(cells[2].replace(/\D/g, ''), 10);
    const jury = parseInt(cells[3].replace(/\D/g, ''), 10);
    const tele = parseInt(cells[4].replace(/\D/g, ''), 10);
    if (![total, jury, tele].every(Number.isFinite)) continue;
    seen.add(iso);
    rows.push({
      iso,
      ranking,
      total_points: total,
      jury_points: jury,
      televote_points: tele,
      source,
    });
  }
  return rows;
}

/**
 * Extract scoreboard rows from a Eurovision grand-final page. Returns [] when
 * neither shape matches (e.g. the page hasn't published results yet).
 *
 * Source URL is recorded on every row for audit; pass the URL the caller
 * actually fetched.
 */
export function parseResults(html: string, source: string): ResultRow[] {
  const dataAttrRows = extractDataAttr(html, source);
  if (dataAttrRows.length > 0) return dataAttrRows;
  return extractTable(html, source);
}

// Re-export for test harnesses.
export { COUNTRY_TO_ISO, isoFor };

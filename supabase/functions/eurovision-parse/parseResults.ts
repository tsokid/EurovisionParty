// supabase/functions/eurovision-parse/parseResults.ts
// Extracts the grand-final scoreboard from the eurovision.com page.
//
// Output shape matches the columns of public.eurovision_2026_results:
//   iso, ranking, total_points, jury_points, televote_points, source
//
// The scoreboard markup on eurovision.com is HTML-fragile. We support three
// shapes (in order of preference):
//
//   1. `aria-label="Scoreboard entry for <Country>"` block (current 2025+
//      format). Each entry has scoreboard-rank, "<N> points", Jury <span>,
//      Audience <span>.
//   2. `data-iso/data-rank/data-total/data-jury/data-audience` attributes
//      (kept as a forward-compat path; not seen on the live 2025 page but
//      cheap to retain in case the site reverts).
//   3. Classic `<table class="scoreboard">` cell-order (rank, country,
//      total, jury, audience) — legacy fallback.

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

// ---------------------------------------------------------------------------
// Shape 3 (CURRENT 2025+): aria-label-anchored scoreboard entry blocks
// ---------------------------------------------------------------------------
const ARIA_RX = new RegExp(
  // Anchor: aria-label="Scoreboard entry for <Country>"
  'aria-label="Scoreboard entry for ([^"]+)"' +
  // Then within ~6KB of the entry, the rank
  '[\\s\\S]{0,6000}?scoreboard-rank">(\\d+)<' +
  // Then total points ("<N> points")
  '[\\s\\S]{0,6000}?>(\\d+)\\s+points<' +
  // Then jury value
  '[\\s\\S]{0,6000}?>Jury</span>\\s*<span>\\s*(\\d+)\\s*</span>' +
  // Then audience (televote) value
  '[\\s\\S]{0,6000}?>Audience</span>\\s*<span>\\s*(\\d+)\\s*</span>',
  'g',
);

function extractAriaScoreboard(html: string, source: string): ResultRow[] {
  const rows: ResultRow[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(ARIA_RX)) {
    const country = m[1].trim();
    const iso = isoFor(country);
    if (!iso || seen.has(iso)) continue;
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

/**
 * Extract scoreboard rows from a Eurovision grand-final page. Returns [] when
 * none of the three shapes match (e.g. the page hasn't published results yet).
 *
 * Source URL is recorded on every row for audit; pass the URL the caller
 * actually fetched.
 */
export function parseResults(html: string, source: string): ResultRow[] {
  const aria = extractAriaScoreboard(html, source);
  if (aria.length > 0) return aria;
  const dataAttrRows = extractDataAttr(html, source);
  if (dataAttrRows.length > 0) return dataAttrRows;
  return extractTable(html, source);
}

// Re-export for test harnesses.
export { COUNTRY_TO_ISO, isoFor };

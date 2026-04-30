// Run with: deno test --allow-net=0 supabase/functions/eurovision-parse/__tests__/
// Pure HTML-in rows-out tests; no network.

import {
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseResults } from "../parseResults.ts";

const SOURCE = "https://example.test/grand-final";

// ---------------------------------------------------------------------------
// Shape 1: data-attribute markup
// ---------------------------------------------------------------------------
Deno.test("parseResults extracts rows from data-attribute markup", () => {
  const html = `
    <ul class="results">
      <li data-iso="SE" data-rank="1" data-total="583" data-jury="340" data-audience="243">Sweden</li>
      <li data-iso="FI" data-rank="2" data-total="526" data-jury="150" data-audience="376">Finland</li>
      <li data-iso="DE" data-rank="26" data-total="18" data-jury="15" data-audience="3">Germany</li>
    </ul>
  `;
  const rows = parseResults(html, SOURCE);
  assertEquals(rows.length, 3);
  assertEquals(rows[0], {
    iso: "SE", ranking: 1, total_points: 583,
    jury_points: 340, televote_points: 243, source: SOURCE,
  });
  assertEquals(rows[2].iso, "DE");
  assertEquals(rows[2].ranking, 26);
});

Deno.test("parseResults dedupes rows by iso (data-attr shape)", () => {
  const html = `
    <li data-iso="SE" data-rank="1" data-total="583" data-jury="340" data-audience="243">Sweden</li>
    <li data-iso="SE" data-rank="1" data-total="583" data-jury="340" data-audience="243">Sweden (dup)</li>
  `;
  const rows = parseResults(html, SOURCE);
  assertEquals(rows.length, 1);
});

// ---------------------------------------------------------------------------
// Shape 2: <table class="scoreboard">
// ---------------------------------------------------------------------------
Deno.test("parseResults extracts rows from scoreboard table", () => {
  const html = `
    <h2>Final scoreboard</h2>
    <table class="scoreboard">
      <thead><tr><th>Rank</th><th>Country</th><th>Total</th><th>Jury</th><th>Audience</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>Sweden</td><td>583</td><td>340</td><td>243</td></tr>
        <tr><td>2</td><td>Finland</td><td>526</td><td>150</td><td>376</td></tr>
        <tr><td>26</td><td>Germany</td><td>18</td><td>15</td><td>3</td></tr>
      </tbody>
    </table>
  `;
  const rows = parseResults(html, SOURCE);
  assertEquals(rows.length, 3);
  assertEquals(rows[0].iso, "SE");
  assertEquals(rows[1].iso, "FI");
  assertEquals(rows[2].iso, "DE");
  assertEquals(rows[1].televote_points, 376);
});

Deno.test("parseResults skips the header row in scoreboard table", () => {
  const html = `
    <table class="scoreboard">
      <tr><th>Rank</th><th>Country</th><th>Total</th><th>Jury</th><th>Audience</th></tr>
      <tr><td>1</td><td>Sweden</td><td>583</td><td>340</td><td>243</td></tr>
    </table>
  `;
  const rows = parseResults(html, SOURCE);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].iso, "SE");
});

Deno.test("parseResults skips countries not in COUNTRY_TO_ISO", () => {
  const html = `
    <table class="scoreboard">
      <tr><td>1</td><td>Atlantis</td><td>10</td><td>5</td><td>5</td></tr>
      <tr><td>2</td><td>Sweden</td><td>9</td><td>4</td><td>5</td></tr>
    </table>
  `;
  const rows = parseResults(html, SOURCE);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].iso, "SE");
});

Deno.test("parseResults handles country cell with anchor + flag image", () => {
  const html = `
    <table class="scoreboard">
      <tr>
        <td>1</td>
        <td><a href="/sweden"><img src="/flags/se.png" alt="SE">Sweden</a></td>
        <td>583</td><td>340</td><td>243</td>
      </tr>
    </table>
  `;
  const rows = parseResults(html, SOURCE);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].iso, "SE");
});

Deno.test("parseResults returns [] when neither shape matches", () => {
  const html = `<html><body><h1>Nothing here</h1></body></html>`;
  const rows = parseResults(html, SOURCE);
  assertEquals(rows.length, 0);
});

Deno.test("parseResults prefers data-attribute markup when both shapes are present", () => {
  // If both markups appear, data-attr wins (more specific, less brittle).
  const html = `
    <li data-iso="SE" data-rank="1" data-total="583" data-jury="340" data-audience="243">Sweden</li>
    <table class="scoreboard">
      <tr><td>1</td><td>Norway</td><td>500</td><td>250</td><td>250</td></tr>
    </table>
  `;
  const rows = parseResults(html, SOURCE);
  assertEquals(rows.length, 1);
  assertStrictEquals(rows[0].iso, "SE");
});

Deno.test("parseResults records the supplied source URL on every row", () => {
  const html = `
    <li data-iso="SE" data-rank="1" data-total="583" data-jury="340" data-audience="243"></li>
    <li data-iso="FI" data-rank="2" data-total="526" data-jury="150" data-audience="376"></li>
  `;
  const url = "https://www.eurovision.com/eurovision-song-contest/vienna-2026/vienna-2026-grand-final/";
  const rows = parseResults(html, url);
  assertEquals(rows.every((r) => r.source === url), true);
});

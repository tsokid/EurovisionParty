// Pure HTML-in rows-out tests for the participants extractors. No network.

import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractEurovision,
  extractWikipedia,
  isoFor,
} from "../parse.ts";

Deno.test("extractEurovision pulls rows from data-iso markup", () => {
  const html = `
    <article data-iso="SE" data-name="Sweden" data-artist="KAJ" data-song="Bara Bada Bastu" data-order="3"></article>
    <article data-iso="AT" data-name="Austria" data-artist="JJ" data-song="Wasted Love" data-order="12"></article>
  `;
  const rows = extractEurovision(html);
  assertEquals(rows.length, 2);
  assertEquals(rows[0], {
    iso: "SE", name: "Sweden", artist: "KAJ", song: "Bara Bada Bastu", runningOrder: 3,
  });
  assertEquals(rows[1].iso, "AT");
});

Deno.test("extractEurovision tolerates missing data-order", () => {
  const html = `<div data-iso="GR" data-name="Greece" data-artist="X" data-song="Y"></div>`;
  const rows = extractEurovision(html);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].runningOrder, null);
});

Deno.test("extractEurovision returns [] when markup is absent", () => {
  assertEquals(extractEurovision("<html><body>No data</body></html>"), []);
});

Deno.test("extractWikipedia walks wikitable rows", () => {
  const html = `
    <table class="wikitable">
      <tr><th>Country</th><th>Artist</th><th>Song</th></tr>
      <tr><td>Sweden</td><td>KAJ</td><td>"Bara Bada Bastu"</td></tr>
      <tr><td>Austria</td><td>JJ</td><td>Wasted Love</td></tr>
    </table>
  `;
  const rows = extractWikipedia(html);
  assertEquals(rows.length, 2);
  assertEquals(rows[0].iso, "SE");
  assertEquals(rows[0].song, "Bara Bada Bastu"); // strips outer quotes
  assertEquals(rows[1].iso, "AT");
});

Deno.test("extractWikipedia dedupes by ISO across multiple tables", () => {
  const html = `
    <table class="wikitable">
      <tr><td>Sweden</td><td>A</td><td>X</td></tr>
    </table>
    <table class="wikitable">
      <tr><td>Sweden</td><td>B</td><td>Y</td></tr>
    </table>
  `;
  const rows = extractWikipedia(html);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].artist, "A");
});

Deno.test("isoFor maps country names case-insensitively", () => {
  assertEquals(isoFor("Sweden"), "SE");
  assertEquals(isoFor("UNITED KINGDOM"), "GB");
  assertEquals(isoFor("UK"), "GB");
  assertEquals(isoFor("Czech Republic"), "CZ");
  assertEquals(isoFor("Atlantis"), null);
});

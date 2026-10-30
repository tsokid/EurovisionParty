# Data sources

## Eurovision Song Contest history, 1956–2025

**Source:** English Wikipedia, one article per contest:
`https://en.wikipedia.org/wiki/Eurovision_Song_Contest_{year}` (for example
<https://en.wikipedia.org/wiki/Eurovision_Song_Contest_1975>), read as wikitext
through the MediaWiki API
(`https://en.wikipedia.org/w/api.php?action=parse&page=Eurovision_Song_Contest_{year}&prop=wikitext`).

**License:** Wikipedia text is licensed under
[Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).
Attribution: "Eurovision Song Contest {year}", Wikipedia contributors.
The revision history of each article lists its authors.

**Retrieved:** 30 October 2026.

**What we took:** facts only. For each year: host city and country, show
dates, and for every entry the country, artist, song title, semi-final
number, semi-final place and points, qualification, grand-final running
order, place and points, and (2016 onwards) the jury and televote split of
the grand-final points. No article prose was copied; all narrative text on
eurovision.games is our own.

**How:** `scripts/history/import.ts` fetches each article, extracts the
result tables (`scripts/history/parseContest.ts`), and writes
`data/history/{year}.json` and migration `073_history_import.sql`
(contest_entries `source = 'import:wikipedia'`). The extracted data is
verified by `tests/scripts/history/invariants.test.ts`: every year present,
places consistent with points, jury + televote equal to the total, ten
qualifiers per semi-final, every country in our countries table, and the
2010–2025 winners matching our own winners page. Totals were also checked
against each article's separate detailed-voting tables.

**Test fixtures:** `tests/scripts/history/fixtures/{1969,1975,2005,2019,2023}.wikitext`
are verbatim copies of those five articles' wikitext as retrieved above,
committed for the parser tests. They are Wikipedia content under
CC BY-SA 4.0, attributed to the Wikipedia contributors of each
"Eurovision Song Contest {year}" article, and are redistributed under the
same licence.

**Known limits:**

- 1956: only the winner was announced; other places and all points are
  unknown. Each country entered two songs; the winner (Switzerland,
  "Refrain") is stored on its own, other countries' two songs are stored as
  one entry joined with " / ".
- Before 2004 only the grand final is stored; the 1993 pre-qualifier
  (Kvalifikacija za Millstreet) and the 1996 qualifying round are not.
- Jury and televote points are stored from 2016 on; 2009–2015 split
  results were rankings, not additive points.
- 2020 was cancelled: its selected entries are stored without results.
- 2024: the Netherlands qualified from semi-final 2 but was disqualified
  before the final; it is stored as qualified, not as a finalist.
- 2010: the host city is stored as Oslo (the EBU event name); the article's
  infobox names the venue's municipality, Bærum.

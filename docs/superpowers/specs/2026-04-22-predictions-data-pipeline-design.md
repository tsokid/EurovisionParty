# Predictions: Drag-and-Drop Ranking + Live Eurovision Data Pipeline

**Status:** Phase 1 shipped (UI redesign with placeholder data). Phase 2-4 pending.
**Date:** 2026-04-22
**Related commits:** `951b97e` (drag-and-drop ranking)

---

## 1. Context & Goal

The predictions screen lets each player rank countries before the Eurovision Grand Final. Originally it was a tap-to-fill picker (5 Top + 5 Worst slots filled from a 26-country grid). It has been **rewritten as a single drag-and-drop ranked list** of all participating countries — Top 5 = positions 1-5, Worst 5 = last 5 positions. Top 5 / Worst 5 are derived from the user's full ordering, not picked separately.

**Why a redesign:** the dual-list picker forced two mental passes through the same country grid; the unified ranked list is one-pass, more intuitive on mobile, and visually communicates the full pecking order.

**Open product questions** that drove this spec:
1. The participating-country count varies year-to-year (24-30 typical for Grand Final). The current `COUNTRIES_2026` array is hard-coded with 26.
2. Artist names + song titles need to come from a **trusted live source** (the official Eurovision site or its data feed), not hand-curated guesses.
3. During the live show we want **real-time score updates** (running tally as juries / televote results land) feeding the leaderboard and the eventual prediction-scoring pass.

This document captures the current implementation, the gap to "production-real," and the recommended pipeline.

---

## 2. Current Implementation (Phase 1 — shipped)

### Files touched

| File | Purpose |
|---|---|
| `src/lib/types.ts` | `Country` interface gained optional `artist?: string`, `song?: string` |
| `src/lib/countries2026.ts` | 26 hard-coded countries seeded with placeholder artist/song strings |
| `src/components/predictions/PredictionsScreen.tsx` | Replaced tap-to-fill picker with `@dnd-kit` sortable list |
| `src/i18n/locales/{en,el}.json` | Added `predictions.participantsHeader`, `predictions.dragHint` |
| `package.json` | Added `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |

### UI behaviour

- Single sortable list, 26 rows (one per country).
- Each row shows: drag handle (`⋮⋮`), zero-padded position (`01`–`26`), flag emoji, country name, "Artist — *Song*" subline, and a 🏆 / 💩 zone badge.
- **Three visual zones**: positions 1-5 = gold-tinted (Top 5), 6-21 = neutral (middle), 22-26 = red-tinted (Worst 5). Zone changes live as the user drags.
- **Toolbar:** A↓ (sort A-Z), Z↓ (sort Z-A), 🔀 (Fisher–Yates shuffle), ↺ (reset to original order).
- **Sensors:** Pointer (5 px activation), Touch (200 ms long-press to disambiguate from scroll), Keyboard (Tab + arrows, accessible).
- **Submit:** `top5 = order.slice(0, 5)`, `worst5 = order.slice(-5)`, upserted to the existing `predictions` table. **No DB schema change.**
- **Restore:** on revisit, previously-submitted top5 + worst5 are placed back at their respective ends and the un-saved middle 16 fill the centre. Player can tweak and re-submit if predictions are still open.

### What's NOT in scope yet

- Lineup is hard-coded for 2026, with placeholder artist/song strings.
- "Share running order" button from the mockup (wire later when needed).
- Grid view vs list view toggle (mockup has it; YAGNI for now).
- Live scoring during the show.

---

## 3. Data Pipeline — what we need next

### 3.1 Source of truth

**Primary source:** the official Eurovision site (eurovision.tv) and its data endpoints. The participating-country list, artist names, song titles, and final scores are all published there. They're updated as the lineup is announced and as voting unfolds on show night.

**Secondary fallback:** Wikipedia infoboxes for each year's contest are typically up-to-date within hours of the source. Useful as a backup parser if eurovision.tv changes structure.

### 3.2 What we need to ingest, by lifecycle stage

| Stage | Data | When it changes | Refresh cadence |
|---|---|---|---|
| **Lineup announcement** (months before) | Country list + artist + song + national-final flag | Once per country, sometimes revised | Daily |
| **Pre-show** (week of show) | Running order, dress-rehearsal results (jury) | Once or twice | Daily |
| **Show night — semis** | Qualifier list (which countries advance to final) | After each semi | One-shot per semi |
| **Show night — final, voting live** | Live points: jury totals → televote totals → grand total | Per-country reveal during voting (~30 min window) | **30 sec polling** |
| **Final** | Full official ranking | After voting closes | One-shot |

### 3.3 Suggested architecture

```
┌─────────────────────┐     ┌────────────────────┐     ┌──────────────────┐
│ Scheduled scraper   │     │ Supabase tables    │     │ React app        │
│ (cron / edge fn)    │ →→→ │ - eurovision_year  │ →→→ │ - predictions UI │
│ Polls eurovision.tv │     │ - country_entries  │     │ - leaderboard    │
│ + Wikipedia fallback│     │ - live_scores      │     │ - intel reveals  │
└─────────────────────┘     └────────────────────┘     └──────────────────┘
        ↑                            ↑
        │                            │
   Run via:                   Realtime channel
   Supabase Edge Functions    (postgres_changes)
   (Deno, free tier)          fans out to all
   on a schedule              connected players
```

**Why scrape into our DB instead of fetching directly from the client:**

1. **CORS:** eurovision.tv almost certainly doesn't allow cross-origin browser requests.
2. **Rate-limiting:** if every player polled the source independently we'd get throttled. Centralising means one canonical scraper, many clients reading from our DB.
3. **Realtime fan-out:** Supabase Realtime (postgres_changes) already pushes row updates to all subscribed clients ≤200 ms — perfect for live score updates.
4. **Caching / resilience:** if the source goes down briefly we still serve last-known-good data.
5. **Data shape control:** we normalise into our schema once, every consumer benefits.

### 3.4 Proposed schema additions

```sql
-- One row per Eurovision edition. Lets us play 2026 + 2027 + … without forks.
CREATE TABLE eurovision_year (
  year                int PRIMARY KEY,
  host_city           text,
  host_country        text,           -- ISO 3166-1 alpha-2
  final_date          timestamptz,
  status              text NOT NULL CHECK (status IN ('upcoming','live','final')),
  total_participants  int NOT NULL DEFAULT 0,
  last_synced_at      timestamptz
);

-- One row per country competing in a given year's Final.
-- Replaces the hard-coded COUNTRIES_2026 array.
CREATE TABLE country_entries (
  year             int  REFERENCES eurovision_year(year) ON DELETE CASCADE,
  country_code     text NOT NULL,    -- ISO 3166-1 alpha-2 (e.g. 'GR')
  country_name_en  text NOT NULL,
  country_name_el  text,
  flag_emoji       text NOT NULL,
  artist           text,
  song             text,
  running_order    int,              -- nullable until announced
  qualified        bool NOT NULL DEFAULT true,
  PRIMARY KEY (year, country_code)
);

-- Live scoring rows updated by the scraper every ~30s during voting.
-- One row per (year, country) pair; updated in place.
CREATE TABLE live_scores (
  year            int  REFERENCES eurovision_year(year) ON DELETE CASCADE,
  country_code    text NOT NULL,
  jury_points     int  NOT NULL DEFAULT 0,
  televote_points int  NOT NULL DEFAULT 0,
  total_points    int  GENERATED ALWAYS AS (jury_points + televote_points) STORED,
  final_rank      int,                -- nullable until voting closes
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, country_code)
);

-- Realtime: enable replica identity for live_scores so updates propagate
ALTER TABLE live_scores REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE live_scores;
```

**Indexes:**
```sql
CREATE INDEX country_entries_year_idx ON country_entries(year);
CREATE INDEX live_scores_year_idx ON live_scores(year);
```

**RLS:** read-only for `authenticated` (all players see the same data). Writes are RPC-only — the scraper uses a service-role key.

### 3.5 The scraper

**Recommended runtime:** Supabase Edge Functions (Deno).
- Free tier covers ~500K invocations / month — way more than enough.
- Native TypeScript, deploys with one CLI command.
- Built-in service-role auth to write to our tables.
- Schedule via Supabase Cron (built into dashboard, or pg_cron).

**Sketch:**

```ts
// supabase/functions/sync-eurovision/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
// Pick ONE of: cheerio (HTML parsing), node-html-parser, or regex on JSON-LD
// eurovision.tv usually exposes JSON-LD <script> blocks per page.

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const year = 2026;

  // 1. Fetch lineup page
  const html = await fetch(`https://eurovision.tv/event/vienna-2026/grand-final`)
    .then((r) => r.text());

  // 2. Parse country entries (one row per <article> or whatever the markup is)
  const entries = parseEntries(html); // { country_code, artist, song, running_order, qualified }

  // 3. Upsert into country_entries
  await supabase.from('country_entries').upsert(
    entries.map((e) => ({ year, ...e })),
    { onConflict: 'year,country_code' },
  );

  // 4. If status === 'live', fetch the live-scores page and upsert live_scores
  // 5. Update eurovision_year.last_synced_at + total_participants

  return new Response('ok');
});
```

**Schedule (pg_cron):**

```sql
-- Daily during the lead-up
SELECT cron.schedule('sync-eurovision-daily', '0 6 * * *', $$
  SELECT net.http_post('https://<project>.functions.supabase.co/sync-eurovision', ...);
$$);

-- Every 30 sec during voting (toggled on by status='live')
SELECT cron.schedule('sync-eurovision-live', '*/30 * * * * *', $$
  SELECT net.http_post(...) WHERE EXISTS (SELECT 1 FROM eurovision_year WHERE status='live');
$$);
```

### 3.6 Client-side wiring

**Replacing the hard-coded `COUNTRIES_2026`:**

```ts
// src/hooks/useCountries.ts
export function useCountries(year = 2026) {
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    supabase.from('country_entries')
      .select('*')
      .eq('year', year)
      .eq('qualified', true)
      .order('country_name_en')
      .then(({ data }) => setCountries((data ?? []).map(toCountry)));

    // Realtime subscription so a late lineup-revision propagates without refresh
    const ch = supabase.channel(`country_entries:${year}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'country_entries',
        filter: `year=eq.${year}`,
      }, () => refetch())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [year]);

  return countries;
}
```

`PredictionsScreen` and any other consumer of `COUNTRIES_2026` swap to `useCountries()`. The dummy `countries2026.ts` becomes a **dev-mode seed only** (loaded if the DB returns empty), so local development without the scraper running still works.

**Live scores:**

```ts
// src/hooks/useLiveScores.ts — realtime live ranking
export function useLiveScores(year = 2026) {
  const [scores, setScores] = useState<LiveScore[]>([]);
  // Initial fetch + Realtime subscription on live_scores
  // Returns { country_code, jury, televote, total, rank, updated_at }
}
```

The leaderboard and the intel-reveal feature both consume this. When voting closes, this same data feeds the `score_all_predictions` RPC — no manual results entry needed for years where the scraper is healthy (the existing manual entry stays as a fallback).

---

## 4. Migration plan (recommended order)

| Phase | What | Risk | Effort |
|---|---|---|---|
| **1. ✅ Done** | Drag-and-drop UI with placeholder data | low | 1 day |
| **2. Schema** | Apply the 3 new tables + Realtime config | low (additive only) | 30 min |
| **3. Seed** | Backfill `country_entries` from the current `COUNTRIES_2026` array as fallback data | low | 30 min |
| **4. Switch reads** | Add `useCountries()` hook, swap `PredictionsScreen` + leaderboard to use it (dev fallback to seed) | medium — touches every UI consumer of `Country` | 2-3 hours |
| **5. Scraper v1** | Edge function that scrapes lineup (artist + song + flag), upserts into `country_entries`. Run manually first, then schedule daily | medium — depends on parsing complexity | 1 day |
| **6. Live scoring** | Extend scraper to scrape live_scores during the voting window. Add `useLiveScores()` hook. Wire to leaderboard | high — fragile, needs robust error handling and a dry-run mode | 2 days |
| **7. Auto-score predictions** | Trigger `score_all_predictions` RPC when `eurovision_year.status` flips to `'final'` | low (RPC already exists) | 1 hour |

**Stop-the-world checkpoint:** after Phase 4. At that point predictions still work end-to-end with seeded data; the rest is layered on without blocking the game.

---

## 5. Risks & open questions

### Risks

| Risk | Mitigation |
|---|---|
| eurovision.tv changes its HTML structure mid-season | Parse from JSON-LD `<script>` tags first (more stable than markup); Wikipedia fallback if both fail |
| Scraper rate-limits us | One scraper writes to DB; clients only read from DB. Add a 200 ms `User-Agent: EurovisionGames/1.0 (+contact)` and respect `robots.txt` |
| Scraping legal grey area | Only public data, attribution in footer. Switch to an official partner-API feed if/when one exists |
| Live scoring lag during peak voting | 30 sec poll cadence is fine for a 30-minute voting window; add server-side cache layer if multiple years are live simultaneously |
| Country added/removed mid-season | `qualified` flag handles it; Realtime subscription means clients update without refresh |

### Open questions for the user to confirm

1. **Authoritative data source:** eurovision.tv only, or also Wikipedia? (Recommend: tv primary, Wiki fallback.)
2. **Year selection UX:** does the player ever pick a year (multi-year archive), or is the app always pinned to the current year? (Assumed: pinned, no UI surface yet.)
3. **National-final tracking:** do we want pre-Eurovision national selections (Sanremo, Melodifestivalen, etc.) too, or only the Grand Final lineup? (Assumed: Grand Final only for v1.)
4. **Scrape ownership:** is the user comfortable hosting the scraper as a Supabase Edge Function, or do they want it self-hosted (Vercel cron / VPS)? Trade-off is mostly operational — the data path is the same.
5. **Manual override:** the existing `ResultsEntry` UI lets a player enter the official ranking manually. Keep as fallback, or remove once the scraper is reliable? (Recommend: keep, hide behind an "admin" tab.)

---

## 6. Done = ?

Phase 4 done means:
- `country_entries` table seeded with 2026 lineup
- `useCountries()` reads from DB, with seed fallback for offline dev
- `PredictionsScreen` and leaderboard render real data
- Adding/changing a country is a SQL `INSERT`, no code change

Phase 6 done means:
- Live show in progress → `live_scores` updates every 30 s
- Leaderboard re-orders in place via Realtime
- When voting closes, predictions auto-scored

Phase 7 done means:
- The whole flow runs unattended for the next year's contest. We just bump a config value (`year = 2027`) and the scraper handles the rest.

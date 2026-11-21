# Redesign "Stage" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the approved "Stage" redesign (package 1: 15 pages, motion, stage names + secret real names) and extend it to every other public page (package 2) without losing SEO.

**Architecture:** Restyle at the shared-component level (tokens → primitives → layouts → pages) so package-2 pages inherit the design. Routes, H1 meaning, copy, JSON-LD, canonical/hreflang and prerender stay byte-for-byte equivalent in meaning. Game screens keep their hooks/stores; only presentation and the new identity fields change.

**Tech Stack:** React 19, Vite SSR prerender, Tailwind v4 `@theme`, framer-motion, canvas-confetti, Supabase (anon auth + RLS), vitest.

**Spec (approved designs):** redesign canvas https://claude.ai/artifact/NAiUFmVf7oj3vDg3gZp5ve (pages system/public/game/motion); local copies in `scratchpad/shot/canvas/project/*-after-{m,d}.dc.html` and `ds.css`; motion rules in `docs/superpowers/specs/2026-11-21-motion-map.md`.

## Owner decisions (21 Nov 2026, binding)

- Mobile first; desktop uses the width (`.wrap` 1200px, real 2-column layouts).
- Fonts unchanged: Space Grotesk + Bebas Neue. No YouTube embeds. Dark only.
- Never show functionality the app doesn't have. New ideas only where approved: lobby QR code, activity feed from stored point events, personal reel (+ "Ποιος ήταν ποιος;" unmask), TV layout for winners/reel.
- Gender-neutral Greek: never ο/η/τον/την/του/της or pronouns around a player name. Name-as-label ("Πρόκληση από: Μαρία").
- Titles (Πρωταθλητής, Κλέφτης, Μονομάχος, Μάντης, Γκουρού) only at end of game, never on the provisional leaderboard.
- Every trivia/duel answer shows "+N · reason" with micro-motion.
- Duel copy: «Κλέψε ή διπλασίασε τους πόντους που κέρδισες».
- No "Επίσημη κατάταξη τελικού" panel; keep the points breakdown.
- Worst-5 slots are dynamic (depend on finalist count).
- Night PHASE indicator is separate from page navigation.
- Voting screen shows the player's locked picks. Lobby on desktop shows the nav (locked tabs). Game tabs: Προβλέψεις / Κουίζ / Μονομαχίες / Βαθμολογία.
- **Identity:** at join each player gives a **Stage name** (EN "Your stage name", EL «Καλλιτεχνικό όνομα») — shown everywhere — and a **Real name** (EN "Your real name", EL «Πραγματικό όνομα») that stays secret until the game ends, then is revealed in "Ποιος ήταν ποιος;". Avatar chosen from a set.

## Global Constraints

- `/admin` stays hidden (noindex, not in sitemap/menus); admin allowlist unchanged.
- SEO: every prerendered route keeps its path, `<title>`, meta description, H1 meaning, canonical, hreflang, JSON-LD, breadcrumbs, internal links. `npm run build` prerender count must not drop (currently 293).
- Motion: transform/opacity only, `prefers-reduced-motion` fallback, sound opt-in via `audioStore`, Skip on sequences > 3 s. No confetti outside tier 1.
- No new runtime dependencies except a QR encoder if needed (prefer a tiny pure-TS one, < 10 kB).
- Real name must never reach another client before `rooms.phase = 'finished'` — enforced by RLS, not by the UI.
- Tests: `npx vitest run` green; `npx tsc -b` clean; build succeeds.
- Commits on `feat/redesign-stage`. No push to main and no production migration without the owner's go.

## Review Focus

1. A Greek string around a player name that encodes gender (articles, -ος/-η endings, pronouns).
2. Real name leaking via `select *`, realtime payloads, or the leaderboard before phase `finished`.
3. A prerendered page whose H1/title/meta/JSON-LD changed meaning or disappeared after a layout swap.
4. Long stage names / long country names / 26 finalists breaking mobile rows (390px) and the dynamic worst-5.
5. Reduced-motion users getting count-ups, shakes or confetti.

---

### Task 1: Design tokens + primitives
**Files:** `src/index.css` (add Stage tokens to `@theme`: bg #0B0416, surface #170B2B, pink #F0469C, purple #A35BFF, gold #FFC53D, live #2EE6D6 + text tokens from `ds.css`; port `ds.css` component classes as `@layer components`), `src/components/ui/*` (Button primary/secondary/ghost sizes, Card/card-hero/card-link, Chip, Flag, EntryRow, Stat, Avatar), tests for EntryRow/Avatar rendering.
Keep legacy `euro-*` tokens alive until Task 9 removes dead usages.

### Task 2: Site header + footer + public layout
**Files:** `src/components/seo/SiteHeader.tsx`, `SiteFooter.tsx`, `PublicLayout.tsx`, `ContentLayout.tsx`, `PageHero.tsx`, `Section.tsx`, `Breadcrumbs.tsx`, `FaqAccordion.tsx`, `DataTable.tsx`, `RelatedCards.tsx`, `CtaBanner.tsx`.
Footer = 4 columns from the canvas (Σχετικά / Πώς παίζεται / Eurovision / Βοήθεια) with links that exist today, plus the EBU disclaimer. Every link target must be an existing route. These shared components carry package 2.

### Task 3: Public pages, package 1
Home (`HomePage`, `HomeSeoBlock`), hub (`contest/HubPage`, `HubFrame`), predictions (`seo/PredictionsPage`), how-to-play, past contests, archive year, country — per their `*-after-{m,d}` boards. Home join form gets the "Σε κάλεσαν σε δωμάτιο;" label. Hub entries: cards for announced countries + «Δεν έχουν ανακοινωθεί ακόμα…» message.

### Task 4: Identity — stage name, secret real name, avatar
**DB:** migration `082_player_identity.sql`: `players.avatar_id text` (nullable); table `player_secrets(player_id uuid pk references players on delete cascade, real_name varchar(50) not null)`; RLS: insert/update only by the player's own `user_id`; select by own `user_id`, or by any member of the room when `rooms.phase = 'finished'`. Not added to the realtime publication.
**App:** `NameEntry` collects stage name (validated with `nameFilter`, unique per room as today — rejoin keeps using it), real name (required, 1–50 chars, `nameFilter`), avatar picker. i18n keys EN/EL. Hook `useRevealedNames(roomId)` that returns `{}` until phase finished. Avatar set: `src/assets/avatars/` registry with ids; artwork source pending owner (see Open questions) — ship the registry with the current placeholder art so the UI is complete.
Tests: RLS test SQL in `supabase/tests/`, hook test.

### Task 5: Game shell — game bar, phase indicator, tabs, lobby
`AppShell`, `BottomNav` (tabs Προβλέψεις/Κουίζ/Μονομαχίες/Βαθμολογία; desktop side rail), phase chip separate from nav, `LobbyScreen` + `PlayerCard` (avatar + stage name, QR code of the room link, desktop shows locked nav).

### Task 6: Predictions + voting
`PredictionsScreen` (top 5 + dynamic worst 5, mode chosen after the owner's prototype test — default: tap-to-assign, Task ruling if no answer), `VotingLiveScreen` shows locked picks, `PredictionsResultsScreen` points breakdown (no official-ranking panel).

### Task 7: Quiz + duels with points micro-motion
`QuizScreen`, `AnswerButton`, `RoundResults` ("+N · Xs" chips, tally to round total, FLIP mini leaderboard); `DuelsScreen`, `DuelPlayScreen`, `DuelResultCard`, `ChallengeModal` (VS intro, per-answer "+N · 12−s", «Κλέψε ή διπλασίασε τους πόντους που κέρδισες», steal transfer motion). Gender-neutral copy throughout.

### Task 8: Leaderboard, winners, final, reel
`LeaderboardScreen` (FLIP, ↑↓ chips, activity side list from stored point events, no titles), `WinnersScreen` (tier-1 sequence, titles reveal, TV layout), personal reel component (per-player phases, sound cues via `audioStore`, Skip, reduced-motion) ending with "Ποιος ήταν ποιος;" using `useRevealedNames`.

### Task 9: Package 2 pages + cleanup
Apply the Stage templates to FAQ, eurovision-night, rules, scoring, countries index, hub schedule/semifinals/songs, about/privacy/terms/cookies, winners, eurovision-games/party/trivia/duels, dashboard, 404. Canvas boards for these are produced alongside (design review by owner before merge). Remove dead `euro-*` usages. SEO diff check: script that builds before/after and diffs title/meta/h1/canonical/JSON-LD per route — must be empty.

### Task 10: Verification
Gallery (`vite.gallery.config.ts`) screenshots of every screen at 390 and 1440 vs canvas; Lighthouse CWV on home/hub; full test/build; SEO diff = 0.

## Open questions (owner) — do not block
- Avatar artwork route (A illustrator / B AI-generated set — costs generation credits / C layered SVG builder).
- Predictions input mode after the friends test.

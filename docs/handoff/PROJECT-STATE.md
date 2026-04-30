# EurovisionParty — Project Hand-off / Living Memory

> **Purpose.** This document is the single source of truth for project state across sessions and parallel work streams. Any agent or session picking up work should read this first, do their work, and update the relevant section before signing off. Treat it like a CRDT — append-only "last updated" stamps in each section, surgical edits everywhere else.

**Last full review:** 2026-04-30
**Live URL:** https://eurovision.games (and https://www.eurovision.games — 308 → eurovision.games)
**Repo:** https://github.com/tsokid/EurovisionParty
**Default branch:** `main` (Vercel auto-deploys on push to main)

---

## 0. How To Use This Document

1. **Before starting any work**, read sections 1–4 (overview, environments, secrets, current state) and the section for your track.
2. **Before ending a session**, update:
   - The relevant track section (status, what changed, what's next)
   - Section 8 (Outstanding Issues) if you discovered or resolved one
   - Section 9 (Recent Activity Log) — append a dated 2-line entry
3. **Never** delete history from track logs. Strike through with `~~~` if something is wrong, don't erase.
4. **Conflicts:** if two sessions edited the same section, prefer the one with later timestamp; merge facts, prefer the more specific one.

---

## 1. Stack Overview

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 19 + Vite + react-router-dom v7 | SPA. Single bundle today (~1.2MB pre-gzip — flagged for code-split later) |
| Styling | Tailwind v4 (`@theme` tokens) | Brand tokens: `--color-euro-deep`, `--color-euro-pink`, `--color-euro-purple-light`, `--color-euro-gold` |
| State | Zustand + react-i18next (EN/GR) | |
| Hosting | Vercel | Git integration on `main`; SPA rewrite in `vercel.json` |
| Backend | Supabase (managed, project ref `ameneqrrfdhntfzvchnn`, region eu-central-2) | Postgres + RLS + Edge Functions (Deno) + Auth (GoTrue) |
| Email | Supabase magic-link via SMTP | Custom branded HTML template installed via Management API |
| Realtime | Supabase Realtime channels | Used for game state sync |

**TypeScript config (tsconfig.app.json):** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `verbatimModuleSyntax: true`. Type-only imports must use `import type`.

---

## 2. Environments & Endpoints

### Production
| Item | Value |
|---|---|
| Site | https://eurovision.games |
| Supabase URL | https://ameneqrrfdhntfzvchnn.supabase.co |
| Project ref | `ameneqrrfdhntfzvchnn` |
| Edge function base | `https://ameneqrrfdhntfzvchnn.supabase.co/functions/v1/` |
| Anon key | In `.env` (`VITE_SUPABASE_ANON_KEY`); also embedded in frontend bundle. Public by design. |

### Local
- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (must pass before pushing)
- `npm run lint` — eslint
- Node v24.13.0, TS 5.9.3 (verified working)

### Edge Functions Deployed
| Slug | Status | Purpose | Notes |
|---|---|---|---|
| `admin-otp` | v4 ACTIVE | Send 6-digit code to allowlisted admins | **No SDK** — direct REST to PostgREST + GoTrue. Anti-enumeration: returns `{ok:true}` either way after constant-time pad. |
| `eurovision-parse` | ACTIVE | Pull Eurovision 2026 grand-final results | Manual host control + Friday 15 May 03:00 Greece cron fallback (per spec) |
| `send-email` | ACTIVE | Transactional sender via Resend | `EMAIL_FROM` secret set |

---

## 3. Secrets & Tokens

> **Rule:** Never paste secret values into chat. Reference by name only. Rotate per the schedule below.

### Currently set on Supabase (visible names only)

```
SUPABASE_URL                  (auto)
SUPABASE_ANON_KEY             (auto)
SUPABASE_SERVICE_ROLE_KEY     (auto)
SUPABASE_PUBLISHABLE_KEYS     (auto)
SUPABASE_SECRET_KEYS          (auto)
SUPABASE_DB_URL               (auto)
SUPABASE_JWKS                 (auto)
EMAIL_FROM                    (manual — Resend sender)
```

### Management Access Tokens
- **`claude-deploy`** (`sbp_7439…625e`) — Supabase Management API token used by `deploy-*.mjs` scripts during this build. **Action: revoke once admin OTP test passes end-to-end.** Replace with fresh tokens scoped to single deploy events.
- **CLI token** (`cli_DESKTOP-…`) — Supabase CLI on user's machine. Leave alone.

### Rotation Schedule
| Secret | Rotate every | Owner |
|---|---|---|
| Management access tokens | Every deploy session (revoke after) | User |
| `SUPABASE_SERVICE_ROLE_KEY` | If ever pasted/leaked, immediately | User via dashboard |
| `EMAIL_FROM` Resend API key | Per Resend rotation policy | User |
| Anon/publishable keys | Only if compromised (public anyway) | User |

---

## 4. Database — Schema Anchors

**Migrations directory:** `supabase/migrations/`. Numeric prefix = order. Latest applied: `023_admin_rpcs.sql`.

### Critical tables
| Table | Purpose | RLS |
|---|---|---|
| `rooms` | Game rooms | Public read for own; super-admin read all (mig 023) |
| `players` | Players in a room | Same |
| `predictions` | top5/worst5 per player | Per-room, per-player |
| `winners` | 5 categories per room (champion/thief/duelist/oracle/guru). Co-winners via multiple rows. | Super-admin write (mig 023) |
| `sudden_death_rounds` | Tiebreak rounds | Super-admin read |
| `super_admin_emails` | **Allowlist** — email gate for /admin | Super-admin CRUD (mig 023) |
| `super_admins` | Linked auth.users for active admins. Auto-populated by trigger on first sign-in. | Super-admin read |

### Critical RPCs
| Function | Used by |
|---|---|
| `is_super_admin()` | All admin RLS policies |
| `compute_winners(p_room_id)` | Winners admin module |
| `admin_set_winner(p_room_id, p_category, p_player_id, p_metric)` | Winners override |
| `admin_clear_winners(p_room_id)` | Winners clear-all |

### Known gotchas
- **`max_players` default = 20** in migration 001. Frontend copy currently says "2-10 players" in 8 files — needs fix (see §8).
- **DB GUCs** (`ALTER DATABASE postgres SET "app.settings.functions_url"`) are blocked on managed Supabase (permission denied). Don't try to set GUCs from migrations. Pass these as edge-function secrets instead.

### Allowlist (live)
```
elenikp105@gmail.com
tsokid@gmail.com
```

---

## 5. Tracks — Current State

Four parallel work streams. Each can be picked up in a separate session **as long as you respect the file-ownership boundaries** in §7.

---

### Track A — Admin OTP & SuperAdmins

**Goal.** Hidden `/admin` route with email OTP gated to allowlisted addresses. Admins can manage allowlist + run other admin modules.

**Status.** ⏳ End-to-end OTP delivery test pending user confirmation. All code shipped.

**Done:**
- [x] Migration `018_super_admins.sql` — `super_admin_emails` + `super_admins` tables + auth trigger
- [x] Migration `023_admin_rpcs.sql` — RLS + admin RPCs
- [x] Edge function `admin-otp` v4 — DB-backed allowlist, no SDK, direct REST
- [x] Magic-link email template installed via Management API (`PATCH /v1/projects/{ref}/config/auth`)
- [x] `src/admin/AdminLogin.tsx` — brand-aligned, 6-digit OTP boxes, paste handling, gradient hero
- [x] `src/admin/AdminShell.tsx` + `AdminSidebar.tsx` — module switcher
- [x] `src/admin/useAdminAuth.ts` — session + refresh + auto-logout if not in `super_admins`
- [x] `src/admin/modules/SuperAdmins.tsx` — CRUD on `super_admin_emails` with linked-status badge

**Pending:**
- [ ] User confirms OTP email arrives in inbox at `tsokid@gmail.com`
- [ ] User completes verify-and-sign-in flow on prod
- [ ] (Optional) AdminLogin: add specific copy when `denied` differs from `error`

**Known issues / gotchas:**
- Earlier `admin-otp` v3 used `esm.sh` import → BOOT_ERROR → browser saw "CORS error" (Cloudflare's 503 fallback strips function CORS). v4 is SDK-free. Don't reintroduce esm.sh imports.
- The `deploy-admin-otp.mjs` script reads `supabase/functions/admin-otp/index.bundled.ts` — keep that file in sync with `index.ts` (currently identical).

**Files:**
- `src/admin/**`
- `supabase/functions/admin-otp/index.ts`
- `supabase/functions/admin-otp/index.bundled.ts`
- `supabase/migrations/018_super_admins.sql`
- `supabase/migrations/023_admin_rpcs.sql`
- `supabase/templates/magic-link.html`
- `deploy-admin-otp.mjs`

**Next session can pick up:**
- Once user confirms OTP works: move to Winners module live test
- If OTP doesn't arrive: check Resend dashboard, GoTrue logs, spam folder

---

### Track B — Winners (Phase 2: co-winners + sudden-death tiebreak)

**Goal.** 5 category winners per room (champion / thief / duelist / oracle / guru), co-winner support, deterministic compute + manual override.

**Status.** ✅ UI shipped. Live test pending (depends on Track A).

**Done:**
- [x] Migration `019_winners.sql` — `winners` + `sudden_death_rounds` tables, `compute_winners` RPC
- [x] Migration `023_admin_rpcs.sql` — `admin_set_winner`, `admin_clear_winners` RPCs
- [x] `src/admin/modules/Winners.tsx` — room selector (50 most recent), 5 category cards, compute / clear / per-category override with disclosure pattern, SD badge
- [x] Registered in `src/admin/modules/index.ts`

**Pending:**
- [ ] Live test on a real room: compute → verify all 5 categories populated
- [ ] Tiebreak path: simulate equal `total_points` → verify SD round triggers
- [ ] Override path: pick a player → verify deletes existing + inserts override

**Known issues / gotchas:**
- `compute_winners` returns count of rows inserted. Co-winners produce multiple rows per category — UI displays them as chips.
- Override **wipes the category** then inserts (not insert-or-update) — this is by design so admin can replace co-winner sets cleanly.

**Files:**
- `src/admin/modules/Winners.tsx`
- `supabase/migrations/019_winners.sql`
- `supabase/migrations/023_admin_rpcs.sql` (RPCs)

**Next session can pick up:**
- After Track A unblocks: walk through compute on a test room
- Future: sudden-death UI module to inspect/replay SD rounds

---

### Track C — Eurovision 2026 Grand-Final Parser

**Goal.** Pull official jury + televote data from Eurovision 2026 grand final, populate scores, with manual host trigger and a fallback cron at Friday 15 May 2026 03:00 Greece time.

**Status.** ✅ Edge function deployed. Manual trigger UI in admin shell. Cron not yet wired (see §8).

**Done:**
- [x] Edge function `eurovision-parse` deployed
- [x] `src/admin/modules/EurovisionParser.tsx` — manual trigger UI

**Pending:**
- [ ] Cron fallback: schedule via Supabase scheduled functions or external cron → invoke `eurovision-parse` at `2026-05-15 03:00 Europe/Athens`
- [ ] Idempotency: confirm running parser twice on same data is a no-op
- [ ] Live test on actual 2026 data when it arrives (not until 16 May 2026)

**Known issues:**
- Parser depends on the public results page being up. If source HTML structure changes, parser breaks silently. **Add monitoring** before 15 May 2026.

**Files:**
- `supabase/functions/eurovision-parse/index.ts`
- `supabase/functions/eurovision-parse/parse.ts`
- `src/admin/modules/EurovisionParser.tsx`

**Next session can pick up independently** — does not depend on Track A/B.

---

### Track D — SEO / GEO (eurovision.games)

**Goal.** Rank #2 within 1 week for: "eurovision night", "eurovision games", "eurovision 2026 predictions", "eurovision party", "eurovision trivia". Both technical SEO and GEO/AEO (AI search citability).

**Status.** 🟡 Design primitives built but **not yet wired into pages**. Paused at user's direction to prioritize admin/OTP. Resume after Track A confirms working.

**Done:**
- [x] Inspiration screens reviewed (PageHero with breadcrumb chip, RelatedCards grid, FAQ accordion, sticky CTA banner, Timeline, ChecklistCard, TriviaSampleCard, DataTable, SiteHeader with menu drawer, generous desktop width)
- [x] 13 design primitives built under `src/components/seo/`:
  - `Breadcrumbs.tsx` (with `breadcrumbJsonLd(items)` helper)
  - `Chip.tsx` (pink / purple / gold variants)
  - `PageHero.tsx`, `ContentLayout.tsx`, `Section.tsx`
  - `RelatedCards.tsx`, `CtaBanner.tsx`, `FaqAccordion.tsx`
  - `ChecklistCard.tsx`, `Timeline.tsx`, `DataTable.tsx`
  - `TriviaSampleCard.tsx`, `SiteHeader.tsx`
- [x] Type-only imports fixed (`verbatimModuleSyntax`)
- [x] Existing JSON-LD: Organization + WebApplication on `index.html`
- [x] `public/llms.txt`, `public/robots.txt`, `public/sitemap.xml` exist (sitemap needs `lastmod`)
- [x] AI bot allowlist: GPTBot, PerplexityBot, ClaudeBot, Google-Extended, Applebot-Extended (verify in `robots.txt`)

**Pending — page refactor (14 SEO routes):**
- [ ] Refactor each SEO page onto new primitives (currently use ad-hoc layouts)
- [ ] Add per-page `<title>` + `<meta description>` via React 19 metadata or react-helmet
- [ ] Add per-page JSON-LD: BreadcrumbList, Article (or HowTo / FAQPage where appropriate), Speakable
- [ ] Add `dateModified` to each page
- [ ] Update `sitemap.xml` with `lastmod` per URL
- [ ] Wire `SiteHeader` mobile drawer site-wide
- [ ] Internal linking: hub-and-spoke pattern between SEO pages

**Pending — content accuracy (must fix before SEO launch):**
- [ ] **"2-10 players" → "2-20 players"** across 8 files (DB schema is `max_players DEFAULT 20`):
  - `index.html`
  - `public/llms.txt`
  - `src/components/HomeSeoBlock.tsx`
  - `src/pages/EurovisionGamesPage.tsx`
  - `src/pages/HowToPlayPage.tsx`
  - `src/pages/FAQPage.tsx`
  - `src/pages/OnlineGamesPage.tsx`
  - `src/pages/EurovisionNightPage.tsx`

**Files:**
- `src/components/seo/**` (primitives, ready)
- `src/pages/*Page.tsx` (14 pages, need refactor)
- `index.html`, `public/llms.txt`, `public/robots.txt`, `public/sitemap.xml`

**Next session can pick up independently** — Track D only touches `src/pages/*` and `src/components/seo/*`. Won't conflict with Tracks A/B/C.

---

## 6. Recent Production Deploys

| Date | Commit | What |
|---|---|---|
| 2026-04-30 | `82378f0` | chore: trigger Vercel rebuild |
| 2026-04-30 | `42b98d1` | fix(admin-otp): drop SDK dependency to eliminate BOOT_ERROR |
| 2026-04-30 | `3ab1ae4` | feat(admin): brand-aligned OTP login + Winners/SuperAdmins modules + admin RPCs |
| (earlier)  | `dc316bc` | fix(admin): unbreak /admin route hanging on Supabase auth lock |
| (earlier)  | `a352ccd` | Merge feat/email-stack: branded OTP + mailto contacts + Resend transactional sender |

---

## 7. Parallelism Rules — Who Owns What

To enable parallel sessions safely. **A session must not edit files outside its claimed lanes** without flagging here first.

| Track | Owns (write access) | Reads only |
|---|---|---|
| A — Admin OTP | `src/admin/**`, `supabase/functions/admin-otp/**`, `supabase/templates/magic-link.html`, migrations `018_*`, `023_*` | DB schema, env config |
| B — Winners | `src/admin/modules/Winners.tsx`, migrations `019_*`, RPC code in `023_*` | Track A admin shell |
| C — Parser | `supabase/functions/eurovision-parse/**`, `src/admin/modules/EurovisionParser.tsx` | Nothing else |
| D — SEO/GEO | `src/components/seo/**`, `src/pages/*Page.tsx`, `index.html`, `public/llms.txt`, `public/robots.txt`, `public/sitemap.xml` | Brand tokens in `src/index.css` |
| Shared (locked) | `src/index.css`, `src/main.tsx`, `src/routes.tsx`, `package.json`, `vercel.json`, `tsconfig*.json` | — |

**Edits to shared files require a note in §9 explaining why and what changed.**

---

## 8. Outstanding Issues

### 🔴 Blocker
- **B-001:** OTP delivery to `tsokid@gmail.com` not yet confirmed by user. All upstream fixes shipped (admin-otp v4, magic-link template). Awaiting human verification.

### 🟠 Important
- **I-001:** Vercel build was failing on stale TS errors that don't exist in current `main`. Empty commit `82378f0` pushed to force rebuild. **Verify next deploy is green** (commit hash on Vercel must be ≥ `42b98d1`).
- ~~**I-002:** "2-10 players" copy across 8 files contradicts DB default of 20.~~ → resolved 2026-04-30 in commit `5879146`. Full content audit also fixed scoring formulas (quiz tiers 12/8/4 not 100+bonus; predictions 50/20 not 50/30/20/15/10; duel 12-pt-by-second not 100), wrong country list in Predictions2026Page (was 36 with 5 boycotting; now 35 from canonical `src/lib/countries2026.ts`), 70 finals → 69, 26 entries → 25, duel limit 2 → 3 host-configurable, quiz round size 5 → 10.
- **I-003:** Cron for `eurovision-parse` not scheduled. Must be set up before 15 May 2026 03:00 Greece.
- **I-004:** Bundle size warning at build (`1.21 MB`). Code-split when convenient — not urgent.

### 🟡 Nice to have
- **N-001:** AdminLogin "denied" state could be more specific (currently shows `not_allowed` toast — minor copy polish).
- **N-002:** Sitemap missing `lastmod` per URL.
- **N-003:** No image asset audit done (alt text, dimensions, AVIF/WebP) — Track D scope.
- **N-004:** No monitoring on Eurovision results source HTML; if source format changes silently, parser fails silently.

### ✅ Resolved (keep for memory)
- ~~`admin-otp` BOOT_ERROR (esm.sh import failure)~~ → fixed in v4 by removing SDK dependency
- ~~Hardcoded allowlist in `admin-otp`~~ → DB-backed allowlist
- ~~Magic-link email template not installed~~ → installed via Management API
- ~~CORS preflight returning 503~~ → was symptom of BOOT_ERROR, resolved
- ~~DB GUCs permission denied~~ → working around via edge-function secrets
- ~~Stale public-content (player counts, scoring, country list, duel limit)~~ → full audit 2026-04-30, all SEO pages now match `src/lib/constants.ts` + `src/lib/countries2026.ts` (commit `5879146`).

---

## 9. Recent Activity Log (append-only)

> Format: `YYYY-MM-DD HH:MM TZ — actor — track — what`

```
2026-04-30 ~05:00 UTC — Claude — A — Wrote brand-aligned AdminLogin (6-digit OTP boxes, gradient hero, paste handler).
2026-04-30 ~05:10 UTC — Claude — A — Committed + pushed (3ab1ae4). User reported "no email received" + CORS error screenshot.
2026-04-30 ~05:15 UTC — Claude — A — Diagnosed admin-otp BOOT_ERROR via direct curl. Rewrote SDK-free, redeployed v4. Verified preflight 200 + POST {ok:true} for both unallowed and allowlisted emails.
2026-04-30 ~05:20 UTC — Claude — A — Committed (42b98d1) + pushed.
2026-04-30 ~05:30 UTC — Claude — meta — User saw Vercel build failures referencing variables that don't exist in current main (dndId, setActiveId, setMobileZone, usedSet, shuffledCorrectIndex). Local tsc passes clean. Pushed empty commit (82378f0) to force fresh Vercel build.
2026-04-30 ~05:40 UTC — Claude — handoff — Created this document.
2026-04-30 ~07:30 UTC — Claude — D — Visual polish (radial-glow gradient, room tile cards, SVG sparkles, header-aware layout) + magic-link email template installed via Management API.
2026-04-30 ~08:00 UTC — Claude — D — Full content audit: fixed player counts (2-10→2-20), scoring formulas (now match constants.ts), country list (canonical source), duel limit (3 host-configurable), quiz round size, grand final count, 2026 entry count. Commit `5879146` shipped. I-002 resolved.
```

---

## 10. Quick Commands

```bash
# Local dev
npm run dev

# Type-check + build (must pass before push)
npm run build

# Deploy admin-otp (requires SUPABASE_ACCESS_TOKEN env)
cp supabase/functions/admin-otp/index.ts supabase/functions/admin-otp/index.bundled.ts
SUPABASE_ACCESS_TOKEN=<token> node deploy-admin-otp.mjs

# Live OTP smoke test
ANON=<from .env>
curl -i -X POST https://ameneqrrfdhntfzvchnn.supabase.co/functions/v1/admin-otp \
  -H "Origin: https://eurovision.games" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"email":"tsokid@gmail.com"}'
# Expect: 200 {"ok":true}

# Apply a migration via Management API
curl -X POST "https://api.supabase.com/v1/projects/ameneqrrfdhntfzvchnn/database/query" \
  -H "Authorization: Bearer $SBP" -H "Content-Type: application/json" \
  -d "{\"query\": \"$(cat supabase/migrations/NNN_*.sql | sed 's/"/\\"/g')\"}"

# Force Vercel rebuild without code change
git commit --allow-empty -m "chore: trigger rebuild" && git push origin main
```

---

## 11. Open Questions (for human)

> Unresolved decisions that block work. Update with answers as they come.

- **Q-A1:** Once OTP arrives, do you want a "remember this device" option (longer JWT) or always 1-hour expiry?
- **Q-D1:** SEO refactor — do all 14 pages get the new primitives in one big PR, or roll out top 5 first (homepage, eurovision-night, eurovision-games, eurovision-2026-predictions, eurovision-trivia) and iterate?
- **Q-C1:** Cron platform: Supabase scheduled functions, GitHub Actions, or external (e.g. cron-job.org)?
- **Q-meta:** Acceptable to consolidate `index.bundled.ts` and `index.ts` (currently duplicates) into a single source via build script?

---

*End of document. Update §9 every session.*

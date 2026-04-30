# Eurovision Games — SEO + GEO Research (2026)

**Domain:** `eurovision.games`
**Audience:** Eurovision watch-party hosts and attendees (EN + EL parity)
**Optimization targets (equal weight):** Google (blue links + AI Overviews), Perplexity, ChatGPT, Claude, Apple Intelligence
**Window:** Eurovision 2026 grand final = Saturday 16 May 2026, Vienna 🇦🇹
**Decision:** `/en/...` and `/el/...` URL routing approved — full hreflang implementation

---

## 1. Strategic context

Eurovision Games sits in a **niche-but-spiky** market. Search demand is highly seasonal — peaks in March (semi-final draws), April (national finals), May (event week), with a one-day spike on the grand final itself. Greek audiences are disproportionately engaged: Greece + Cyprus are top-quartile Eurovision viewers per capita, and Greek users mix Greek, Greeklish, and English in queries.

Three SEO realities shape the strategy:

1. **The domain `eurovision.games` is a keyword-rich exact match for the head term "eurovision games".** This is a moat. We should aggressively target every variant.
2. **GEO is the higher-leverage play here, not blue links.** Eurovision queries are heavily question-based ("how does eurovision voting work", "when is eurovision 2026"). AI engines are already eating these queries. If we structure content for extraction, we get cited even when we don't rank #1.
3. **The existing 15 pages are 60% of the way there.** They have the right URL slugs but thin content, weak schema, and no hreflang. Most work is enrichment + bilingual rebuild, not net-new pages.

---

## 2. Keyword research — English

### 2.1 Head terms (high volume / high competition)

| Keyword | Intent | Difficulty | Notes |
|---|---|---|---|
| eurovision | Nav | Very high | Brand-owned (eurovision.tv) — don't target head |
| eurovision 2026 | Info/Trans | High | Event hub opportunity |
| eurovision party | Info/Comm | Medium | **Strong target** — our core |
| eurovision games | Info/Comm | Low–Medium | **Exact-match domain advantage** |
| eurovision night | Info | Low–Medium | Owned by us already |

### 2.2 Long-tail informational (high opportunity)

| Cluster | Keywords | Search intent | Page mapping |
|---|---|---|---|
| **Hosting** | how to host a eurovision party · eurovision party ideas · eurovision watch party · eurovision party theme · eurovision party decorations · eurovision party invitations | Informational | `/eurovision-party` (hub) + `/host-eurovision-party` |
| **Food & drink** | eurovision party food · eurovision party menu · eurovision drinking game · eurovision cocktail · eurovision themed food | Informational/Commercial | `/eurovision-drinking-game` (NEW — high volume) + section in `/eurovision-party` |
| **Games & activities** | eurovision party games · eurovision drinking game rules · eurovision bingo · eurovision bingo printable · eurovision scorecard · eurovision quiz · eurovision trivia questions · eurovision sweepstake | Informational | `/eurovision-games` (hub) + `/eurovision-bingo` + `/eurovision-sweepstake` + `/eurovision-quiz` |
| **Predictions** | who will win eurovision 2026 · eurovision 2026 predictions · eurovision 2026 odds · eurovision 2026 favourites · eurovision 2026 winner | Informational/Commercial | `/eurovision-2026-predictions` (refresh weekly) |
| **Schedule & logistics** | when is eurovision 2026 · where is eurovision 2026 · eurovision 2026 date · eurovision 2026 host city · eurovision 2026 venue · eurovision 2026 schedule · eurovision 2026 semifinals · eurovision 2026 running order · what time is eurovision 2026 | Informational | `/eurovision-2026` (NEW hub) + `/eurovision-2026-schedule` + `/eurovision-2026-semifinals` |
| **Songs & countries** | eurovision 2026 songs · eurovision 2026 entries · eurovision 2026 countries · eurovision 2026 [country] | Informational | `/eurovision-2026-songs` + programmatic `/countries/[country]/2026` |
| **Voting & rules** | how does eurovision voting work · eurovision scoring system · eurovision jury vote · eurovision televote · douze points meaning · eurovision points system · eurovision rules | Informational | `/scoring` + `/glossary` + `/how-eurovision-voting-works` (NEW) |
| **History & lore** | eurovision winners list · eurovision past winners · who has won eurovision the most · eurovision best songs · eurovision worst songs · eurovision history · eurovision 1956 · eurovision over the years | Informational | `/eurovision-history` + `/winners` + programmatic `/winners/[year]` |
| **Comparisons** | eurovision games vs bingo · best eurovision party game · free eurovision game · eurovision app · eurovision predictions app | Commercial | `/compare/eurovision-games-vs-bingo` + `/compare/eurovision-games-vs-quiz-pack` + `/best-eurovision-app` |
| **Niche audiences** | eurovision party for kids · eurovision party adults · eurovision drinking game safe · sober eurovision party | Informational | Sections within hub pages |

### 2.3 Question-based (GEO gold — answer extraction)

These are direct-answer queries. Each gets a **definition block** in the first 300 words of the relevant page:

- What is Eurovision?
- When is Eurovision 2026?
- Where is Eurovision 2026 being held?
- How does Eurovision voting work?
- How many countries are in Eurovision 2026?
- What are douze points?
- How long does Eurovision last?
- Who hosts Eurovision 2026?
- How do you watch Eurovision in [country]?
- What is the Big Five in Eurovision?
- Why does Australia compete in Eurovision?
- Has the UK ever won Eurovision?
- Who won Eurovision 2025?
- What was Greece's best Eurovision result?
- How is Eurovision scored?
- What is the Eurovision Song Contest?
- How do I host a Eurovision party?
- What games can I play during Eurovision?
- Is Eurovision Games free?
- How many people can play Eurovision Games?

### 2.4 Seasonal demand curve

| Window | Queries spike | Content readiness deadline |
|---|---|---|
| Jan–Feb | "eurovision 2026 dates", national selection news | Done |
| Mar | Semi-final draw, "eurovision 2026 running order" | 1 Mar 2026 |
| Apr | "eurovision 2026 odds", "eurovision 2026 favourites" | 1 Apr 2026 |
| **Week of 11–17 May** | Massive spike across all queries (10–50× baseline) | **9 May 2026** |
| 17 May onwards | "who won eurovision 2026" — capture post-event traffic | Auto-update infrastructure ready by 9 May |

---

## 3. Keyword research — Greek (ελληνικά)

Greek search behaviour for Eurovision is unique:
- **High mix of Greek, English, and Greeklish.** Users search "eurovision 2026" in Latin chars more than they search "γιουροβίζιον".
- **Cyprus is part of the audience.** Greek-language pages should include Cypriot context where natural (Cyprus's entries, Cypriot watch parties).
- **Volume is ~5–10× lower than EN globally**, but the Greek-speaking pool (~13M speakers) is one of Eurovision's most engaged per capita. Less competition means easier wins.

### 3.1 Head + long-tail clusters

| Cluster | Keywords (mixed Greek/Greeklish/EN) | Page mapping |
|---|---|---|
| **Brand / event** | eurovision · eurovision 2026 · γιουροβίζιον · γιουροβίζιον 2026 · γιουροβίσιον | `/el/` + `/el/eurovision-2026` |
| **Greece & Cyprus** | Ελλάδα eurovision 2026 · ελληνικό τραγούδι eurovision 2026 · Κύπρος eurovision 2026 · κυπριακή συμμετοχή eurovision · ελληνες νικητες eurovision · eurovision Ελλάδα ιστορία · Ελένη Φουρέιρα · Helena Paparizou | `/el/eurovision-ellada` (NEW) + `/el/eurovision-kypros` (NEW) |
| **Hosting** | πάρτι eurovision · ιδέες πάρτι eurovision · πώς να κάνω πάρτι eurovision · διοργάνωση eurovision · θεματικό πάρτι eurovision · eurovision parti spiti | `/el/eurovision-party` |
| **Games / activities** | παιχνίδια eurovision · eurovision παιχνίδι · κουίζ eurovision · trivia eurovision · προβλέψεις eurovision · στοιχήματα eurovision (informational only — we don't gamble) · eurovision bingo ελληνικά | `/el/eurovision-games` + `/el/eurovision-trivia` + `/el/eurovision-bingo` |
| **Voting / rules** | πώς ψηφίζουμε στη eurovision · βαθμολογία eurovision · douze points τι σημαίνει · κριτική επιτροπή eurovision · τηλεψηφοφορία eurovision | `/el/scoring` + `/el/glossary` |
| **Schedule** | πότε είναι το eurovision 2026 · ποια μέρα είναι το eurovision 2026 · τι ώρα ξεκινάει η eurovision · πού γίνεται το eurovision 2026 · ποιος μεταδίδει την eurovision (ΕΡΤ) | `/el/eurovision-2026` + `/el/eurovision-2026-programma` |
| **History** | νικητές eurovision · ελληνικές συμμετοχές · καλύτερα τραγούδια eurovision · χειρότερα τραγούδια eurovision · ιστορία eurovision | `/el/eurovision-history` + `/el/eurovision-ellada` |

### 3.2 Greek question-based (GEO)

- Πότε είναι το eurovision 2026;
- Πού γίνεται το eurovision 2026;
- Τι ώρα ξεκινάει η eurovision;
- Ποιος μεταδίδει την eurovision στην Ελλάδα; (Answer: ΕΡΤ)
- Ποιο είναι το ελληνικό τραγούδι του eurovision 2026;
- Ποιες χώρες έχουν κερδίσει την eurovision περισσότερες φορές;
- Πώς λειτουργεί η ψηφοφορία στη eurovision;
- Τι σημαίνει "douze points";
- Πόσες χώρες συμμετέχουν στη eurovision 2026;
- Έχει κερδίσει η Ελλάδα την eurovision;
- Πώς να κάνω πάρτι για τη eurovision;
- Ποια παιχνίδια μπορώ να παίξω στη eurovision;
- Είναι δωρεάν το Eurovision Games;

### 3.3 Greek-specific content angles (no EN equivalent)

These pages have no EN counterpart — they're Greek-market exclusives:

1. **`/el/eurovision-ellada`** — Greece in Eurovision: complete history, 2005 win (Helena Paparizou), every entry, peak years, controversies.
2. **`/el/eurovision-kypros`** — Cyprus in Eurovision: history, Eleni Foureira's "Fuego" 2018, Cypriot 2026 entry.
3. **`/el/eurovision-2026-elliniko-tragoudi`** — The Greek 2026 entry: artist, song, lyrics, performance details, betting odds. (Updated weekly Mar–May.)
4. **`/el/eurovision-2026-programma`** — When/how to watch from Greece + Cyprus: ΕΡΤ schedule, RIK schedule, time zone notes.

---

## 4. Search intent map

| Page (final) | Primary intent | Secondary intent | User question being answered |
|---|---|---|---|
| `/` | Transactional | Informational | "I want to play a Eurovision game right now" |
| `/eurovision-2026` (NEW hub) | Informational | Navigational | "What's happening at Eurovision 2026?" |
| `/eurovision-2026-predictions` | Informational | Commercial | "Who will win Eurovision 2026?" |
| `/eurovision-2026-schedule` (NEW) | Informational | — | "When and where is Eurovision 2026?" |
| `/eurovision-2026-semifinals` (NEW) | Informational | — | "Who's in the semifinals and when?" |
| `/eurovision-2026-songs` (NEW) | Informational | — | "What are the 2026 entries?" |
| `/eurovision-party` | Informational | Commercial | "How do I host a Eurovision party?" |
| `/eurovision-night` | Informational | Commercial | "What do I do during the show?" |
| `/eurovision-games` | Commercial | Transactional | "What games can I play during Eurovision?" |
| `/how-to-play` | Informational | Transactional | "How does this app work?" |
| `/eurovision-trivia` | Informational | Transactional | "What Eurovision trivia questions can I ask?" |
| `/eurovision-quiz` (NEW) | Informational | Transactional | "Where can I take a Eurovision quiz?" |
| `/eurovision-bingo` (NEW) | Informational | — | "How do I play Eurovision bingo?" |
| `/eurovision-drinking-game` (NEW) | Informational | — | "What are good Eurovision drinking game rules?" |
| `/eurovision-sweepstake` (NEW) | Informational | — | "How does a Eurovision sweepstake work?" |
| `/eurovision-history` (NEW) | Informational | — | "What's the history of Eurovision?" |
| `/winners` (NEW hub) | Informational | — | "Who has won Eurovision?" |
| `/winners/[year]` (NEW programmatic) | Informational | — | "Who won Eurovision in [year]?" |
| `/countries` (NEW hub) | Informational | — | "How has each country done at Eurovision?" |
| `/countries/[country]` (NEW programmatic) | Informational | — | "What's [country]'s Eurovision history?" |
| `/glossary` (NEW) | Informational | — | "What does [term] mean?" (douze points, jury, etc.) |
| `/scoring` | Informational | — | "How is Eurovision scored?" |
| `/rules` | Informational | — | "What are the rules?" |
| `/compare/eurovision-games-vs-bingo` (NEW) | Commercial | — | "Should I use this or just play bingo?" |
| `/compare/eurovision-games-vs-quiz-pack` (NEW) | Commercial | — | "Should I buy a quiz pack instead?" |
| `/best-eurovision-app` (NEW) | Commercial | — | "What's the best app for Eurovision?" |
| `/printables` (NEW) | Informational | Transactional | "Where can I get a Eurovision scorecard?" |
| `/faq` | Informational | — | Various |
| `/about` | Navigational | — | "Who made this?" |

---

## 5. Page list — keep / adjust / create / delete

### KEEP & POLISH (light refresh)
| Page | Action |
|---|---|
| `/` | Keep architecture, add Greek market signal, refresh meta + schema (VideoGame + WebApplication + Organization + WebSite SearchAction) |
| `/about` | Add author/E-E-A-T signals (creator bio, credentials), updated date |
| `/privacy`, `/terms` | Polish only, ensure both EN and EL present |

### ADJUST / ENHANCE (significant content rewrite + bilingual)
| Page | Action |
|---|---|
| `/eurovision-night` | Already strong design. Enrich with: 5-min explainer block at top ("What is Eurovision?"), embed FAQ section, add country-by-country food sidebar, expand run-of-show with TV broadcast notes |
| `/eurovision-games` | Expand comparison table to 8 rows (vs printable bingo, commercial quiz, custom spreadsheet, paid app, etc.). Add sub-section per game mode. |
| `/eurovision-party` | Already strong. Add "themes" section (decade themes, country themes, costume themes), drinking game cross-link, sweepstake cross-link |
| `/eurovision-trivia` | Expand from 10 sample Qs to 50+ with category tabs (history / songs / countries / wins / fun facts). Add "Take the quiz" CTA → `/eurovision-quiz` |
| `/eurovision-2026-predictions` | Convert to **dynamic page**: weekly-refreshed odds table, country-by-country breakdown, semi-final predictions. Add "How predictions are scored in our game" |
| `/how-to-play` | Already strong. Add 30-sec video explainer slot, FAQ, "Got 60 seconds?" quick-start variant |
| `/scoring` | Merge with `/rules` content + glossary cross-links. Lead with definition block. |
| `/rules` | Consider merging into `/scoring` or refactor to be game rules (vs Eurovision rules) |
| `/faq` | Triple in size. Cluster by category (Setup, Gameplay, Scoring, Hosting, Tech). Each Q in FAQPage schema. |

### DELETE / REDIRECT
| Page | Reason | Action |
|---|---|---|
| `/online-games` | Generic, low-relevance to Eurovision audience, likely thin | 301 → `/eurovision-games` |
| `/mobile-games` | Same | 301 → `/eurovision-games` |

### CREATE NEW — Tier 1 (highest priority, evergreen)
| Page | Primary KW | Why |
|---|---|---|
| `/eurovision-2026` | "eurovision 2026" | Event hub, captures all 2026 traffic |
| `/eurovision-2026-schedule` | "eurovision 2026 schedule" / "when is eurovision 2026" | High-volume factual query — perfect GEO target |
| `/eurovision-2026-semifinals` | "eurovision semifinals 2026" | Semi-final week traffic spike |
| `/eurovision-2026-songs` | "eurovision 2026 songs" / "eurovision 2026 entries" | High-engagement listicle |
| `/eurovision-drinking-game` | "eurovision drinking game" | Massive seasonal volume, low competition for free version |
| `/eurovision-bingo` | "eurovision bingo" | High volume, we offer better than bingo — convert |
| `/eurovision-sweepstake` | "eurovision sweepstake" | UK/IE high volume — convert sweepstake searchers |
| `/eurovision-quiz` | "eurovision quiz" | Different intent than trivia (broader, takes-a-quiz vs reads-questions) |
| `/eurovision-history` | "eurovision history" | Pillar page, internal linking magnet |
| `/glossary` | "douze points meaning" + many | DefinedTermSet schema = AI citation engine |
| `/host-eurovision-party` | "how to host eurovision party" | Step-by-step HowTo, distinct intent from `/eurovision-party` overview |

### CREATE NEW — Tier 2 (programmatic, scales)
| Page pattern | Volume per page | Total pages | Schema |
|---|---|---|---|
| `/winners/[year]` | 1956–2025 (70 pages) | 70 | Article + Person + MusicRecording + Country |
| `/countries/[country]` | ~52 (active + historical) | 52 | Article + Country + ItemList |
| `/eurovision-[year]-recap` | Recent + popular years (10) | 10 | Article + Event |

**Programmatic quality gate:** Each page must have ≥300 unique words, original commentary (not just data scrape), at least 1 original insight/stat, 3+ internal links, image. Fail any → don't publish.

### CREATE NEW — Tier 3 (commercial / comparison)
| Page | Why |
|---|---|
| `/compare/eurovision-games-vs-bingo` | Captures "vs" intent, conversion |
| `/compare/eurovision-games-vs-quiz-pack` | Same |
| `/best-eurovision-app` | Self-listicle (we list ourselves #1 with honest comparison) |
| `/printables` | Free printable scorecards/bingo (also a lead magnet) |

### Greek-exclusive pages (no EN counterpart)
| Page | KW |
|---|---|
| `/el/eurovision-ellada` | Ελλάδα eurovision · ελληνικές συμμετοχές eurovision |
| `/el/eurovision-kypros` | Κύπρος eurovision |
| `/el/eurovision-2026-elliniko-tragoudi` | Ελληνικό τραγούδι eurovision 2026 |
| `/el/eurovision-2026-programma` | Eurovision 2026 πρόγραμμα ΕΡΤ |

### Final page count
- **EN:** ~25 evergreen + 132 programmatic = **157 pages**
- **EL:** ~25 evergreen + 4 Greek-exclusive + (subset of programmatic, e.g. countries page only) = **~50 pages**
- **Total:** ~207 indexable pages (vs current 15)

---

## 6. GEO — winning AI answer extraction

### 6.1 Why this matters disproportionately for Eurovision queries

AI engines are **already** the default for question-based Eurovision queries. Try: *"who is hosting eurovision 2026"* — Perplexity returns a sourced answer, ChatGPT returns a paragraph citing 2-3 sources, Google AI Overview shows up at the top. If we're not in those answers, blue-link rankings are irrelevant.

### 6.2 Per-engine optimization tactics

| Engine | What it rewards | Tactic |
|---|---|---|
| **Perplexity** | Recent + structured + source attribution | Stamp every page with `dateModified`, use FAQPage schema, lead with definition block, cite our own data ("based on 1,200 hosted parties...") |
| **ChatGPT (with browse)** | Comprehensive + clear authorship | Author bios, "last updated" visible, tables that summarize content, no fluff intros |
| **Google AI Overviews** | Passage indexing — extracts paragraphs | One paragraph = one complete thought. Avoid "as we discussed earlier" — context-free passages. |
| **Claude (with web)** | Nuance + structure + accuracy | Use comparative framing ("X is better when Y; Z is better when W"). Avoid superlatives without backing. |
| **Apple Intelligence (Applebot-Extended)** | Privacy-respecting, factual | Same playbook as Google AI — clean structure, schema |

### 6.3 Universal GEO patterns (apply to every page)

1. **Definition block first** — "Eurovision Games is a free browser-based party game for the Eurovision Song Contest. Hosts create a room in 60 seconds, friends join with a code, and everyone predicts winners, plays trivia duels, and competes for five trophy titles." This block, in the first 300 words, gets cited.

2. **Self-contained passages (134–167 words ideal).** Each H2 section should be quotable on its own without needing surrounding context. Test: copy any paragraph into ChatGPT — does it make sense without the rest? If no, rewrite.

3. **Tables for facts.** Year-by-year winners, country-by-country counts, schedule times — always a table, not prose.

4. **Statistics with attribution.** "Sweden has won Eurovision 7 times (EBU, 2024)." Naked numbers get deprioritized.

5. **Numbered steps for processes.** "How to host" = numbered list, verb-first, ≤10 steps.

6. **Explicit Q&A pairs** with FAQPage schema. Question matches user query phrasing.

7. **Updated date visible** at top of page. Not just in schema — visible to humans.

8. **Author E-E-A-T** — short author bio block ("Written by [name], who has hosted [N] Eurovision parties since [year]"). Even one sentence boosts citation likelihood.

9. **Original data points** — track and publish stats from our own platform: "In our 2025 data, Top-5 picks averaged 73% accuracy on jury votes but only 42% on televote."

10. **Cross-link to entities** — any time we mention a country, year, song, or term, link to its page. AI engines treat these as entity signals.

### 6.4 New file: `/llms.txt`

Adopt the emerging `llms.txt` standard. This is a structured site-map for LLMs at the root, listing key pages with descriptions. Boosts AI ingestion. Keep it ≤8KB.

### 6.5 Citation testing protocol

Before launch + monthly thereafter:
1. Test these 10 queries on Perplexity, ChatGPT (with browse), Claude (with web), Google (look for AI Overview):
   - "best free eurovision party game"
   - "how to host a eurovision party"
   - "eurovision drinking game rules"
   - "when is eurovision 2026"
   - "where is eurovision 2026"
   - "eurovision 2026 predictions"
   - "eurovision trivia questions"
   - "douze points meaning"
   - "eurovision party games"
   - "eurovision sweepstake rules"
2. Score: cited (URL or brand name) = 1, not cited = 0. Track over time.
3. For each non-citation, identify the cited source and reverse-engineer their structure.

---

## 7. Schema.org plan — per page type

### 7.1 Site-wide (every page, in `<Layout>`)
- `Organization` — already present, expand `sameAs` (Twitter, Instagram, TikTok, LinkedIn if any)
- `WebSite` with `potentialAction: SearchAction` — enables sitelinks search box
- `BreadcrumbList` — every non-homepage

### 7.2 Per page type

| Page | Schema |
|---|---|
| `/` (Homepage) | `WebApplication` + `VideoGame` (yes, technically a video game) + `Organization` + `WebSite` + `FAQPage` |
| `/eurovision-2026` | `Event` (subEvents: semifinal 1, semifinal 2, grand final) + `BroadcastEvent` + `FAQPage` |
| `/eurovision-2026-predictions` | `Article` (with `dateModified` updated weekly) + `FAQPage` + `ItemList` (ranked predictions) |
| `/eurovision-2026-schedule` | `Event` + `BroadcastEvent` + `FAQPage` |
| `/eurovision-2026-semifinals` | `Event` (each semifinal as separate `Event`) + `ItemList` (running order) |
| `/eurovision-2026-songs` | `ItemList` of `MusicRecording` (each entry) + `Country` references |
| `/eurovision-party`, `/eurovision-night`, `/host-eurovision-party` | `HowTo` (full step-by-step) + `FAQPage` + `ItemList` (food / decor) |
| `/eurovision-games` | `WebApplication` + `Article` + `ItemList` (game modes) + `FAQPage` |
| `/how-to-play` | `HowTo` + `VideoObject` (if video added) + `FAQPage` |
| `/eurovision-trivia` | `Quiz` schema + `Question` (each trivia Q) + `FAQPage` |
| `/eurovision-quiz` | `Quiz` + `Question` array |
| `/eurovision-bingo` | `HowTo` + `Game` |
| `/eurovision-drinking-game` | `HowTo` + `Game` (with appropriate audience age signal) |
| `/eurovision-sweepstake` | `HowTo` |
| `/eurovision-history` | `Article` + `ItemList` (winners) |
| `/winners` (hub) | `CollectionPage` + `ItemList` |
| `/winners/[year]` | `Article` + `MusicRecording` (winning song) + `Person` (winning artist) + `Event` (the contest year) + `Country` |
| `/countries` (hub) | `CollectionPage` + `ItemList` |
| `/countries/[country]` | `Article` + `Country` + `ItemList` (entries by year) |
| `/glossary` | `DefinedTermSet` + `DefinedTerm` (each entry) |
| `/scoring` | `Article` + `FAQPage` + `HowTo` (how scoring works) |
| `/rules` | `Article` + `FAQPage` |
| `/compare/...` | `Article` + comparison table marked up properly |
| `/faq` | `FAQPage` (one big block) |
| `/about` | `AboutPage` + `Person` (founder) + `Organization` |
| `/printables` | `CollectionPage` + `DigitalDocument` per item |

### 7.3 Schema implementation rules
- JSON-LD only, in `<head>` or end-of-`<body>`
- Multiple blocks per page = OK
- Don't fake content — schema must match visible page content
- Use absolute URLs for image refs
- `inLanguage`: `"en"` or `"el"` per locale
- Cross-reference entities with `@id` (e.g., one `Organization` `@id` referenced from every page)

---

## 8. Internal linking strategy

### 8.1 Architecture: 4 hubs + clusters

```
                    Homepage (/)
                        │
       ┌────────────────┼────────────────────┬─────────────────┐
       │                │                    │                 │
   /eurovision-     /eurovision-       /eurovision-       /eurovision-
   2026 (hub)       party (hub)        games (hub)        history (hub)
       │                │                    │                 │
   ┌───┴───┐        ┌───┴────┐         ┌─────┴──────┐    ┌────┴────┐
schedule  songs   night  drinking-    how-to-play  trivia winners countries
semis predictions food/decor games    rules/scoring quiz  /year   /country
                  bingo/sweep         compare/*           glossary
                  printables
```

### 8.2 Linking rules
- **Every page** links to: homepage, its hub, 2–3 sibling spokes, 1–2 cross-cluster pages (e.g., `/eurovision-party` links to `/eurovision-games` and to `/eurovision-2026-predictions`).
- **Every hub page** has a "browse all" section linking to every spoke.
- **Every programmatic page** links to: hub, prev/next in series (e.g., `/winners/2024` ↔ `/winners/2025`), 3 related programmatic pages.
- **Footer:** all hub pages + key cross-cluster pages.
- **"Keep reading" cards** at end of every content page (3 cards, design pattern already exists per screenshots).

### 8.3 Anchor text policy
- 60% descriptive ("how to host a Eurovision party")
- 25% navigational ("Eurovision party guide")
- 15% branded ("Eurovision Games")
- Never repeat exact-match anchor twice on same page

---

## 9. Competitor / SERP feature analysis

### 9.1 Direct competitors per cluster

| Query | Top non-brand competitors | SERP features |
|---|---|---|
| "eurovision party games" | Buzzfeed, Cosmo, Time Out, Heatworld | PAA, image carousel |
| "eurovision drinking game" | Reddit /r/eurovision, BuzzFeed, Metro, Heatworld, various blogs | PAA, featured snippet (list), AI Overview |
| "eurovision bingo printable" | Etsy, Pinterest, Twinkl, free PDF blogs | Image carousel, shopping (Etsy) |
| "eurovision predictions 2026" | Wiwibloggs, ESCToday, Eurovisionworld, Oddschecker, BBC | News box, AI Overview |
| "eurovision trivia" | Sporcle, Trivia Genius, Quizly | None major |
| "when is eurovision 2026" | Eurovision.tv, Wikipedia, BBC, news outlets | Featured snippet (date), AI Overview, knowledge panel |
| "eurovision history" | Wikipedia, Eurovision.tv, BBC, Britannica | Knowledge panel, AI Overview |
| "douze points meaning" | Wikipedia, Eurovision.tv, language blogs | Featured snippet, AI Overview |
| "πάρτι eurovision" | Lifo, Cosmopolitan.gr, popcorner.gr, news247 | None major (low-competition opportunity) |
| "ελληνικό τραγούδι eurovision 2026" | News.gr, in.gr, Lifo, ert.gr | News box |

### 9.2 Where we can realistically win

| Query type | Win probability | Why |
|---|---|---|
| "free eurovision [game/quiz/etc]" | High | We're free, exact-match domain, can outpunch listicles |
| Long-tail Greek queries | Very high | Low competition, we'd be one of few high-quality bilingual sources |
| Question-based factual ("when/where/how") | Medium-high (GEO win) | Good schema + structure beats news outlets for AI extraction |
| Brand head terms ("eurovision") | Never | Don't try |
| News/predictions ("eurovision 2026 odds") | Medium | Need weekly updates to compete with Wiwibloggs et al |
| "[country] eurovision history" | High (for country pages) | Wikipedia is the only real competitor; we can write more engagingly |

### 9.3 SERP features we should target

| Feature | Path |
|---|---|
| Featured snippets | Definition blocks at top of every page |
| People Also Ask | Rich FAQPage schema with phrased questions |
| AI Overviews | All GEO patterns above |
| Image carousel | Add original photography/illustration to top hosting pages |
| Sitelinks search box | `WebSite` schema with `SearchAction` |
| Breadcrumbs | `BreadcrumbList` schema everywhere |
| Knowledge panel (long shot) | `Organization` + `Person` schema with `sameAs` to social profiles |

---

## 10. Technical SEO requirements (input to plan)

| Area | Status today | Required state |
|---|---|---|
| **i18n architecture** | Client-side switching, single URL per page | `/en/...` and `/el/...` paths with hreflang |
| **hreflang** | Missing | Each page emits hreflang for `en`, `el`, `x-default` |
| **Sitemap** | 15 URLs, no hreflang | Auto-generated, includes hreflang xhtml:link, ~210 URLs |
| **robots.txt** | Good (allows AI bots) | Add: `Bingbot`, `Yandex` (small but free), confirm `Applebot-Extended`, `cohere-ai`, `anthropic-ai` |
| **`/llms.txt`** | Missing | Create — list all hub + key pages with descriptions |
| **Structured data** | Organization, WebApplication, HowTo, FAQPage on some | All recommended schema in §7.2 |
| **Meta tags** | Per-page title/desc/canonical/OG | Same + `og:locale`, `og:locale:alternate` |
| **Core Web Vitals** | Unknown — needs audit | LCP <2.5s, INP <200ms, CLS <0.1 |
| **Image optimization** | Unknown | All images WebP/AVIF, lazy-loaded below fold, descriptive `alt`, dimensions set |
| **Pre-rendering / SSG** | SPA + `<noscript>` fallback | Consider pre-rendering routes for crawl reliability (esp. for new Tier 1 + programmatic pages) |
| **Canonical** | Per-page `SchemaHead` | Same — verify points to language-specific URL |
| **404 / 301 handling** | Unknown | 301 redirects for `/online-games` and `/mobile-games` deletions |
| **Mobile** | Tailwind responsive | Verify game UI + content pages on actual mobile |
| **Page speed** | Unknown | PSI score ≥90 mobile + desktop on all top-tier pages |

---

## 11. Quick reference: priority matrix

| Priority | Work |
|---|---|
| **P0 — must ship first** | i18n URL routing + hreflang · Sitemap regen · llms.txt · Schema audit on existing pages · `/eurovision-2026` hub · `/eurovision-2026-schedule` · `/eurovision-2026-semifinals` |
| **P1 — high impact** | Greek translations of all P0 pages · `/eurovision-drinking-game` · `/eurovision-bingo` · `/eurovision-sweepstake` · `/eurovision-quiz` · `/glossary` · `/host-eurovision-party` · Refresh of all 7 existing content pages with GEO patterns · Greek-exclusive pages |
| **P2 — scaling** | Programmatic `/winners/[year]` (70 pages) · Programmatic `/countries/[country]` (52 pages) · `/compare/*` pages · `/printables` · `/best-eurovision-app` · Citation testing infrastructure |
| **P3 — polish** | Author E-E-A-T blocks · Original data publication · Image optimization sweep · CWV improvements · Backlink outreach |

---

## 12. Success metrics

### Quantitative
- Indexed pages: 15 → ~200+ (90 days)
- Organic clicks (GSC): baseline → +400% in event week
- AI citation rate (10-query test): baseline → ≥60% within 90 days
- Greek organic clicks: baseline → +800% (much lower starting point)
- Avg position (top 50 keywords): baseline → top 10
- Featured snippets won: baseline → ≥15
- Core Web Vitals: all green

### Qualitative
- Brand mentioned in AI answers without URL (entity recognition)
- Cited by ≥3 mainstream Eurovision blogs/news outlets
- Greek user share of total traffic: target ≥25%

---

## Appendix A — Notes for the planner

- **Data sourcing for programmatic pages.** Past winners + country entries are public data (Wikipedia, EBU). Need a one-time scrape + local JSON store. Don't render from Wikipedia at runtime.
- **Predictions page must auto-update.** Either weekly manual edit or pull odds from a public API. If neither, set expectation to user that this page needs an editor.
- **Greek translation quality.** Do not machine-translate the final copy. Native review or native author for EL pages — this matters more in Greek where AI translations sound stilted and rank poorly.
- **Don't over-index on event week.** Build evergreen content (history, glossary, country pages) — that's what carries traffic between Eurovisions year-round.
- **Existing design system is strong.** Reuse: hero with eyebrow tag, numbered step cards, run-of-show timeline, comparison tables, FAQ accordions, "Keep reading" cards, gradient CTA blocks. Don't reinvent.

---

*Research compiled by SEO+GEO specialist skill. Hand to `superpowers:writing-plans` for execution plan.*

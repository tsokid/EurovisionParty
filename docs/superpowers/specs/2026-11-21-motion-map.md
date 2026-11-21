# Motion map — Track 2 redesign

**Owner decision (21 Nov 2026):** option B. Motion goes where something really
changes (points, rank, winner). The end of the night, the dashboards, the end of
a quiz round or a duel, and every ranking reveal get extra emotion and momentum.
Nothing decorative runs on loop on phones.

Prototypes: the "Motion" page of the redesign canvas.

## Rules

- **Properties:** only `transform` and `opacity` (plus `filter` on one element
  at a time for glows). No layout-animating properties.
- **Library:** framer-motion (already a dependency) for layout/FLIP and springs;
  CSS keyframes for loops; `canvas-confetti` (already a dependency) only at
  tier-1 moments.
- **Durations:** micro 120–200 ms · transitions 250–350 ms · moments
  600–1200 ms. Sequences longer than 3 s have **Skip**.
- **Easing:** springs for things that move into place (cards, rows, slots).
  Ease-out for enters, ease-in for exits.
- **`prefers-reduced-motion`:** every moment has a fade-only version with no
  confetti, no shake and no count-up (the final number is shown at once).
- **Sound and haptics:** use the existing `audioStore` (sound stays opt-in) and
  `navigator.vibrate` where supported (Android). Haptic only on tier 1–2.
- **Sync:** tier-1 moments are triggered by server state (room phase or
  realtime event), not by a local click. Every phone in the room plays them
  together, which is the party moment.
- **Budget:** no motion may drop below 60 fps on a mid-range Android. A screen
  never animates more than 2 things at once, apart from tier-1 sequences.

## Tier 1 — peaks (full screen, sound, haptic, synced)

| # | Moment | What moves |
|---|---|---|
| 1 | **Winners of the night** (final phase) | Stage dims, spotlight sweep. The 5 titles flip in one by one (Γκουρού → Μάντης → Μονομάχος → Κλέφτης → Πρωταθλητής), each with the avatar scaling in and a one-line reason. Πρωταθλητής comes last: gold burst, confetti, crown drop, total points counting up. The podium then grows 2-1-3 with a stagger and the rest of the ranking slides up. ~12 s, skippable. Desktop gets a **TV / presentation layout** to cast to the living-room TV. |
| 2 | **Official result vs your predictions** | Official top 5 revealed from 5th to 1st, Eurovision-scoreboard style. Your matching picks light up (+50 gold flash, +20 pink) and the prediction points tick up. |
| 3 | **End of a quiz round** | Answer dots tally one by one, "+12" chips fly into the round total, the total counts up. Then the mini leaderboard reorders (FLIP), the "↑2" chip flashes and a toast appears: "Πέρασες τον Τάσο!". |
| 4 | **Duel result** | VS intro (avatars slide in from both sides and clash), the 3 question results reveal side by side, the winner glows. The Κλέψε / Διπλασίασε cards flip in. On Κλέψε, the points fly from the loser's total to the winner's. |
| 5 | **Phase change** (host opens predictions, voting opens, final) | A banner sweeps across ("Οι προβλέψεις άνοιξαν!"), live pulse, haptic, the tab badge pops. |

## Tier 2 — feedback inside the flow

| # | Moment | What moves |
|---|---|---|
| 6 | Lobby: a player joins | Avatar pops in with a spring and a name toast. Host presses Start → 3-2-1 countdown. |
| 7 | Predictions: pick a country | Flag flies into the slot (shared layout). Slots reorder by drag. The progress ring fills. Lock → the lock snaps shut and a "seal" stamp appears. |
| 8 | Quiz answer | Correct: green fill sweep and "+12" floats up. Wrong: 200 ms shake and the right answer highlights. The timer ring turns red in the last 5 s. |
| 9 | Live leaderboard / dashboards | Rows reorder (FLIP), totals count up, ↑↓ chips flash. Overtaking someone → your row pulses and a toast "Πέρασες τον …". |
| 10 | Activity feed | New items slide in at the top. Old ones fade. |
| 11 | Incoming duel challenge | Card slides up from the bottom with a short buzz. |
| 12 | Points earned anywhere | The points chip in the game bar bumps (scale 1 → 1.15 → 1) and counts up. |

## Tier 3 — ambient and UI

- Hero "stage light": a slow gradient drift (20 s, CSS only), paused when off-screen or under reduced motion.
- Live dot pulse. Countdown digits flip on Home and on the hub.
- Button press scale 0.97. Tab switch crossfade (150 ms). Skeleton shimmer while loading.

## Not doing

Background particles, parallax, autoplay video or 3D in the hero, and confetti
anywhere other than tier 1. They cost Core Web Vitals (SEO) and battery during a
3-hour party.

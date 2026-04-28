import type { RoomPhase } from './types'

// ── Phase definitions ────────────────────────────────────────────────
export const PHASES: { key: RoomPhase; label: string; description: string }[] = [
  { key: 'lobby',            label: 'Lobby',              description: 'Players join the room and pick avatars' },
  { key: 'pre_night',        label: 'Pre-Night Show',     description: 'Quiz rounds and duels before the live show' },
  { key: 'predictions_open', label: 'Predictions Open',   description: 'Submit your Top 5 and Worst 5 predictions' },
  { key: 'voting_live',      label: 'Voting Live',        description: 'Voting is underway — buy intel reveals' },
  { key: 'final',            label: 'Final Results',      description: 'Official results are in — see the leaderboard' },
]

/** Ordered phase keys — single source of truth */
export const PHASE_ORDER: RoomPhase[] = PHASES.map((p) => p.key)

// ── Scoring rules ────────────────────────────────────────────────────
export const SCORING = {
  /** Quiz points by response-time tier (seconds) — matches server RPC submit_quiz_answer */
  quiz: {
    tier1: { maxSeconds: 3,  points: 12 },
    tier2: { maxSeconds: 7,  points: 8 },
    tier3: { maxSeconds: 15, points: 4 },
  },

  /** Prediction scoring */
  prediction: {
    /** Points for each country correctly placed in exact Top-5 position */
    exactPosition: 50,
    /** Points for a country that is in the Top 5 but wrong position */
    inTop5: 20,
    /** Points for each country correctly placed in exact Worst-5 position */
    exactWorst: 50,
    /** Points for a country that is in the Worst 5 but wrong position */
    inWorst5: 20,
  },

  /** Flat bonus for winning a duel */
  duelWin: 12,
} as const

// ── Emoji avatar options ─────────────────────────────────────────────
export const EMOJI_OPTIONS = [
  '\u{1F3A4}', // microphone
  '\u{1F3B8}', // guitar
  '\u{2B50}',  // star
  '\u{2728}',  // sparkles
  '\u{1F525}', // fire
  '\u{1F308}', // rainbow
  '\u{1F984}', // unicorn
  '\u{1F451}', // crown
  '\u{1F3B5}', // musical note
  '\u{1F3B6}', // musical notes
  '\u{1F3B9}', // musical keyboard
  '\u{1F3BA}', // trumpet
  '\u{1F3BB}', // violin
  '\u{1F3BC}', // musical score
  '\u{1F389}', // party popper
  '\u{1F38A}', // confetti ball
  '\u{1F680}', // rocket
  '\u{1F48E}', // gem stone
  '\u{1F31F}', // glowing star
  '\u{1F3C6}', // trophy
] as const

// ── Round composition (10 questions per round) ───────────────────────
export const ROUND_COMPOSITION: { category: string; difficulty: string; count: number }[] = [
  { category: '2026',      difficulty: 'easy',   count: 1 },
  { category: '2026',      difficulty: 'medium', count: 2 },
  { category: '2026',      difficulty: 'hard',   count: 1 },
  { category: 'history',   difficulty: 'medium', count: 1 },
  { category: 'history',   difficulty: 'hard',   count: 1 },
  { category: 'trivia',    difficulty: 'easy',   count: 1 },
  { category: 'trivia',    difficulty: 'medium', count: 1 },
  { category: 'lyrics',    difficulty: 'medium', count: 1 },
  // 1 hard from a rotating "wildcard" pool
  { category: '_wildcard', difficulty: 'hard',   count: 1 },
]

/** Categories that feed the wildcard slot */
export const WILDCARD_CATEGORIES = ['records', 'geography', 'staging'] as const

// ── Intel reveal costs ───────────────────────────────────────────────
export const INTEL_COSTS = {
  top3:   50,
  top10:  150,
  worst3: 50,
} as const

// ── Timers & limits ──────────────────────────────────────────────────
export const TIMER_SECONDS = 15
export const MAX_ROUNDS = 3
export const QUESTIONS_PER_ROUND = 10

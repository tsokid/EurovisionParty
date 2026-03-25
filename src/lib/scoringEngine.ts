import { SCORING } from './constants'

// ── Quiz scoring ─────────────────────────────────────────────────────

/**
 * Calculate quiz points for a single answer.
 *
 * @param responseSeconds - How long the player took (0-15 s).
 * @param isCorrect       - Whether the answer was correct.
 * @returns Points awarded (0 if incorrect).
 */
export function calculateQuizPoints(responseSeconds: number, isCorrect: boolean): number {
  if (!isCorrect) return 0

  const { tier1, tier2, tier3 } = SCORING.quiz

  if (responseSeconds <= tier1.maxSeconds) return tier1.points
  if (responseSeconds <= tier2.maxSeconds) return tier2.points
  if (responseSeconds <= tier3.maxSeconds) return tier3.points

  // Answered after timer expired (should not happen, but safe fallback)
  return 0
}

// ── Prediction scoring ───────────────────────────────────────────────

export interface PredictionScore {
  top5Points: number
  worst5Points: number
}

/**
 * Score a player's Top-5 and Worst-5 predictions against the official ranking.
 *
 * @param playerTop5        - Player's predicted top 5 country IDs (index 0 = winner).
 * @param playerWorst5      - Player's predicted worst 5 country IDs (index 0 = last place).
 * @param officialRanking   - Official result, ordered 1st to last.
 * @returns Breakdown of top-5 and worst-5 points.
 */
export function scorePredictions(
  playerTop5: string[],
  playerWorst5: string[],
  officialRanking: string[],
): PredictionScore {
  const { exactPosition, inTop5, exactWorst, inWorst5 } = SCORING.prediction

  const officialTop5 = officialRanking.slice(0, 5)
  const officialWorst5 = officialRanking.slice(-5).reverse() // index 0 = last place

  let top5Points = 0
  for (let i = 0; i < playerTop5.length; i++) {
    const country = playerTop5[i]
    if (country === officialTop5[i]) {
      top5Points += exactPosition
    } else if (officialTop5.includes(country)) {
      top5Points += inTop5
    }
  }

  let worst5Points = 0
  for (let i = 0; i < playerWorst5.length; i++) {
    const country = playerWorst5[i]
    if (country === officialWorst5[i]) {
      worst5Points += exactWorst
    } else if (officialWorst5.includes(country)) {
      worst5Points += inWorst5
    }
  }

  return { top5Points, worst5Points }
}

// Duel resolution is handled server-side by submit_duel_answers RPC

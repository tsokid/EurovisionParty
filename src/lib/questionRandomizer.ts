import type { QuizQuestion } from './types'
import { QUESTIONS } from './questions'
import { ROUND_COMPOSITION, WILDCARD_CATEGORIES, QUESTIONS_PER_ROUND } from './constants'

// ── Fisher-Yates shuffle (in-place) ──────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Select exactly {@link QUESTIONS_PER_ROUND} questions for one quiz round,
 * following the composition defined in {@link ROUND_COMPOSITION}.
 *
 * @param excludeIds - Question IDs already used in earlier rounds.
 * @returns An array of 10 questions, shuffled in presentation order.
 */
export function selectRoundQuestions(excludeIds: number[] = []): QuizQuestion[] {
  const excludeSet = new Set(excludeIds)
  const available = QUESTIONS.filter((q) => !excludeSet.has(q.id))

  const selected: QuizQuestion[] = []

  for (const slot of ROUND_COMPOSITION) {
    const { category, difficulty, count } = slot

    let pool: QuizQuestion[]

    if (category === '_wildcard') {
      // Draw from the rotating wildcard categories
      pool = available.filter(
        (q) =>
          (WILDCARD_CATEGORIES as readonly string[]).includes(q.category ?? '') &&
          q.difficulty === difficulty &&
          !selected.some((s) => s.id === q.id),
      )
    } else {
      pool = available.filter(
        (q) =>
          q.category === category &&
          q.difficulty === difficulty &&
          !selected.some((s) => s.id === q.id),
      )
    }

    shuffle(pool)
    const picked = pool.slice(0, count)

    if (picked.length < count) {
      // Fallback: fill from any remaining unused questions at the same difficulty
      const fallback = available.filter(
        (q) =>
          q.difficulty === difficulty &&
          !selected.some((s) => s.id === q.id) &&
          !picked.some((p) => p.id === q.id),
      )
      shuffle(fallback)
      picked.push(...fallback.slice(0, count - picked.length))
    }

    selected.push(...picked)
  }

  // Final shuffle so question order is unpredictable
  shuffle(selected)

  // Guard: always return exactly QUESTIONS_PER_ROUND
  return selected.slice(0, QUESTIONS_PER_ROUND)
}

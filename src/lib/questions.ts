import type { QuizQuestion } from './types'
import questionsJson from '../../quiz-questions-500.json'

/**
 * Map raw JSON (which uses `correct`) to our QuizQuestion type (which uses `correct_index`).
 */
interface RawQuestion {
  id: number
  category: string
  difficulty: string
  question: string
  options: string[]
  correct: number
}

// ── Full question bank ───────────────────────────────────────────────
export const QUESTIONS: QuizQuestion[] = (
  questionsJson as { questions: RawQuestion[] }
).questions.map((q) => ({
  id: q.id,
  question: q.question,
  options: q.options,
  correct_index: q.correct,
  category: q.category,
  difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
}))

// ── Indexed by ID for O(1) lookups ───────────────────────────────────
export const QUESTIONS_BY_ID = new Map<number, QuizQuestion>(
  QUESTIONS.map((q) => [q.id, q]),
)

// ── Helpers ──────────────────────────────────────────────────────────

/** Return all questions in a given category. */
export function getQuestionsByCategory(category: string): QuizQuestion[] {
  return QUESTIONS.filter((q) => q.category === category)
}

/** Return all questions at a given difficulty. */
export function getQuestionsByDifficulty(difficulty: string): QuizQuestion[] {
  return QUESTIONS.filter((q) => q.difficulty === difficulty)
}

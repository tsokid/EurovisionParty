import i18n from '../i18n';
import type { QuizQuestion } from './types';

/** Return question text and options in the current language.
 *  Safe against undefined input — returns empty fallback so callers never crash. */
export function getLocalizedQuestion(
  q: QuizQuestion | undefined | null,
): { question: string; options: string[] } {
  if (!q) return { question: '', options: [] };
  const isGreek = i18n.language === 'el';
  return {
    question: (isGreek && q.question_el) ? q.question_el : q.question,
    options: (isGreek && q.options_el?.length) ? q.options_el : q.options,
  };
}

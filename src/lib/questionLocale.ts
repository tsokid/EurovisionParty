import i18n from '../i18n';
import type { QuizQuestion } from './types';

/** Return question text and options in the current language. */
export function getLocalizedQuestion(q: QuizQuestion): { question: string; options: string[] } {
  const isGreek = i18n.language === 'el';
  return {
    question: (isGreek && q.question_el) ? q.question_el : q.question,
    options: (isGreek && q.options_el?.length) ? q.options_el : q.options,
  };
}

import type { TFunction } from 'i18next';
import { DUEL_MAX_POINTS, formatSeconds, type DuelChip, type QuizChip } from '../../lib/answerPoints';
import type { AnswerChipView } from './QuestionCard';

/** "+12 · 2,1″" (quiz): the server's points and the server's measured time. */
export function quizChipView(c: QuizChip, t: TFunction, lang: string): AnswerChipView {
  if (c.kind === 'correct') {
    return { points: c.points, reason: c.seconds != null ? formatSeconds(c.seconds, lang, 'ceil') : t('questionCard.reasonCorrect') };
  }
  return { points: c.points, reason: c.kind === 'timeout' ? t('questionCard.reasonTimeout') : t('questionCard.reasonWrong') };
}

/** "+10 · 12−2" (duel): DuelAnswer.points and the floor(seconds) it used. */
export function duelChipView(c: DuelChip, t: TFunction): AnswerChipView {
  if (c.kind === 'correct') return { points: c.points, reason: `${DUEL_MAX_POINTS}−${c.secondsTaken}` };
  return { points: c.points, reason: c.kind === 'timeout' ? t('questionCard.reasonTimeout') : t('questionCard.reasonWrong') };
}

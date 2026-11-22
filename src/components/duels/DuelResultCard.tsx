import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Check, Minus, Play, RotateCcw, X } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import { QUESTIONS_BY_ID } from '../../lib/questions';
import { duelAnswerChip, duelOutcome, duelRewardPreview, needsRewardChoice } from '../../lib/answerPoints';
import { duelChipView } from '../quiz/chipText';
import { PlayerAvatar, PointsChip } from '../stage';
import type { Duel, DuelAnswer, DuelDecision } from '../../lib/types';

interface DuelResultCardProps {
  duel: Duel;
  onDecision?: (duelId: string, decision: DuelDecision) => void;
  onRematch?: (duelId: string) => void;
  hasRematch?: boolean;
  /** Replays the result moment (DuelResultMoment). */
  onOpen?: (duelId: string) => void;
}

const correctOf = (a: DuelAnswer) => QUESTIONS_BY_ID.get(a.questionId)?.correct_index === a.answerIndex;

/**
 * A finished duel in the list (board duels-after-m, state 2): outcome,
 * both sides with avatar and duel score, this player's "+N · 12−s" chips
 * adding up to the duel score, and for the winner the two reward cards
 * («Κλέψε ή διπλασίασε τους πόντους που κέρδισες»). A tie has no chooser.
 * Amounts mirror apply_duel_decision; after the choice the card shows the
 * server's points_transferred.
 */
export default function DuelResultCard({ duel, onDecision, onRematch, hasRematch, onOpen }: DuelResultCardProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const { player, players } = useGameStore();
  const [deciding, setDeciding] = useState(false);

  const outcome = duelOutcome(duel, player?.id);
  const isChallenger = player?.id === duel.challenger_id;
  const meSide = { id: isChallenger ? duel.challenger_id : duel.challenged_id, score: (isChallenger ? duel.challenger_score : duel.challenged_score) ?? 0, answers: (isChallenger ? duel.challenger_answers : duel.challenged_answers) ?? [] };
  const opSide = { id: isChallenger ? duel.challenged_id : duel.challenger_id, score: (isChallenger ? duel.challenged_score : duel.challenger_score) ?? 0 };
  const me = players.find((p) => p.id === meSide.id);
  const op = players.find((p) => p.id === opSide.id);
  const preview = duelRewardPreview(meSide.score, op?.total_points ?? 0);
  const needsDecision = needsRewardChoice(duel, player?.id) && !!onDecision;

  const handleDecision = async (decision: DuelDecision) => {
    if (!onDecision) return;
    setDeciding(true);
    try {
      await onDecision(duel.id, decision);
    } finally {
      setDeciding(false);
    }
  };

  const markClass = outcome === 'win' ? 'ok' : outcome === 'lose' ? 'bad' : 'tie';
  const markText = outcome === 'win' ? t('duelResult.won') : outcome === 'lose' ? t('duelResult.lost') : outcome === 'tie' ? t('duelResult.tie') : t('duelResult.completed');
  const opName = op?.name ?? '—';

  let decisionLine: string | null = null;
  if (duel.winner_decision) {
    const pts = duel.points_transferred ?? 0;
    if (outcome === 'win') decisionLine = duel.winner_decision === 'steal' ? t('duelResult.stolePoints', { amount: pts }) : t('duelResult.doubledPoints', { amount: pts });
    else decisionLine = duel.winner_decision === 'steal' ? t('duelResult.stolenFromYou', { amount: pts }) : t('duelResult.doubledByOther', { amount: pts });
  }

  return (
    <motion.section
      layout={!reduce}
      initial={{ opacity: 0, y: reduce ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('card du-res', markClass)}
    >
      <div className="du-res-top">
        <span className={clsx('du-mk', markClass)}>
          {outcome === 'win' ? <Check aria-hidden="true" strokeWidth={3} /> : outcome === 'lose' ? <X aria-hidden="true" strokeWidth={3} /> : <Minus aria-hidden="true" strokeWidth={3} />}
          {markText}
        </span>
        <span className="spacer" />
        <span className="t-meta du-res-with">{t(duel.is_rematch ? 'duelResult.rematchWith' : 'duelResult.duelWith', { name: opName })}</span>
      </div>

      <div className="du-res-vs">
        <div className="du-res-side">
          <PlayerAvatar name={me?.name ?? '—'} avatarId={me?.avatar_id} size="lg" />
          <span className="du-res-name">{me?.name}<br /><span className="t-meta">{t('lobby.you')}</span></span>
          <span className={clsx('num du-res-score', outcome === 'win' && 'win')}>{meSide.score}</span>
        </div>
        <span className="num du-res-vs-t" aria-hidden="true">VS</span>
        <div className="du-res-side">
          <PlayerAvatar name={opName} avatarId={op?.avatar_id} size="lg" />
          <span className="du-res-name">{opName}</span>
          <span className={clsx('num du-res-score', outcome === 'lose' && 'win')}>{opSide.score}</span>
        </div>
      </div>

      {meSide.answers.length > 0 && (
        <div className="du-res-chips">
          {meSide.answers.map((a, i) => {
            const v = duelChipView(duelAnswerChip(a, correctOf(a)), t);
            return <PointsChip key={i} points={v.points} reason={v.reason} />;
          })}
          <span className="t-meta">= {t('duelPlay.yourScore')} <span className="num du-res-sum">{meSide.score}</span></span>
        </div>
      )}

      {outcome === 'tie' && <p className="t-meta du-res-note">{t('duelResult.tieDesc')}</p>}
      {decisionLine && <p className="du-res-decided">{decisionLine}</p>}
      {outcome === 'lose' && !duel.winner_decision && <p className="t-meta du-res-note">{t('duelMoment.waitChoice', { name: opName })}</p>}

      {needsDecision && (
        <div className="du-res-choose">
          <h3 className="t-h3">{t('duelMoment.choose')}</h3>
          <div className="du-choices static">
            <button type="button" className="du-choice steal" onClick={() => handleDecision('steal')} disabled={deciding || !preview.canSteal}>
              <span className="t-eyebrow">{t('duelMoment.steal')}</span>
              <span className="num du-choice-n">{preview.steal}</span>
              <span className="t-meta du-choice-m">
                {preview.canSteal
                  ? <>{t('duelMoment.youPlus', { points: preview.steal })}<br />{t('duelMoment.nameMinus', { name: opName, points: preview.steal })}</>
                  : t('duelMoment.stealNone')}
              </span>
            </button>
            <button type="button" className="du-choice double" onClick={() => handleDecision('double')} disabled={deciding}>
              <span className="t-eyebrow">{t('duelMoment.double')}</span>
              <span className="num du-choice-n">{preview.double}</span>
              <span className="t-meta du-choice-m">
                {t('duelMoment.youPlusDouble', { points: preview.double, score: meSide.score })}<br />{t('duelMoment.nameZero', { name: opName })}
              </span>
            </button>
          </div>
          <p className="t-meta">{t('duelMoment.stealCap')}</p>
        </div>
      )}

      <div className="du-res-actions">
        {onOpen && (outcome === 'win' || outcome === 'lose' || outcome === 'tie') && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(duel.id)}>
            <Play aria-hidden="true" strokeWidth={2.4} />
            {t('duelResult.replay')}
          </button>
        )}
        {outcome === 'lose' && !hasRematch && onRematch && duel.winner_decision && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onRematch(duel.id)}>
            <RotateCcw aria-hidden="true" strokeWidth={2.4} />
            {t('duelResult.rematchBtn')}
          </button>
        )}
        {outcome === 'lose' && hasRematch && <span className="t-meta">{t('duelResult.rematchRequested')}</span>}
      </div>
    </motion.section>
  );
}

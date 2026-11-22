import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Swords } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import { PlayerAvatar } from '../stage';
import type { Duel } from '../../lib/types';

interface DuelCardProps {
  duel: Duel;
  onAccept?: (duelId: string) => void;
  onDecline?: (duelId: string) => void;
  onAnswer?: (duelId: string) => void;
  /** Current player's decline usage — shown on the Decline button */
  declineInfo?: { used: number; max: number };
}

/**
 * An open duel: an incoming challenge (board duels-after-m: «Πρόκληση από:
 * Name», avatars VS, rules, Άρνηση / Αποδοχή) or one waiting for this
 * player's answers. An incoming challenge slides up from the bottom
 * (motion map #11); fade only under reduced motion.
 */
export default function DuelCard({ duel, onAccept, onDecline, onAnswer, declineInfo }: DuelCardProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const { player, players } = useGameStore();

  const isChallenged = player?.id === duel.challenged_id;
  const isChallenger = player?.id === duel.challenger_id;
  const opponentId = isChallenger ? duel.challenged_id : duel.challenger_id;
  const opponent = players.find((p) => p.id === opponentId);
  const me = players.find((p) => p.id === player?.id);
  const incoming = duel.status === 'pending' && isChallenged;

  // Check if current player needs to answer (using new multi-answer fields)
  const needsAnswer =
    (duel.status === 'accepted' || duel.status === 'answering') &&
    ((isChallenger && (!duel.challenger_answers || duel.challenger_answers.length === 0)) ||
      (isChallenged && (!duel.challenged_answers || duel.challenged_answers.length === 0)));

  const noDeclines = declineInfo !== undefined && declineInfo.used >= declineInfo.max;
  const opName = opponent?.name ?? '—';

  return (
    <motion.section
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : incoming ? { opacity: 0, y: 60 } : { opacity: 0, y: 10 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={reduce ? { duration: 0.2 } : incoming ? { type: 'spring', stiffness: 320, damping: 26 } : { duration: 0.25 }}
      className={clsx(incoming ? 'card-hero' : 'card', 'du-open')}
    >
      <div className="du-open-top">
        <span className={clsx('chip', incoming ? 'chip-pink' : 'chip-live')}>
          <span className="dot" />
          {incoming ? t('duelCard.incoming') : duel.is_rematch ? t('duelCard.rematch') : t('duelCard.yourTurn')}
        </span>
        <span className="spacer" />
        {incoming && declineInfo && <span className="t-meta">{t('duelCard.declinesCount', { used: declineInfo.used, max: declineInfo.max })}</span>}
      </div>

      <h3 className="t-h3 du-open-title">
        {incoming ? t('duelCard.challengeFrom', { name: opName }) : t('duelResult.duelWith', { name: opName })}
      </h3>

      <div className="du-open-vs">
        <div className="du-open-side">
          <PlayerAvatar name={opName} avatarId={opponent?.avatar_id} size="lg" />
          <span className="du-open-name">{opName}</span>
        </div>
        <span className="num du-open-vs-t" aria-hidden="true">VS</span>
        <div className="du-open-side">
          <PlayerAvatar name={me?.name ?? '—'} avatarId={me?.avatar_id} size="lg" />
          <span className="du-open-name">{me?.name}<br /><span className="t-meta">{t('lobby.you')}</span></span>
        </div>
      </div>

      <p className="t-meta du-open-rules">{t('duelCard.rules')}</p>

      {incoming && (
        <div className="du-open-actions">
          <button type="button" className="btn btn-ghost" onClick={() => onDecline?.(duel.id)} disabled={noDeclines}>
            {noDeclines ? t('duelCard.noDeclines') : t('duelCard.declineBtn')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onAccept?.(duel.id)}>
            {t('duelCard.acceptBtn')}
          </button>
        </div>
      )}

      {needsAnswer && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => onAnswer?.(duel.id)}>
          <Swords aria-hidden="true" strokeWidth={2.4} />
          {t('duelCard.answerNow')}
        </button>
      )}
    </motion.section>
  );
}

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { useGameStore } from '../../stores/gameStore';
import type { Duel, Player } from '../../lib/types';

interface DuelCardProps {
  duel: Duel;
  onAccept?: (duelId: string) => void;
  onDecline?: (duelId: string) => void;
  onAnswer?: (duelId: string) => void;
  /** Current player's decline usage — shown on the Decline button */
  declineInfo?: { used: number; max: number };
}

function getPlayerInfo(
  playerId: string,
  players: Player[],
): { name: string; emoji: string } {
  const p = players.find((pl) => pl.id === playerId);
  return {
    name: p?.name ?? 'Player',
    emoji: p?.avatar_emoji ?? '👤',
  };
}

const statusConfig: Record<
  string,
  { labelKey: string; variant: 'gold' | 'purple' | 'green' | 'red' }
> = {
  pending: { labelKey: 'duelCard.statusPending', variant: 'gold' },
  accepted: { labelKey: 'duelCard.statusActive', variant: 'purple' },
  answering: { labelKey: 'duelCard.statusActive', variant: 'purple' },
  completed: { labelKey: 'duelCard.statusCompleted', variant: 'green' },
  expired: { labelKey: 'duelCard.statusExpired', variant: 'red' },
  declined: { labelKey: 'duelCard.statusDeclined', variant: 'red' },
};

export default function DuelCard({
  duel,
  onAccept,
  onDecline,
  onAnswer,
  declineInfo,
}: DuelCardProps) {
  const { t } = useTranslation();
  const { player, players } = useGameStore();

  const challenger = getPlayerInfo(duel.challenger_id, players);
  const challenged = getPlayerInfo(duel.challenged_id, players);
  const config = statusConfig[duel.status] ?? statusConfig.pending;

  const isChallenged = player?.id === duel.challenged_id;
  const isChallenger = player?.id === duel.challenger_id;

  // Check if current player needs to answer (using new multi-answer fields)
  const needsAnswer =
    (duel.status === 'accepted' || duel.status === 'answering') &&
    ((isChallenger && (!duel.challenger_answers || duel.challenger_answers.length === 0)) ||
      (isChallenged && (!duel.challenged_answers || duel.challenged_answers.length === 0)));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        {/* Header with status */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-white/40 font-medium">
            {duel.is_rematch ? t('duelCard.rematch') : t('duelCard.duel')}
          </span>
          <Badge variant={config.variant}>{t(config.labelKey)}</Badge>
        </div>

        {/* VS display */}
        <div className="flex items-center justify-between">
          {/* Challenger */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <span className="text-sm text-white font-medium truncate max-w-[80px]">
              {challenger.name}
            </span>
            {isChallenger && (
              <span className="text-[10px] text-euro-purple-light">You</span>
            )}
          </div>

          {/* VS */}
          <div className="flex-shrink-0 px-3">
            <span className="text-lg font-extrabold glow-text">VS</span>
          </div>

          {/* Challenged */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <span className="text-sm text-white font-medium truncate max-w-[80px]">
              {challenged.name}
            </span>
            {isChallenged && (
              <span className="text-[10px] text-euro-purple-light">You</span>
            )}
          </div>
        </div>

        {/* Action buttons for pending challenges (received) */}
        {duel.status === 'pending' && isChallenged && (
          <div className="flex flex-col gap-1.5 mt-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                fullWidth
                onClick={() => onDecline?.(duel.id)}
                disabled={declineInfo !== undefined && declineInfo.used >= declineInfo.max}
              >
                {declineInfo && declineInfo.used >= declineInfo.max
                  ? t('duelCard.noDeclines')
                  : t('duelCard.declineBtn')}
              </Button>
              <Button
                size="sm"
                fullWidth
                onClick={() => onAccept?.(duel.id)}
              >
                {t('duelCard.acceptBtn')}
              </Button>
            </div>
            {declineInfo && (
              <p className="text-center text-[10px] text-white/30">
                {t('duelCard.declinesCount', { used: declineInfo.used, max: declineInfo.max })}
              </p>
            )}
          </div>
        )}

        {/* Answer button for active duels where it's your turn */}
        {needsAnswer && (
          <div className="mt-3">
            <Button
              size="sm"
              fullWidth
              onClick={() => onAnswer?.(duel.id)}
              className="animate-pulse"
            >
              {t('duelCard.answerNow')}
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

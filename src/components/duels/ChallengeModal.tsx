import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useGameStore } from '../../stores/gameStore';
import type { Duel } from '../../lib/types';

interface ChallengeModalProps {
  open: boolean;
  onClose: () => void;
  onChallenge: (opponentId: string) => void;
  isLoading?: boolean;
  /** All duels for the current player so we can check existing challenges */
  duels?: Duel[];
}

/**
 * Check if the current player can challenge this opponent.
 *
 * Rule 2: Only one pending challenge to any given opponent at a time.
 * Rule 3: A player can only challenge the same opponent ONCE (rematches are
 *         separate and initiated by the loser via the result card).
 * Rule 4: Players can play each other at most twice (original + 1 rematch).
 *         Once a rematch duel exists between the pair, no new challenges.
 */
function canChallenge(
  playerId: string,
  opponentId: string,
  duels: Duel[],
): { allowed: boolean; reason?: string } {
  const pairDuels = duels.filter(
    (d) =>
      (d.challenger_id === playerId && d.challenged_id === opponentId) ||
      (d.challenger_id === opponentId && d.challenged_id === playerId),
  );

  if (pairDuels.length === 0) return { allowed: true };

  // Rule 2: active duel between the pair → blocked
  const activeDuel = pairDuels.find((d) =>
    ['pending', 'accepted', 'answering'].includes(d.status),
  );
  if (activeDuel) return { allowed: false, reason: 'challengeModal.duelInProgress' };

  // Rule 4: a rematch already exists between the pair → max 2 plays reached
  const rematchExists = pairDuels.some((d) => d.is_rematch);
  if (rematchExists) return { allowed: false, reason: 'challengeModal.maxDuels' };

  // Rule 3: this player already sent a challenge to this opponent (non-rematch)
  const myPrevChallenge = pairDuels.find(
    (d) => d.challenger_id === playerId && !d.is_rematch,
  );
  if (myPrevChallenge) return { allowed: false, reason: 'challengeModal.alreadyChallenged' };

  return { allowed: true };
}

export default function ChallengeModal({
  open,
  onClose,
  onChallenge,
  isLoading = false,
  duels = [],
}: ChallengeModalProps) {
  const { t } = useTranslation();
  const { player, players } = useGameStore();
  const [challengingId, setChallengingId] = useState<string | null>(null);

  // Filter out current player and inactive players
  const opponents = players.filter(
    (p) => p.id !== player?.id && p.is_active,
  );

  const handleChallenge = (opponentId: string) => {
    setChallengingId(opponentId);
    onChallenge(opponentId);
  };

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="text-center mb-4">
        <div className="text-3xl mb-2">{'\u2694\uFE0F'}</div>
        <h3 className="glow-text text-xl font-bold">{t('challengeModal.title')}</h3>
        <p className="text-white/50 text-sm mt-1">
          {t('challengeModal.subtitle')}
        </p>
      </div>

      {/* Player list */}
      {opponents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-white/40 text-sm">{t('challengeModal.noPlayers')}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {opponents.map((opponent) => {
            const check = player
              ? canChallenge(player.id, opponent.id, duels)
              : { allowed: false, reason: 'Loading...' };

            return (
              <motion.div
                key={opponent.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 glass rounded-xl px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {opponent.name}
                  </p>
                  <p className="text-white/40 text-xs">
                    {opponent.total_points} {t('common.pts')}
                  </p>
                </div>
                {check.allowed ? (
                  <Button
                    size="sm"
                    onClick={() => handleChallenge(opponent.id)}
                    disabled={isLoading && challengingId === opponent.id}
                    loading={isLoading && challengingId === opponent.id}
                  >
                    {t('challengeModal.challengeBtn')}
                  </Button>
                ) : (
                  <span className="text-xs text-white/30 italic whitespace-nowrap">
                    {t(check.reason!)}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Close button */}
      <div className="mt-4">
        <Button variant="ghost" fullWidth onClick={onClose}>
          {t('challengeModal.cancelBtn')}
        </Button>
      </div>
    </Modal>
  );
}

import { useState } from 'react';
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
 * Rules:
 * - Only 1 active duel per pair (pending, accepted, answering)
 * - If a previous duel was declined, allow ONE more challenge
 * - If a completed duel exists (with or without rematch), no more challenges
 */
function canChallenge(
  playerId: string,
  opponentId: string,
  duels: Duel[],
): { allowed: boolean; reason?: string } {
  // Get all duels between these two players (in either direction)
  const pairDuels = duels.filter(
    (d) =>
      (d.challenger_id === playerId && d.challenged_id === opponentId) ||
      (d.challenger_id === opponentId && d.challenged_id === playerId),
  );

  if (pairDuels.length === 0) return { allowed: true };

  // If any duel is still active (pending/accepted/answering), block
  const activeDuel = pairDuels.find((d) =>
    ['pending', 'accepted', 'answering'].includes(d.status),
  );
  if (activeDuel) {
    return { allowed: false, reason: 'Challenge already sent' };
  }

  // If any completed duel exists, block (they can only rematch through the result card)
  const completedDuel = pairDuels.find((d) => d.status === 'completed');
  if (completedDuel) {
    return { allowed: false, reason: 'Already dueled' };
  }

  // Count declined duels initiated by this player
  const declinedByMe = pairDuels.filter(
    (d) => d.status === 'declined' && d.challenger_id === playerId,
  );
  if (declinedByMe.length >= 2) {
    return { allowed: false, reason: 'Declined twice' };
  }

  // One decline = allow one more try
  return { allowed: true };
}

export default function ChallengeModal({
  open,
  onClose,
  onChallenge,
  isLoading = false,
  duels = [],
}: ChallengeModalProps) {
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
        <h3 className="glow-text text-xl font-bold">Challenge a Player!</h3>
        <p className="text-white/50 text-sm mt-1">
          Pick your opponent for a 3-question duel
        </p>
      </div>

      {/* Player list */}
      {opponents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-white/40 text-sm">No other players available</p>
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
                <span className="text-2xl flex-shrink-0">
                  {opponent.avatar_emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {opponent.name}
                  </p>
                  <p className="text-white/40 text-xs">
                    {opponent.total_points} pts
                  </p>
                </div>
                {check.allowed ? (
                  <Button
                    size="sm"
                    onClick={() => handleChallenge(opponent.id)}
                    disabled={isLoading && challengingId === opponent.id}
                    loading={isLoading && challengingId === opponent.id}
                  >
                    Challenge!
                  </Button>
                ) : (
                  <span className="text-xs text-white/30 italic whitespace-nowrap">
                    {check.reason}
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
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

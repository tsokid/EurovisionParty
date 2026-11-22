import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Swords } from 'lucide-react';
import Modal from '../ui/Modal';
import { PlayerAvatar } from '../stage';
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
    <Modal open={open} onClose={onClose} label={t('challengeModal.title')}>
      <div className="du-cm">
        <div className="du-cm-head">
          <span className="du-cm-ico" aria-hidden="true"><Swords strokeWidth={2.4} /></span>
          <h3 className="t-h3">{t('challengeModal.title')}</h3>
          <p className="t-meta">{t('challengeModal.subtitle')}</p>
        </div>

        {opponents.length === 0 ? (
          <p className="t-meta du-cm-empty">{t('challengeModal.noPlayers')}</p>
        ) : (
          <ul className="du-cm-list">
            {opponents.map((opponent) => {
              const check = player
                ? canChallenge(player.id, opponent.id, duels)
                : { allowed: false, reason: 'common.loading' };
              const busy = isLoading && challengingId === opponent.id;
              return (
                <li key={opponent.id} className="player du-cm-row">
                  <PlayerAvatar name={opponent.name} avatarId={opponent.avatar_id} />
                  <div className="du-cm-who">
                    <p className="du-cm-name">{opponent.name}</p>
                    <p className="t-meta">{t('game.points', { count: opponent.total_points })}</p>
                  </div>
                  {check.allowed ? (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handleChallenge(opponent.id)} disabled={busy}>
                      {busy ? t('common.loading') : t('challengeModal.challengeBtn')}
                    </button>
                  ) : (
                    <span className="t-meta du-cm-why">{t(check.reason!)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
          {t('challengeModal.cancelBtn')}
        </button>
      </div>
    </Modal>
  );
}

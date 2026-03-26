import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDuels } from '../../hooks/useDuels';
import { useGameStore } from '../../stores/gameStore';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import DuelCard from './DuelCard';
import DuelPlayScreen from './DuelPlayScreen';
import DuelResultCard from './DuelResultCard';
import ChallengeModal from './ChallengeModal';
import type { Duel, DuelAnswer, DuelDecision } from '../../lib/types';

/** Client-side mirror of the DB get_max_declines() function */
function getMaxDeclines(playerCount: number): number {
  if (playerCount <= 5) return 2;
  if (playerCount <= 10) return 3;
  if (playerCount <= 15) return 4;
  return 5;
}

export default function DuelsScreen() {
  const { room, player, players } = useGameStore();
  const {
    duels, pendingDuels, activeDuels, pendingDecisions,
    createDuel, acceptDuel, declineDuel, submitDuelAnswers,
    makeDecision, requestRematch, fetchPlayerDuels, isLoading,
  } = useDuels(room?.id);

  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [playingDuel, setPlayingDuel] = useState<Duel | null>(null);

  useEffect(() => {
    if (player?.id) fetchPlayerDuels(player.id);
  }, [player?.id, fetchPlayerDuels]);

  // Categorize duels for current player
  const receivedPending = pendingDuels.filter((d) => d.challenged_id === player?.id);
  const sentPending = pendingDuels.filter((d) => d.challenger_id === player?.id);

  const myTurn = activeDuels.filter((d) => {
    if (!player) return false;
    const isChallenger = d.challenger_id === player.id;
    const myAnswers = isChallenger ? d.challenger_answers : d.challenged_answers;
    return !myAnswers || myAnswers.length === 0;
  });

  const waitingForOpponent = activeDuels.filter((d) => {
    if (!player) return false;
    const isChallenger = d.challenger_id === player.id;
    const myAnswers = isChallenger ? d.challenger_answers : d.challenged_answers;
    const opponentAnswers = isChallenger ? d.challenged_answers : d.challenger_answers;
    return (myAnswers?.length ?? 0) > 0 && (opponentAnswers?.length ?? 0) === 0;
  });

  const myPendingDecisions = pendingDecisions.filter((d) => d.winner_id === player?.id);

  const completedDuels = duels.filter((d) =>
    (d.status === 'completed' && d.winner_decision !== null) || d.status === 'declined'
  ).slice(0, 8);

  // Check if a rematch already exists for a duel
  const hasRematch = (duelId: string) => duels.some((d) => d.parent_duel_id === duelId);

  // Decline limit info for current player
  const maxDeclines = getMaxDeclines(players.length);
  const declineInfo = { used: player?.decline_count ?? 0, max: maxDeclines };

  // Create challenge
  const handleChallenge = useCallback(async (opponentId: string) => {
    if (!player || !room) return;
    setIsCreating(true);
    try {
      await createDuel(player.id, opponentId, room.id);
      await supabase.from('notifications').insert({
        room_id: room.id, player_id: opponentId, type: 'duel_challenge',
        payload: { challengerName: player.name, challengerId: player.id },
      });
      setShowChallengeModal(false);
    } catch (err) {
      console.error('[DuelsScreen] Create duel failed:', err);
    } finally {
      setIsCreating(false);
    }
  }, [player, room, createDuel]);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAccept = useCallback(async (duelId: string) => {
    if (!player || !room) return;
    setActionLoading(duelId);
    setActionError(null);
    try {
      await acceptDuel(duelId);
      const duel = duels.find((d) => d.id === duelId);
      if (duel) {
        await supabase.from('notifications').insert({
          room_id: room.id, player_id: duel.challenger_id, type: 'duel_accepted',
          payload: { challengedName: player.name },
        });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to accept');
      setTimeout(() => setActionError(null), 3000);
    } finally { setActionLoading(null); }
  }, [acceptDuel, player, room, duels]);

  const handleDecline = useCallback(async (duelId: string) => {
    if (!player || !room) return;
    setActionLoading(duelId);
    setActionError(null);
    try {
      await declineDuel(duelId);
      const duel = duels.find((d) => d.id === duelId);
      if (duel) {
        await supabase.from('notifications').insert({
          room_id: room.id, player_id: duel.challenger_id, type: 'duel_declined',
          payload: { challengedName: player.name },
        });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to decline');
      setTimeout(() => setActionError(null), 3000);
    } finally { setActionLoading(null); }
  }, [declineDuel, player, room, duels]);

  const handleStartAnswer = useCallback((duelId: string) => {
    const duel = duels.find((d) => d.id === duelId);
    if (duel) setPlayingDuel(duel);
  }, [duels]);

  const handleDuelComplete = useCallback(async (answers: DuelAnswer[]) => {
    if (!playingDuel || !player) return;
    try {
      await submitDuelAnswers(playingDuel.id, player.id, answers);
    } catch (err) {
      console.error('[DuelsScreen] Submit answers failed:', err);
    }
    setPlayingDuel(null);
  }, [playingDuel, player, submitDuelAnswers]);

  const handleDecision = useCallback(async (duelId: string, decision: DuelDecision) => {
    if (!player) return;
    try { await makeDecision(duelId, player.id, decision); } catch (err) { console.error(err); }
  }, [player, makeDecision]);

  const handleRematch = useCallback(async (duelId: string) => {
    if (!player || !room) return;
    try {
      const rematch = await requestRematch(duelId, player.id, room.id);
      const originalDuel = duels.find((d) => d.id === duelId);
      const opponentId = originalDuel?.challenger_id === player.id
        ? originalDuel?.challenged_id
        : originalDuel?.challenger_id;
      if (opponentId) {
        await supabase.from('notifications').insert({
          room_id: room.id, player_id: opponentId, type: 'duel_challenge',
          payload: { challengerName: player.name + ' (Rematch)', challengerId: player.id },
        });
      }
    } catch (err) { console.error(err); }
  }, [player, room, duels, requestRematch]);

  if (!room || !player) {
    return <div className="flex items-center justify-center h-64"><p className="text-white/50">Loading duels...</p></div>;
  }

  // Playing a duel — show the 3-question screen
  if (playingDuel) {
    return (
      <DuelPlayScreen
        duel={playingDuel}
        playerId={player.id}
        onComplete={handleDuelComplete}
        onCancel={() => setPlayingDuel(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full px-4 py-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="glow-text text-xl font-bold">{'\u2694\uFE0F'} Duels</h2>
          <p className="text-[11px] text-white/30 mt-0.5">
            Declines: {declineInfo.used}/{declineInfo.max} used
          </p>
        </div>
        <Button size="sm" onClick={() => setShowChallengeModal(true)}>Challenge</Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Pending Decisions (steal/double) */}
        {myPendingDecisions.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-euro-gold mb-2 flex items-center gap-2">
              ⏳ Pending Decisions
              <span className="glass rounded-full px-2 py-0.5 text-xs">{myPendingDecisions.length}</span>
            </h3>
            <div className="space-y-3">
              {myPendingDecisions.map((duel) => (
                <DuelResultCard key={duel.id} duel={duel} onDecision={handleDecision} />
              ))}
            </div>
          </section>
        )}

        {/* Incoming Challenges */}
        {receivedPending.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-euro-gold mb-2 flex items-center gap-2">
              📨 Incoming Challenges
              <span className="glass rounded-full px-2 py-0.5 text-xs">{receivedPending.length}</span>
            </h3>
            <div className="space-y-3">
              <AnimatePresence>
                {receivedPending.map((duel) => (
                  <DuelCard key={duel.id} duel={duel} onAccept={handleAccept} onDecline={handleDecline} declineInfo={declineInfo} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Sent Challenges */}
        {sentPending.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-white/50 mb-2 flex items-center gap-2">
              📤 Sent
              <span className="glass rounded-full px-2 py-0.5 text-xs">{sentPending.length}</span>
            </h3>
            <div className="space-y-3">
              {sentPending.map((duel) => {
                const opponent = players.find((p) => p.id === duel.challenged_id);
                return (
                  <motion.div key={duel.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{opponent?.avatar_emoji ?? '?'}</span>
                          <div>
                            <p className="text-sm font-medium text-white">{opponent?.name ?? 'Player'}</p>
                            <p className="text-xs text-white/40">Waiting for response...</p>
                          </div>
                        </div>
                        <Badge variant="gold">Sent</Badge>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Your Turn */}
        {myTurn.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-euro-cyan mb-2 flex items-center gap-2">
              ⚔️ Your Turn
              <span className="glass rounded-full px-2 py-0.5 text-xs">{myTurn.length}</span>
            </h3>
            <div className="space-y-3">
              {myTurn.map((duel) => (
                <DuelCard key={duel.id} duel={duel} onAnswer={handleStartAnswer} />
              ))}
            </div>
          </section>
        )}

        {/* Waiting for Opponent */}
        {waitingForOpponent.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-white/50 mb-2 flex items-center gap-2">
              ⏳ Waiting for Opponent
              <span className="glass rounded-full px-2 py-0.5 text-xs">{waitingForOpponent.length}</span>
            </h3>
            <div className="space-y-3">
              {waitingForOpponent.map((duel) => {
                const isChallenger = duel.challenger_id === player.id;
                const me = players.find((p) => p.id === player.id);
                const opponent = players.find((p) => p.id === (isChallenger ? duel.challenged_id : duel.challenger_id));
                const myScore = isChallenger ? duel.challenger_score : duel.challenged_score;
                return (
                  <motion.div key={duel.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-white/40 font-medium">
                          {duel.is_rematch ? '🔄 Rematch' : '⚔️ Duel'}
                        </span>
                        <Badge variant="purple">Opponent Answering</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <span className="text-2xl">{me?.avatar_emoji ?? '🎤'}</span>
                          <span className="text-sm text-white font-medium">{me?.name ?? 'You'}</span>
                          <span className="text-lg font-bold text-euro-green">{myScore}</span>
                          <span className="text-[10px] text-white/30">Done ✓</span>
                        </div>
                        <div className="flex-shrink-0 px-2 text-center">
                          <span className="text-xs font-extrabold text-white/20">VS</span>
                          <p className="text-[9px] text-white/15">/ 36</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <span className="text-2xl">{opponent?.avatar_emoji ?? '🎤'}</span>
                          <span className="text-sm text-white font-medium">{opponent?.name ?? 'Player'}</span>
                          <span className="text-lg font-bold text-white/30">?</span>
                          <span className="text-[10px] text-white/30 animate-pulse">Answering...</span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Results */}
        {completedDuels.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-white/50 mb-2">🏁 Results</h3>
            <div className="space-y-3">
              {completedDuels.map((duel) => (
                <DuelResultCard
                  key={duel.id}
                  duel={duel}
                  onRematch={handleRematch}
                  hasRematch={hasRematch(duel.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {duels.length === 0 && !isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="text-5xl">{'\u2694\uFE0F'}</div>
            <p className="text-white/50 text-center text-sm max-w-xs">
              No duels yet! Challenge another player to a 3-question battle.
            </p>
            <Button onClick={() => setShowChallengeModal(true)}>Challenge Someone</Button>
          </motion.div>
        )}

        {isLoading && duels.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-8 h-8 border-3 border-white/20 border-t-euro-purple-light rounded-full" />
          </div>
        )}
      </div>

      <ChallengeModal
        open={showChallengeModal}
        onClose={() => setShowChallengeModal(false)}
        onChallenge={handleChallenge}
        isLoading={isCreating}
        duels={duels}
      />
    </div>
  );
}

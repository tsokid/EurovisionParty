import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Shuffle, Trophy, Flame, Crown, Sparkles, ArrowRight, ShieldOff, ListChecks } from 'lucide-react';
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
import type { Duel, DuelAnswer, DuelDecision, Player } from '../../lib/types';

/** Client-side mirror of the DB get_max_declines() function */
function getMaxDeclines(playerCount: number): number {
  if (playerCount <= 5) return 2;
  if (playerCount <= 10) return 3;
  if (playerCount <= 15) return 4;
  return 5;
}

export default function DuelsScreen() {
  const { t } = useTranslation();
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

  const isMine = (d: Duel) => d.challenger_id === player?.id || d.challenged_id === player?.id;

  const completedDuels = duels.filter((d) =>
    isMine(d)
    && (
      (d.status === 'completed' && d.winner_decision !== null)
      || d.status === 'tie'
      || d.status === 'declined'
    )
  ).slice(0, 8);

  // Room-wide history — all terminal duels, including ones I'm not part of.
  const roomHistory = duels.filter((d) =>
    (d.status === 'completed' && d.winner_decision !== null)
    || d.status === 'tie'
    || d.status === 'declined'
  ).slice(0, 20);

  // Check if a rematch already exists for a duel
  const hasRematch = (duelId: string) => duels.some((d) => d.parent_duel_id === duelId);

  // Decline limit info for current player
  const maxDeclines = getMaxDeclines(players.length);
  const declineInfo = { used: player?.decline_count ?? 0, max: maxDeclines };

  // Personal duel stats: wins · current streak · total points won.
  // Streak walks duels newest → oldest and counts consecutive wins.
  const myStats = useMemo(() => {
    if (!player) return { wins: 0, streak: 0, pointsWon: 0 };
    let wins = 0;
    let pointsWon = 0;
    let streak = 0;
    let streakStillCounting = true;
    const finished = duels
      .filter((d) => isMine(d) && (d.status === 'completed' || d.status === 'tie'))
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
    for (const d of finished) {
      const won = d.winner_id === player.id;
      if (won) {
        wins += 1;
        if (d.winner_decision) pointsWon += d.points_transferred ?? 0;
        if (streakStillCounting) streak += 1;
      } else {
        // Tie or loss breaks the streak (but keep counting wins).
        streakStillCounting = false;
      }
    }
    return { wins, streak, pointsWon };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duels, player?.id]);

  // Players I can challenge — active, not me, no live duel in progress
  // with me, no pending challenge sent by me to them.
  const busyPlayerIds = useMemo(() => {
    if (!player) return new Set<string>();
    const ids = new Set<string>();
    for (const d of duels) {
      if (d.status === 'pending' || d.status === 'accepted' || d.status === 'answering') {
        if (d.challenger_id === player.id) ids.add(d.challenged_id);
        if (d.challenged_id === player.id) ids.add(d.challenger_id);
      }
    }
    return ids;
  }, [duels, player]);

  const eligibleOpponents = useMemo(
    () => players.filter((p) => p.is_active && p.id !== player?.id),
    [players, player?.id],
  );

  // Pick a random eligible opponent and challenge them. Falls through
  // to opening the modal if everyone is currently in another duel.
  const handleRandomOpponent = useCallback(async () => {
    if (!player || !room) return;
    const available = eligibleOpponents.filter((p) => !busyPlayerIds.has(p.id));
    if (available.length === 0) {
      setShowChallengeModal(true);
      return;
    }
    const pick = available[Math.floor(Math.random() * available.length)];
    setIsCreating(true);
    try {
      await createDuel(player.id, pick.id, room.id);
      await supabase.from('notifications').insert({
        room_id: room.id, player_id: pick.id, type: 'duel_challenge',
        payload: { challengerName: player.name, challengerId: player.id },
      });
    } catch (err) {
      console.error('[DuelsScreen] Random duel failed:', err);
    } finally {
      setIsCreating(false);
    }
  }, [player, room, eligibleOpponents, busyPlayerIds, createDuel]);

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

  const [, setActionLoading] = useState<string | null>(null);
  const [, setActionError] = useState<string | null>(null);

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
      await requestRematch(duelId, player.id, room.id);
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
    <div className="flex flex-col h-full">
      <div className="flex flex-col flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-2 sm:py-4 gap-5 sm:gap-6">

        {/* HERO HEADER */}
        <section>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-euro-purple/15 border border-euro-purple/40 px-3 py-1 text-xs sm:text-sm font-bold tracking-[0.16em] text-euro-purple-light">
              <Swords className="w-3.5 h-3.5" strokeWidth={2.4} />
              {t('duels.arenaPill')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/10 px-3 py-1 text-xs sm:text-sm font-semibold tracking-wide text-white/60">
              <ShieldOff className="w-3.5 h-3.5" strokeWidth={2.4} />
              {t('duels.declinesShort', { used: declineInfo.used, max: declineInfo.max })}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-white">
            {t('duels.heroTitleStart')}{' '}
            <span className="bg-gradient-to-r from-euro-purple-light via-euro-pink to-euro-cyan bg-clip-text text-transparent">
              {t('duels.heroTitleAccent')}
            </span>
            .
            <br />
            {t('duels.heroTitleEnd')}
          </h2>
          <p className="text-white/65 text-sm sm:text-base mt-2 max-w-xl leading-relaxed">
            {t('duels.heroSubtitle')}
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Button onClick={() => setShowChallengeModal(true)}>
              <Sparkles className="w-4 h-4" strokeWidth={2.4} />
              {t('duels.newChallengeBtn')}
              <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
            </Button>
            <Button variant="secondary" onClick={handleRandomOpponent} disabled={isCreating}>
              <Shuffle className="w-4 h-4" strokeWidth={2.4} />
              {t('duels.randomOpponentBtn')}
            </Button>
          </div>
        </section>

        {/* PERSONAL STATS ROW */}
        <Card className="py-3 sm:py-4">
          <div className="grid grid-cols-3 divide-x divide-white/8">
            <div className="px-3 sm:px-4 flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-euro-purple/20 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-euro-purple-light" strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold tracking-wide text-white/55 uppercase">{t('duels.statWins')}</p>
                <p className="text-xl sm:text-2xl font-extrabold text-white tabular-nums leading-tight">{myStats.wins}</p>
              </div>
            </div>
            <div className="px-3 sm:px-4 flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold tracking-wide text-white/55 uppercase">{t('duels.statStreak')}</p>
                <p className="text-xl sm:text-2xl font-extrabold text-white tabular-nums leading-tight">{myStats.streak}</p>
              </div>
            </div>
            <div className="px-3 sm:px-4 flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-euro-gold/15 flex items-center justify-center shrink-0">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-euro-gold" strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold tracking-wide text-white/55 uppercase">{t('duels.statPointsWon')}</p>
                <p className="text-xl sm:text-2xl font-extrabold text-white tabular-nums leading-tight">{myStats.pointsWon}</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex-1 space-y-5 sm:space-y-6">
        {/* Pending Decisions (steal/double) */}
        {myPendingDecisions.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-euro-gold mb-2 flex items-center gap-2">
              {t('duels.pendingDecisions')}
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
              {t('duels.incomingChallenges')}
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
              {t('duels.sentChallenges')}
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
                            <p className="text-xs text-white/40">{t('duels.waitingResponse')}</p>
                          </div>
                        </div>
                        <Badge variant="gold">{t('duels.sentChallenges')}</Badge>
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
              {t('duels.yourTurn')}
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
              {t('duels.waitingOpponent')}
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
                          {duel.is_rematch ? t('duelResult.rematchLabel') : t('duelResult.duelLabel')}
                        </span>
                        <Badge variant="purple">{t('duels.opponentAnswering')}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <span className="text-2xl">{me?.avatar_emoji ?? '🎤'}</span>
                          <span className="text-sm text-white font-medium">{me?.name ?? 'You'}</span>
                          <span className="text-lg font-bold text-euro-green">{myScore}</span>
                          <span className="text-[10px] text-white/30">{t('duels.doneCheck')}</span>
                        </div>
                        <div className="flex-shrink-0 px-2 text-center">
                          <span className="text-xs font-extrabold text-white/20">VS</span>
                          <p className="text-[10px] text-white/15">/ 36</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <span className="text-2xl">{opponent?.avatar_emoji ?? '🎤'}</span>
                          <span className="text-sm text-white font-medium">{opponent?.name ?? 'Player'}</span>
                          <span className="text-lg font-bold text-white/30">?</span>
                          <span className="text-[10px] text-white/30 animate-pulse">{t('duels.answering')}</span>
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
            <h3 className="text-sm font-semibold text-white/50 mb-2">{t('duels.resultsSection')}</h3>
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

        {/* Room History — all duels in this room, even ones I'm not part of */}
        {roomHistory.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-white/50 mb-2 flex items-center gap-2">
              {t('duels.roomHistory')}
              <span className="glass rounded-full px-2 py-0.5 text-xs">{roomHistory.length}</span>
            </h3>
            <Card className="py-2">
              <ul className="divide-y divide-white/5">
                {roomHistory.map((duel) => {
                  const challenger = players.find((p) => p.id === duel.challenger_id);
                  const challenged = players.find((p) => p.id === duel.challenged_id);
                  const cName = challenger?.name ?? '—';
                  const dName = challenged?.name ?? '—';
                  const cEmoji = challenger?.avatar_emoji ?? '🎤';
                  const dEmoji = challenged?.avatar_emoji ?? '🎤';
                  const cWon = duel.winner_id === duel.challenger_id;
                  const dWon = duel.winner_id === duel.challenged_id;

                  let outcomeNode: ReactNode;
                  if (duel.status === 'declined') {
                    outcomeNode = (
                      <span className="text-xs font-semibold text-white/55">
                        {t('duels.declinedRow')}
                      </span>
                    );
                  } else if (duel.status === 'tie') {
                    outcomeNode = (
                      <span className="text-xs font-semibold text-white/70">
                        {t('duels.tieRow')}
                      </span>
                    );
                  } else if (duel.winner_decision === 'steal') {
                    outcomeNode = (
                      <span className="text-xs font-bold text-euro-gold">
                        {t('duels.stoleAmount', { amount: duel.points_transferred ?? 0 })}
                      </span>
                    );
                  } else if (duel.winner_decision === 'double') {
                    outcomeNode = (
                      <span className="text-xs font-bold text-euro-gold">
                        {t('duels.doubledAmount', { amount: duel.points_transferred ?? 0 })}
                      </span>
                    );
                  } else if (duel.status === 'completed') {
                    outcomeNode = (
                      <span className="text-xs font-semibold text-white/50">
                        {t('duels.wonNoDecision')}
                      </span>
                    );
                  } else {
                    outcomeNode = null;
                  }

                  const showScore = duel.status === 'completed' || duel.status === 'tie';

                  return (
                    <li key={duel.id} className="flex items-center gap-2 py-2 px-1 text-sm">
                      {/* Challenger */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                        <span className={`truncate font-medium ${cWon ? 'text-euro-green' : 'text-white/85'}`}>
                          {cName}
                        </span>
                        <span className="text-base leading-none shrink-0" aria-hidden>{cEmoji}</span>
                      </div>

                      {/* Score / vs */}
                      <div className="shrink-0 text-center min-w-[68px]">
                        {showScore ? (
                          <span className="text-sm font-bold tabular-nums text-white">
                            <span className={cWon ? 'text-euro-green' : ''}>{duel.challenger_score ?? 0}</span>
                            <span className="text-white/30 mx-1">–</span>
                            <span className={dWon ? 'text-euro-green' : ''}>{duel.challenged_score ?? 0}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-white/40 italic">{t('duels.vsLabel')}</span>
                        )}
                      </div>

                      {/* Challenged */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-base leading-none shrink-0" aria-hidden>{dEmoji}</span>
                        <span className={`truncate font-medium ${dWon ? 'text-euro-green' : 'text-white/85'}`}>
                          {dName}
                        </span>
                      </div>

                      {/* Outcome */}
                      <div className="shrink-0 text-right min-w-[120px]">
                        {outcomeNode}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        )}

        {/* Empty state \u2014 "Be the first to strike" big card */}
        {duels.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="py-7 sm:py-9 px-4 sm:px-6 text-center">
              {/* Glowing icon */}
              <div className="flex justify-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 12, delay: 0.05 }}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-euro-purple to-euro-cyan flex items-center justify-center shadow-[0_0_36px_rgba(139,92,246,0.55)]"
                >
                  <Swords className="w-8 h-8 sm:w-10 sm:h-10 text-white" strokeWidth={2.4} />
                </motion.div>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/12 px-3 py-1 text-xs sm:text-sm font-bold tracking-[0.16em] text-euro-pink">
                <span className="w-1.5 h-1.5 rounded-full bg-euro-pink animate-pulse" aria-hidden />
                {t('duels.arenaAwaitsPill')}
              </span>
              <h3 className="mt-3 text-2xl sm:text-3xl font-extrabold text-white">
                {t('duels.beFirstStart')}{' '}
                <span className="bg-gradient-to-r from-euro-purple-light via-euro-pink to-euro-cyan bg-clip-text text-transparent">
                  {t('duels.beFirstAccent')}
                </span>
                .
              </h3>
              <p className="text-white/65 text-sm sm:text-base mt-2 max-w-md mx-auto">
                {t('duels.beFirstSub', { code: room.code ?? '\u2014' })}
              </p>
              <div className="flex flex-wrap justify-center gap-3 mt-5">
                <Button onClick={() => setShowChallengeModal(true)}>
                  <Sparkles className="w-4 h-4" strokeWidth={2.4} />
                  {t('duels.challengePlayer')}
                  <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
                </Button>
                <Button variant="secondary" onClick={handleRandomOpponent} disabled={isCreating}>
                  <Shuffle className="w-4 h-4" strokeWidth={2.4} />
                  {t('duels.randomRival')}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* PLAYERS IN THE ROOM \u2014 inline grid with per-player Challenge button */}
        {eligibleOpponents.length > 0 && (
          <section>
            <h3 className="text-sm font-bold tracking-[0.14em] text-white/55 mb-2 flex items-center gap-2 uppercase">
              <Crown className="w-4 h-4 text-euro-gold" strokeWidth={2.4} />
              {t('duels.playersInRoom')}
              <span className="glass rounded-full px-2 py-0.5 text-xs">{eligibleOpponents.length}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {eligibleOpponents.map((p: Player) => {
                const isBusy = busyPlayerIds.has(p.id);
                const initial = p.name?.charAt(0)?.toUpperCase() ?? '?';
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/8 px-3 py-2.5"
                  >
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-euro-purple/40 to-euro-pink/30 flex items-center justify-center shrink-0 text-base sm:text-lg font-bold text-white">
                      {p.avatar_emoji ?? initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-bold text-white truncate">{p.name}</p>
                      <p className="text-xs sm:text-sm text-white/55 mt-0.5 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isBusy ? 'bg-euro-gold' : 'bg-euro-green'}`} aria-hidden />
                        {isBusy ? t('duels.playerInQuiz') : t('duels.playerReady')}
                        <span className="w-1 h-1 rounded-full bg-white/25 mx-0.5" aria-hidden />
                        <span className="text-white/65 tabular-nums">{p.quiz_points ?? 0} {t('duels.ptsSuffix')}</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={isBusy ? 'secondary' : 'primary'}
                      onClick={() => handleChallenge(p.id)}
                      disabled={isBusy || isCreating}
                    >
                      <Swords className="w-3.5 h-3.5" strokeWidth={2.4} />
                      {t('duels.playerActionChallenge')}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* HOW DUELS WORK */}
        <section>
          <h3 className="text-sm font-bold tracking-[0.14em] text-white/55 mb-2 flex items-center gap-2 uppercase">
            <Sparkles className="w-4 h-4 text-euro-purple-light" strokeWidth={2.4} />
            {t('duels.howDuelsWorkTitle')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-euro-purple/20 flex items-center justify-center mb-2">
                <Swords className="w-4 h-4 text-euro-purple-light" strokeWidth={2.4} />
              </div>
              <p className="text-sm sm:text-base font-bold text-white">{t('duels.howDuelsPickTitle')}</p>
              <p className="text-xs sm:text-sm text-white/55 mt-1 leading-snug">
                {t('duels.howDuelsPickCopy')}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-euro-cyan/20 flex items-center justify-center mb-2">
                <ListChecks className="w-4 h-4 text-euro-cyan" strokeWidth={2.4} />
              </div>
              <p className="text-sm sm:text-base font-bold text-white">{t('duels.howDuelsQuestionsTitle')}</p>
              <p className="text-xs sm:text-sm text-white/55 mt-1 leading-snug">
                {t('duels.howDuelsQuestionsCopy')}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-euro-gold/15 flex items-center justify-center mb-2">
                <Trophy className="w-4 h-4 text-euro-gold" strokeWidth={2.4} />
              </div>
              <p className="text-sm sm:text-base font-bold text-white">{t('duels.howDuelsRewardTitle')}</p>
              <p className="text-xs sm:text-sm text-white/55 mt-1 leading-snug">
                {t('duels.howDuelsRewardCopy')}
              </p>
            </div>
          </div>
        </section>

        {isLoading && duels.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-8 h-8 border-3 border-white/20 border-t-euro-purple-light rounded-full" />
          </div>
        )}
        </div>
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

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Swords, Shuffle, Sparkles, ListChecks, Trophy } from 'lucide-react';
import { useDuels } from '../../hooks/useDuels';
import { useGameStore } from '../../stores/gameStore';
import { supabase } from '../../lib/supabase';
import { duelOutcome } from '../../lib/answerPoints';
import { PlayerAvatar, Stat } from '../stage';
import DuelCard from './DuelCard';
import DuelPlayScreen from './DuelPlayScreen';
import DuelResultCard from './DuelResultCard';
import DuelResultMoment from './DuelResultMoment';
import ChallengeModal from './ChallengeModal';
import type { Duel, DuelAnswer, DuelDecision, Player } from '../../lib/types';

/** Duel results this browser has already played as a moment, per room. */
const revealKey = (roomId: string) => `stage-duel-reveal:${roomId}`;
function readRevealed(roomId: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(revealKey(roomId));
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch { return null; }
}
function writeRevealed(roomId: string, ids: Set<string>) {
  try { localStorage.setItem(revealKey(roomId), JSON.stringify([...ids])); } catch { /* private mode */ }
}

/** Client-side mirror of the DB get_max_declines() function */
function getMaxDeclines(playerCount: number): number {
  if (playerCount <= 5) return 2;
  if (playerCount <= 10) return 3;
  if (playerCount <= 15) return 4;
  return 5;
}

export default function DuelsScreen() {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const { room, player, players } = useGameStore();
  const {
    duels, pendingDuels, activeDuels, pendingDecisions,
    createDuel, acceptDuel, declineDuel, submitDuelAnswers,
    makeDecision, requestRematch, fetchPlayerDuels, isLoading,
  } = useDuels(room?.id);

  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [playingDuel, setPlayingDuel] = useState<Duel | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [momentId, setMomentId] = useState<string | null>(null);

  useEffect(() => {
    if (player?.id) void fetchPlayerDuels(player.id).then(() => setLoaded(true));
  }, [player?.id, fetchPlayerDuels]);

  // Tier-1 duel result (motion map #4): plays when a duel of mine reaches a
  // result in the duel rows (realtime / refetch), once per browser. On the
  // first visit to a room, results already there are marked as seen.
  useEffect(() => {
    if (!loaded || !room || !player || momentId) return;
    const finished = duels.filter((d) =>
      (d.challenger_id === player.id || d.challenged_id === player.id)
      && ((d.status === 'completed' && !!d.winner_id) || d.status === 'tie'));
    const seen = readRevealed(room.id);
    if (seen === null) {
      writeRevealed(room.id, new Set(finished.map((d) => d.id)));
      return;
    }
    const next = finished.find((d) => !seen.has(d.id));
    if (!next) return;
    seen.add(next.id);
    writeRevealed(room.id, seen);
    setMomentId(next.id);
  }, [loaded, duels, room, player, momentId]);

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
      // ISO timestamps: plain string comparison orders them; newest first.
      .sort((a, b) => {
        const x = b.completed_at ?? '';
        const y = a.completed_at ?? '';
        return x < y ? -1 : x > y ? 1 : 0;
      });
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
    return <div className="du-loading"><p className="t-meta">{t('common.loading')}</p></div>;
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

  const momentDuel = momentId ? duels.find((d) => d.id === momentId) : undefined;
  const sectionHead = (label: string, count: number, tone?: 'gold' | 'live') => (
    <h2 className={clsx('du-sec-h', tone)}>
      {label}
      <span className="du-count">{count}</span>
    </h2>
  );

  return (
    <div className="du-screen">
      <div className="du-head">
        <h1 className="t-h2">{t('duels.screenTitle')}</h1>
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleRandomOpponent} disabled={isCreating}>
          <Shuffle aria-hidden="true" strokeWidth={2.4} />
          {t('duels.randomOpponentBtn')}
        </button>
      </div>
      <p className="t-meta du-sub">{t('duels.heroSubtitle')}</p>

      <div className="du-stats">
        <Stat value={myStats.wins} label={t('duels.statWins')} />
        <Stat value={myStats.streak} label={t('duels.statStreak')} />
        <Stat value={myStats.pointsWon > 0 ? `+${myStats.pointsWon}` : '0'} label={t('duels.statPointsWon')} accent="gold" />
      </div>

      <div className="du-cols">
        <div className="du-main">
          {myPendingDecisions.length > 0 && (
            <section className="du-sec">
              {sectionHead(t('duels.pendingDecisions'), myPendingDecisions.length, 'gold')}
              {myPendingDecisions.map((duel) => (
                <DuelResultCard key={duel.id} duel={duel} onDecision={handleDecision} onOpen={setMomentId} />
              ))}
            </section>
          )}

          {receivedPending.length > 0 && (
            <section className="du-sec">
              {sectionHead(t('duels.incomingChallenges'), receivedPending.length, 'gold')}
              <AnimatePresence>
                {receivedPending.map((duel) => (
                  <DuelCard key={duel.id} duel={duel} onAccept={handleAccept} onDecline={handleDecline} declineInfo={declineInfo} />
                ))}
              </AnimatePresence>
            </section>
          )}

          {myTurn.length > 0 && (
            <section className="du-sec">
              {sectionHead(t('duels.yourTurn'), myTurn.length, 'live')}
              {myTurn.map((duel) => (
                <DuelCard key={duel.id} duel={duel} onAnswer={handleStartAnswer} />
              ))}
            </section>
          )}

          {(sentPending.length > 0 || waitingForOpponent.length > 0) && (
            <section className="du-sec">
              {sectionHead(t('duels.inProgress'), sentPending.length + waitingForOpponent.length)}
              <div className="card du-list">
                {sentPending.map((duel) => {
                  const opponent = players.find((p) => p.id === duel.challenged_id);
                  return (
                    <div key={duel.id} className="du-li">
                      <PlayerAvatar name={opponent?.name ?? '—'} avatarId={opponent?.avatar_id} />
                      <div className="du-li-who">
                        <p className="du-li-name">{t('duelResult.duelWith', { name: opponent?.name ?? '—' })}</p>
                        <p className="t-meta">{t('duels.waitingResponse')}</p>
                      </div>
                      <span className="du-mk wait">{t('duels.sentBadge')}</span>
                    </div>
                  );
                })}
                {waitingForOpponent.map((duel) => {
                  const isChallenger = duel.challenger_id === player.id;
                  const opponent = players.find((p) => p.id === (isChallenger ? duel.challenged_id : duel.challenger_id));
                  const myScore = isChallenger ? duel.challenger_score : duel.challenged_score;
                  return (
                    <div key={duel.id} className="du-li">
                      <PlayerAvatar name={opponent?.name ?? '—'} avatarId={opponent?.avatar_id} />
                      <div className="du-li-who">
                        <p className="du-li-name">{t('duelResult.duelWith', { name: opponent?.name ?? '—' })}</p>
                        <p className="t-meta">{t('duels.otherAnswering')}</p>
                      </div>
                      <div className="du-li-score">
                        <span className="num">{myScore}–?</span>
                        <span className="t-meta">{t('duels.doneCheck')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {completedDuels.length > 0 && (
            <section className="du-sec">
              {sectionHead(t('duels.resultsSection'), completedDuels.length)}
              {completedDuels.map((duel) => (
                <DuelResultCard key={duel.id} duel={duel} onRematch={handleRematch} hasRematch={hasRematch(duel.id)} onOpen={setMomentId} />
              ))}
            </section>
          )}

          {duels.length === 0 && !isLoading && (
            <motion.section className="card-hero du-empty" initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}>
              <span className="du-empty-ico" aria-hidden="true"><Swords strokeWidth={2.4} /></span>
              <span className="chip chip-pink"><span className="dot" />{t('duels.arenaAwaitsPill')}</span>
              <h2 className="t-h3">{t('duels.emptyTitle')}</h2>
              <p className="t-meta">{t('duels.beFirstSub', { code: room.code ?? '—' })}</p>
              <div className="du-empty-actions">
                <button type="button" className="btn btn-primary" onClick={() => setShowChallengeModal(true)}>
                  <Sparkles aria-hidden="true" strokeWidth={2.4} />
                  {t('duels.challengePlayer')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleRandomOpponent} disabled={isCreating}>
                  <Shuffle aria-hidden="true" strokeWidth={2.4} />
                  {t('duels.randomRival')}
                </button>
              </div>
            </motion.section>
          )}

          {isLoading && duels.length === 0 && (
            <div className="du-loading"><span className="t-meta">{t('common.loading')}</span></div>
          )}
        </div>

        <aside className="du-side">
          {eligibleOpponents.length > 0 && (
            <section className="du-sec">
              {sectionHead(t('duels.playersInRoom'), eligibleOpponents.length)}
              <div className="card du-list">
                {eligibleOpponents.map((p: Player) => {
                  const isBusy = busyPlayerIds.has(p.id);
                  return (
                    <div key={p.id} className="du-li">
                      <PlayerAvatar name={p.name} avatarId={p.avatar_id} />
                      <div className="du-li-who">
                        <p className="du-li-name">{p.name}</p>
                        <p className="t-meta du-li-state">
                          <span className={clsx('dot', isBusy ? 'busy' : 'ready')} aria-hidden="true" />
                          {isBusy ? t('duels.playerInDuel') : t('duels.playerReady')}
                          {' · '}
                          {t('game.points', { count: p.total_points ?? 0 })}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={clsx('btn btn-sm', isBusy ? 'btn-ghost' : 'btn-secondary')}
                        onClick={() => handleChallenge(p.id)}
                        disabled={isBusy || isCreating}
                      >
                        {t('duels.playerActionChallenge')}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="btn btn-primary btn-block" onClick={() => setShowChallengeModal(true)}>
                <Sparkles aria-hidden="true" strokeWidth={2.4} />
                {t('duels.newChallengeBtn')}
              </button>
            </section>
          )}

          {roomHistory.length > 0 && (
            <section className="du-sec">
              {sectionHead(t('duels.roomHistory'), roomHistory.length)}
              <div className="card du-list">
                {roomHistory.map((duel) => {
                  const mine = isMine(duel);
                  const c = players.find((p) => p.id === duel.challenger_id);
                  const d = players.find((p) => p.id === duel.challenged_id);
                  const meIsC = duel.challenger_id === player.id;
                  const other = mine ? (meIsC ? d : c) : null;
                  const out = mine ? duelOutcome(duel, player.id) : null;
                  const pts = duel.points_transferred ?? 0;
                  const winnerName = players.find((p) => p.id === duel.winner_id)?.name ?? '—';
                  let note: string;
                  if (duel.status === 'declined') note = t('duels.declinedRow');
                  else if (duel.status === 'tie') note = t('duels.tieRow');
                  else if (duel.winner_decision === 'steal') note = t('duels.stoleRow', { amount: pts, name: winnerName });
                  else if (duel.winner_decision === 'double') note = t('duels.doubledRow', { amount: pts, name: winnerName });
                  else note = t('duels.wonNoDecision');
                  const myScore = meIsC ? duel.challenger_score : duel.challenged_score;
                  const opScore = meIsC ? duel.challenged_score : duel.challenger_score;
                  return (
                    <div key={duel.id} className={clsx('du-li du-hist', out ?? 'other')}>
                      <span className="du-hist-bar" aria-hidden="true" />
                      {mine
                        ? <PlayerAvatar name={other?.name ?? '—'} avatarId={other?.avatar_id} size="sm" />
                        : (
                          <span className="du-hist-pair">
                            <PlayerAvatar name={c?.name ?? '—'} avatarId={c?.avatar_id} size="sm" />
                            <PlayerAvatar name={d?.name ?? '—'} avatarId={d?.avatar_id} size="sm" />
                          </span>
                        )}
                      <div className="du-li-who">
                        <p className="du-li-name">
                          {mine ? t('duelResult.duelWith', { name: other?.name ?? '—' }) : `${c?.name ?? '—'} · ${d?.name ?? '—'}`}
                        </p>
                        <p className="t-meta">{note}</p>
                      </div>
                      {duel.status !== 'declined' && (
                        <div className="du-li-score">
                          <span className="num">{mine ? `${myScore ?? 0}–${opScore ?? 0}` : `${duel.challenger_score ?? 0}–${duel.challenged_score ?? 0}`}</span>
                          {out && out !== 'open' && (
                            <span className={clsx('du-li-out', out)}>
                              {out === 'win' ? t('duelResult.won') : out === 'lose' ? t('duelResult.lost') : t('duelResult.tie')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="du-sec">
            <h2 className="du-sec-h">{t('duels.howDuelsWorkTitle')}</h2>
            <div className="du-how">
              <div className="card du-how-i"><Swords aria-hidden="true" strokeWidth={2.4} /><p className="du-li-name">{t('duels.howDuelsPickTitle')}</p><p className="t-meta">{t('duels.howDuelsPickCopy')}</p></div>
              <div className="card du-how-i"><ListChecks aria-hidden="true" strokeWidth={2.4} /><p className="du-li-name">{t('duels.howDuelsQuestionsTitle')}</p><p className="t-meta">{t('duels.howDuelsQuestionsCopy')}</p></div>
              <div className="card du-how-i"><Trophy aria-hidden="true" strokeWidth={2.4} /><p className="du-li-name">{t('duels.howDuelsRewardTitle')}</p><p className="t-meta">{t('duels.howDuelsRewardCopy')}</p></div>
            </div>
          </section>
        </aside>
      </div>

      <ChallengeModal
        open={showChallengeModal}
        onClose={() => setShowChallengeModal(false)}
        onChallenge={handleChallenge}
        isLoading={isCreating}
        duels={duels}
      />

      {momentDuel && (
        <DuelResultMoment duel={momentDuel} onClose={() => setMomentId(null)} onDecision={handleDecision} />
      )}
    </div>
  );
}

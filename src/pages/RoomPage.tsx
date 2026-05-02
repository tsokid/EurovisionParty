import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { useRoom } from '../hooks/useRoom';
import { useRejoin } from '../hooks/useRejoin';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useNotifications } from '../hooks/useNotifications';
import { supabase } from '../lib/supabase';
import { playIntro } from '../lib/audio';
import type { Room } from '../lib/types';
import AppShell from '../components/layout/AppShell';
import LobbyScreen from '../components/lobby/LobbyScreen';
import QuizScreen from '../components/quiz/QuizScreen';
import PredictionsScreen from '../components/predictions/PredictionsScreen';
import DuelsScreen from '../components/duels/DuelsScreen';
import IntelMarket from '../components/intel/IntelMarket';
import VotingLiveScreen from '../components/results/VotingLiveScreen';
import LeaderboardScreen from '../components/leaderboard/LeaderboardScreen';
import WinnerCrown from '../components/leaderboard/WinnerCrown';
import WinnersScreen from '../components/winners/WinnersScreen';
import ExitGameModal from '../components/room/ExitGameModal';
import ExitChoiceModal from '../components/room/ExitChoiceModal';
import RoomIntroOverlay from '../components/room/RoomIntroOverlay';

const INTRO_SEEN_KEY = (code: string) => `eurovision-games-intro-seen-${code}`;

export function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { room, advancePhase, refetchRoom, leaveRoom } = useRoom();
  const { room: storeRoom, player, players, activeTab, setActiveTab, setRoom, isReconnecting } = useGameStore();
  const [showWinner, setShowWinner] = useState(true);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showPredictionsOpenBanner, setShowPredictionsOpenBanner] = useState(false);

  // Defense-in-depth: emit noindex,nofollow so even if a room URL leaks
  // into a backlink or sitemap, search engines won't index the live game
  // (player names, room code, share password). robots.txt also disallows
  // /room/ but the meta tag handles bots that ignore robots.txt.
  useEffect(() => {
    let m = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const created = !m;
    if (!m) {
      m = document.createElement('meta');
      m.name = 'robots';
      document.head.appendChild(m);
    }
    const prev = m.content;
    m.content = 'noindex,nofollow';
    return () => {
      if (m && created) m.remove();
      else if (m) m.content = prev;
    };
  }, []);

  // Intro curtain — shown once per room (localStorage-gated). Defaults to ON
  // for any room code we haven't yet flagged as "seen".
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === 'undefined' || !roomCode) return false;
    return localStorage.getItem(INTRO_SEEN_KEY(roomCode.toUpperCase())) !== '1';
  });
  const dismissIntro = () => {
    if (roomCode) {
      try { localStorage.setItem(INTRO_SEEN_KEY(roomCode.toUpperCase()), '1'); } catch { /* ignore */ }
    }
    setShowIntro(false);
  };

  // Try to rejoin from DB if store is empty (e.g. page refresh)
  const { status: rejoinStatus } = useRejoin(roomCode);

  // Subscribe to leaderboard and notifications when in a room
  const roomId = storeRoom?.id ?? '';
  const playerId = player?.id ?? '';
  const { refetchPlayers } = useLeaderboard(roomId);
  const { refetchNotifications } = useNotifications(playerId);

  // Heartbeat: update last_seen_at every 5 minutes (for ghost cleanup)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playerId) return;
    heartbeatRef.current = setInterval(() => {
      supabase.from('players').update({ last_seen_at: new Date().toISOString() }).eq('id', playerId).then(() => {});
    }, 5 * 60 * 1000); // every 5 min
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [playerId]);

  // Play Eurovision intro once when the game enters the 'final' phase
  const finalPlayedRef = useRef(false);
  useEffect(() => {
    if (storeRoom?.phase === 'final' && !finalPlayedRef.current) {
      finalPlayedRef.current = true;
      playIntro();
    }
    if (storeRoom?.phase !== 'final') {
      finalPlayedRef.current = false; // allow replay if game restarts
    }
  }, [storeRoom?.phase]);

  // Polling fallback: check room phase every 3 s while in lobby or pre_night.
  // Covers Realtime lag/drop for all users — critical for the participants-parser
  // → predictions_open transition which not all clients receive via Realtime.
  const currentPhase = storeRoom?.phase;
  useEffect(() => {
    if (!storeRoom || (currentPhase !== 'lobby' && currentPhase !== 'pre_night')) return;
    const id = setInterval(async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', storeRoom.id)
        .single();
      if (data && (data as Room).phase !== currentPhase) {
        setRoom(data as Room);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [storeRoom?.id, currentPhase, setRoom]);

  // When the phase transitions from pre_night → predictions_open, auto-switch
  // the active tab and show a prominent banner so no user misses it.
  const prevPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    const phase = storeRoom?.phase;
    if (!phase) return;
    if (prevPhaseRef.current === 'pre_night' && phase === 'predictions_open') {
      setActiveTab('predictions');
      setShowPredictionsOpenBanner(true);
    }
    prevPhaseRef.current = phase;
  }, [storeRoom?.phase, setActiveTab]);

  // Catch-up fetch: when isReconnecting transitions true→false, refetch all state
  const prevReconnectingRef = useRef(false);
  useEffect(() => {
    if (prevReconnectingRef.current && !isReconnecting) {
      Promise.all([refetchRoom(), refetchPlayers(), refetchNotifications()]);
    }
    prevReconnectingRef.current = isReconnecting;
  }, [isReconnecting, refetchRoom, refetchPlayers, refetchNotifications]);

  // Redirect based on rejoin status
  useEffect(() => {
    if (rejoinStatus === 'no-auth' || rejoinStatus === 'no-room') {
      navigate('/', { replace: true });
    } else if (rejoinStatus === 'not-member') {
      // Redirect to join form with room code pre-filled
      navigate(`/?join=${roomCode}`, { replace: true });
    } else if (rejoinStatus === 'expired') {
      navigate('/', { replace: true });
    }
  }, [rejoinStatus, roomCode, navigate]);

  const currentRoom = storeRoom ?? room;

  // First-entry intro curtain — overlays everything (including the "Joining…"
  // splash) so the user sees the show-style intro the moment they arrive.
  if (showIntro) {
    return <RoomIntroOverlay onDismiss={dismissIntro} />;
  }

  if (!currentRoom || !player) {
    return (
      <div className="min-h-svh bg-euro-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl animate-float mb-4">🎤</div>
          <p className="text-white/60">Joining room {roomCode}...</p>
        </div>
      </div>
    );
  }

  // Lobby phase — no nav needed
  if (currentRoom.phase === 'lobby') {
    return (
      <AppShell showHeader={false} showNav={false}>
        <LobbyScreen onAdvancePhase={async () => { if (currentRoom) await advancePhase(currentRoom.id); }} />
      </AppShell>
    );
  }

  // Final phase — always show full WinnersScreen; WinnerCrown is a brief overlay on top.
  // When the top score is shared, render the tie variant of the crown so we
  // never falsely announce a winner before the tiebreak resolves.
  if (currentRoom.phase === 'final') {
    const playerNameById = Object.fromEntries(players.map((p) => [p.id, p.name]));
    const isHost = !!player?.is_host;
    const sortedPlayers = [...players].sort((a, b) => b.total_points - a.total_points);
    const topScore   = sortedPlayers[0]?.total_points ?? 0;
    const tiedAtTop  = sortedPlayers.filter((p) => p.total_points === topScore && topScore > 0);
    const isTopTied  = tiedAtTop.length >= 2;
    return (
      <AppShell showHeader showNav={false}>
        <WinnersScreen roomId={currentRoom.id} isHost={isHost} playerNameById={playerNameById} />
        <WinnerCrown
          winner={isTopTied ? null : sortedPlayers[0] ?? null}
          visible={showWinner}
          onDismiss={() => setShowWinner(false)}
          isTied={isTopTied}
          tiedNames={isTopTied ? tiedAtTop.map((p) => p.name) : []}
          tiedScore={isTopTied ? topScore : 0}
        />
      </AppShell>
    );
  }

  // Active game phases — show tabbed content
  const phase = currentRoom.phase as string;
  // Phase-locking is enforced both in BottomNav (button disabled) and
  // here (deep-link / stale-state defence). If the player has a tab
  // active that just got locked by a phase change, fall back to the
  // leaderboard instead of rendering the wrong screen.
  const quizDuelsLocked = phase === 'voting_live' || phase === 'final';
  const predictionsLocked = phase === 'lobby' || phase === 'pre_night';

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'quiz':
        return quizDuelsLocked ? <LeaderboardScreen /> : <QuizScreen />;
      case 'duels':
        return quizDuelsLocked ? <LeaderboardScreen /> : <DuelsScreen />;
      case 'predictions':
        if (phase === 'voting_live') {
          return <VotingLiveScreen />;
        }
        if (phase === 'final') return <LeaderboardScreen />;
        return predictionsLocked ? <LeaderboardScreen /> : <PredictionsScreen />;
      case 'intel':
        return <IntelMarket />;
      case 'leaderboard':
        return <LeaderboardScreen />;
      default:
        return <QuizScreen />;
    }
  };

  return (
    <>
      <AppShell
        showHeader
        showNav
        phase={currentRoom.phase}
        onExitPress={() => setShowChoiceModal(true)}
      >
        {renderActiveTab()}
      </AppShell>

      {/* Predictions-open announcement — fires once when parser unlocks predictions */}
      {showPredictionsOpenBanner && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ background: 'rgba(10,5,25,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowPredictionsOpenBanner(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-euro-pink/30 p-8 text-center shadow-[0_0_80px_rgba(236,72,153,0.35)]"
            style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.4),rgba(236,72,153,0.3))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl mb-4">🎯</div>
            <h2 className="text-2xl font-extrabold text-white mb-2">Predictions are open!</h2>
            <p className="text-white/70 text-sm leading-relaxed mb-6">
              The Grand Final lineup is set. Pick your favourites and least favourites before voting starts!
            </p>
            <button
              onClick={() => setShowPredictionsOpenBanner(false)}
              className="w-full py-3 rounded-xl font-bold text-white"
              style={{ background: 'linear-gradient(90deg,#7c3aed,#ec4899)' }}
            >
              Make my predictions →
            </button>
          </div>
        </div>
      )}

      {/* Exit choice: Visit Other Rooms OR Exit Game */}
      {showChoiceModal && (
        <ExitChoiceModal
          onVisitOtherRooms={async () => {
            setShowChoiceModal(false);
            await leaveRoom('away');
            navigate('/', { replace: true });
          }}
          onExitGame={() => {
            setShowChoiceModal(false);
            setShowExitModal(true);
          }}
          onCancel={() => setShowChoiceModal(false)}
        />
      )}

      {/* Exit Game confirmation */}
      {showExitModal && (
        <ExitGameModal
          onConfirm={async () => {
            setShowExitModal(false);
            await leaveRoom('exit');
            navigate('/', { replace: true });
          }}
          onCancel={() => setShowExitModal(false)}
        />
      )}
    </>
  );
}

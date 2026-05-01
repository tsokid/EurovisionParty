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
import ResultsEntry from '../components/results/ResultsEntry';
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
  const { room: storeRoom, player, players, activeTab, setRoom, isReconnecting } = useGameStore();
  const [showWinner, setShowWinner] = useState(true);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

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

  // Polling fallback: check room phase every 3 s while in lobby
  // Covers the case where Realtime lags or drops (all users, not just host)
  const currentPhase = storeRoom?.phase;
  useEffect(() => {
    if (!storeRoom || currentPhase !== 'lobby') return;
    const id = setInterval(async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', storeRoom.id)
        .single();
      if (data && (data as Room).phase !== 'lobby') {
        setRoom(data as Room);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [storeRoom?.id, currentPhase, setRoom]);

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

  // Final phase — show winner
  if (currentRoom.phase === 'final') {
    const playerNameById = Object.fromEntries(players.map((p) => [p.id, p.name]));
    const isHost = !!player?.is_host;
    return (
      <AppShell showHeader showNav={false}>
        {currentRoom.results_confirmed ? (
          <WinnersScreen roomId={currentRoom.id} isHost={isHost} playerNameById={playerNameById} />
        ) : (
          <>
            <LeaderboardScreen />
            <WinnerCrown
              winner={players.length > 0 ? [...players].sort((a, b) => b.total_points - a.total_points)[0] : null}
              visible={showWinner}
              onDismiss={() => setShowWinner(false)}
            />
          </>
        )}
      </AppShell>
    );
  }

  // Active game phases — show tabbed content
  const phase = currentRoom.phase as string;
  const isVotingOrLater = phase === 'voting_live' || phase === 'final';
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
        if (isVotingOrLater) return <ResultsEntry />;
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
        onExitPress={() => setShowChoiceModal(true)}
      >
        {renderActiveTab()}
      </AppShell>

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

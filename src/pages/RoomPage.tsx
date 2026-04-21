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

export function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { room, advancePhase } = useRoom();
  const { room: storeRoom, player, players, activeTab, setRoom } = useGameStore();
  const [showWinner, setShowWinner] = useState(true);

  // Try to rejoin from DB if store is empty (e.g. page refresh)
  const { status: rejoinStatus } = useRejoin(roomCode);

  // Subscribe to leaderboard and notifications when in a room
  const roomId = storeRoom?.id ?? '';
  const playerId = player?.id ?? '';
  useLeaderboard(roomId);
  useNotifications(playerId);

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

  // Redirect based on rejoin status
  useEffect(() => {
    if (rejoinStatus === 'no-auth' || rejoinStatus === 'no-room') {
      navigate('/', { replace: true });
    } else if (rejoinStatus === 'not-member') {
      // Redirect to join form with room code pre-filled
      navigate(`/?join=${roomCode}`, { replace: true });
    }
  }, [rejoinStatus, roomCode, navigate]);

  const currentRoom = storeRoom ?? room;

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
    return (
      <AppShell showHeader showNav={false}>
        <LeaderboardScreen />
        <WinnerCrown
          winner={players.length > 0 ? [...players].sort((a, b) => b.total_points - a.total_points)[0] : null}
          visible={showWinner}
          onDismiss={() => setShowWinner(false)}
        />
      </AppShell>
    );
  }

  // Active game phases — show tabbed content
  const isVotingOrLater = (currentRoom.phase as string) === 'voting_live' || (currentRoom.phase as string) === 'final';

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'quiz':
        return <QuizScreen />;
      case 'predictions':
        // During voting_live, show results entry instead of predictions
        return isVotingOrLater ? <ResultsEntry /> : <PredictionsScreen />;
      case 'duels':
        return <DuelsScreen />;
      case 'intel':
        return <IntelMarket />;
      case 'leaderboard':
        return <LeaderboardScreen />;
      default:
        return <QuizScreen />;
    }
  };

  return (
    <AppShell showHeader showNav>
      {renderActiveTab()}
    </AppShell>
  );
}

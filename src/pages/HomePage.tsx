import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WelcomeScreen from '../components/onboarding/WelcomeScreen';
import NameEntry from '../components/onboarding/NameEntry';
import { useAuth } from '../hooks/useAuth';
import { useRoom } from '../hooks/useRoom';

type Mode = 'welcome' | 'create' | 'join';

export function HomePage() {
  const [searchParams] = useSearchParams();
  const prefillCode = searchParams.get('join') || '';
  const [mode, setMode] = useState<Mode>(prefillCode ? 'join' : 'welcome');
  const { isLoading: authLoading } = useAuth();
  const { createRoom, joinRoom, isLoading, error } = useRoom();
  const navigate = useNavigate();

  // If ?join=CODE is in URL, auto-switch to join mode
  useEffect(() => {
    if (prefillCode) setMode('join');
  }, [prefillCode]);

  if (authLoading) {
    return (
      <div className="min-h-svh bg-euro-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl animate-float mb-4">🎤</div>
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (mode === 'welcome') {
    return (
      <WelcomeScreen
        onCreateRoom={() => setMode('create')}
        onJoinRoom={() => setMode('join')}
      />
    );
  }

  const handleSubmit = async (data: { name: string; emoji: string; roomCode?: string; password: string }) => {
    try {
      if (mode === 'create') {
        const code = await createRoom(data.name, data.emoji, data.password);
        navigate(`/room/${code}`);
      } else if (data.roomCode) {
        await joinRoom(data.roomCode, data.name, data.emoji, data.password);
        navigate(`/room/${data.roomCode.toUpperCase()}`);
      }
    } catch (err) {
      console.error('Failed:', err);
    }
  };

  return (
    <NameEntry
      mode={mode}
      onSubmit={handleSubmit}
      onBack={() => setMode('welcome')}
      isLoading={isLoading}
      error={error}
      initialRoomCode={prefillCode}
    />
  );
}

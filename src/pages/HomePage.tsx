import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WelcomeScreen from '../components/onboarding/WelcomeScreen';
import NameEntry from '../components/onboarding/NameEntry';
import HomeSeoBlock from '../components/seo/HomeSeoBlock';
import SiteFooter from '../components/seo/SiteFooter';
import { useAuth } from '../hooks/useAuth';
import { useRoom } from '../hooks/useRoom';

type Mode = 'welcome' | 'create' | 'join';

export function HomePage() {
  const [searchParams] = useSearchParams();
  const prefillCode = searchParams.get('join') || '';
  const action = searchParams.get('action');
  const initialMode: Mode = prefillCode || action === 'join' ? 'join' : action === 'create' ? 'create' : 'welcome';
  const [mode, setMode] = useState<Mode>(initialMode);
  const { isLoading: authLoading } = useAuth();
  const { createRoom, joinRoom, isLoading, error } = useRoom();
  const navigate = useNavigate();

  // ?join=CODE prefills join mode; ?action=create|join opens the matching screen
  useEffect(() => {
    if (prefillCode) setMode('join');
    else if (action === 'create') setMode('create');
    else if (action === 'join') setMode('join');
  }, [prefillCode, action]);

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
      <>
        <WelcomeScreen
          onCreateRoom={() => setMode('create')}
          onJoinRoom={() => setMode('join')}
        />
        <HomeSeoBlock />
        <SiteFooter />
      </>
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

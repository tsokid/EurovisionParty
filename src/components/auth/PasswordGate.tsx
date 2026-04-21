import { useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { playIntro } from '../../lib/audio';
import ThemeToggle from '../ui/ThemeToggle';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import Button from '../ui/Button';

/** SHA-256("dumtektek") */
const PASSWORD_HASH =
  '45b7013e919b242aad7d0369352af43b0b07e2fc7554cc1463a1080a3a15a248';
const STORAGE_KEY = 'eurovision-games-unlocked';

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface PasswordGateProps {
  children: ReactNode;
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const { t } = useTranslation();
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // If already unlocked on mount, still play the intro once per session
  useEffect(() => {
    if (!unlocked) return;
    const sessionKey = 'eurovision-games-intro-played';
    if (sessionStorage.getItem(sessionKey) === '1') return;
    sessionStorage.setItem(sessionKey, '1');
    playIntro();
  }, [unlocked]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || verifying) return;
    setError(null);
    setVerifying(true);
    try {
      const hash = await sha256Hex(password);
      if (hash === PASSWORD_HASH) {
        localStorage.setItem(STORAGE_KEY, '1');
        sessionStorage.setItem('eurovision-games-intro-played', '1');
        playIntro(); // user gesture → autoplay allowed
        setUnlocked(true);
      } else {
        setError(t('gate.wrongPassword'));
        setPassword('');
      }
    } finally {
      setVerifying(false);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-svh bg-euro-gradient flex flex-col items-center px-6 pt-16 pb-8 relative overflow-hidden">
      <div className="absolute top-5 right-5 z-10 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-5xl mb-2 animate-float">🎤</div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          <span className="glow-text text-euro-purple-light">Eurovision</span>{' '}
          <span className="glow-text-pink text-euro-pink">Games</span>
        </h1>
        <p className="text-3xl sm:text-4xl font-extrabold glow-text-gold text-euro-gold mt-1">
          2026
        </p>
      </motion.div>

      <motion.form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <div className="glass-strong rounded-2xl p-5 flex flex-col gap-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-euro-white mb-1">
              🔒 {t('gate.title')}
            </h2>
            <p className="text-sm text-white/70">{t('gate.subtitle')}</p>
          </div>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('gate.placeholder')}
            autoFocus
            autoComplete="off"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-center text-lg tracking-wider text-white placeholder:text-white/30 placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:border-euro-purple-light focus:ring-1 focus:ring-euro-purple-light/50 transition-colors min-h-[48px]"
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-euro-red text-sm text-center font-medium"
            >
              {error}
            </motion.p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={verifying}
            disabled={!password}
          >
            🎶 {t('gate.unlock')}
          </Button>
        </div>
      </motion.form>

      <motion.p
        className="mt-auto pt-10 text-sm text-white/50 font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {t('welcome.location')}
      </motion.p>
    </div>
  );
}

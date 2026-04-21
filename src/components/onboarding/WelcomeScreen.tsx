import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import ThemeToggle from '../ui/ThemeToggle';
import LanguageSwitcher from '../ui/LanguageSwitcher';

interface WelcomeScreenProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

const sparkles = [
  { emoji: '✨', top: '8%', left: '10%', delay: 0 },
  { emoji: '⭐', top: '15%', right: '12%', delay: 0.5 },
  { emoji: '🌟', top: '60%', left: '6%', delay: 1 },
  { emoji: '✨', top: '72%', right: '8%', delay: 0.3 },
  { emoji: '💫', bottom: '18%', left: '15%', delay: 0.8 },
  { emoji: '⭐', bottom: '25%', right: '18%', delay: 1.2 },
];

export default function WelcomeScreen({
  onCreateRoom,
  onJoinRoom,
}: WelcomeScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-svh bg-euro-gradient flex flex-col items-center px-6 pt-16 pb-8 relative overflow-hidden">
      {/* Theme toggle & language switcher — top right */}
      <div className="absolute top-5 right-5 z-10 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Scattered sparkle decorations */}
      {sparkles.map((s, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl pointer-events-none select-none opacity-40"
          style={{ top: s.top, left: s.left, right: s.right, bottom: s.bottom }}
          animate={{
            opacity: [0.2, 0.6, 0.2],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: s.delay,
            ease: 'easeInOut',
          }}
        >
          {s.emoji}
        </motion.span>
      ))}

      {/* Logo / Title block */}
      <motion.div
        className="text-center mb-3"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        {/* Floating microphone */}
        <div className="text-5xl mb-2 animate-float">🎤</div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          <span className="glow-text text-euro-purple-light">Eurovision</span>{' '}
          <span className="glow-text-pink text-euro-pink">Games</span>
        </h1>

        <motion.p
          className="text-3xl sm:text-4xl font-extrabold glow-text-gold text-euro-gold mt-1"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          2026
        </motion.p>
      </motion.div>

      {/* Subtitle — text-white/80 for contrast in both themes */}
      <motion.p
        className="text-white/80 text-base sm:text-lg text-center mb-6 max-w-xs font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {t('welcome.subtitle')}
      </motion.p>

      {/* Action buttons */}
      <motion.div
        className="flex flex-col gap-3 w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onCreateRoom}
        >
          {t('welcome.createRoom')}
        </Button>

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={onJoinRoom}
        >
          {t('welcome.joinRoom')}
        </Button>
      </motion.div>

      {/* Bottom text — mt-auto pushes to bottom, pt-10 guarantees gap from CTAs */}
      <motion.p
        className="mt-auto pt-10 text-sm text-white/50 font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {t('welcome.location')}
      </motion.p>
    </div>
  );
}

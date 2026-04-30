import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import ThemeToggle from '../ui/ThemeToggle';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import MuteToggle from '../ui/MuteToggle';
import YourRoomsPanel from '../home/YourRoomsPanel';

interface WelcomeScreenProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

// Pinpoint stars rendered as inline SVG (4-point sparkle). Replaces the emoji
// sparkles which rendered inconsistently across platforms and looked cheap.
const sparkles = [
  { top: '8%', left: '10%', delay: 0, size: 22, tint: 'rgba(249, 168, 212, 0.9)' },
  { top: '15%', right: '12%', delay: 0.5, size: 14, tint: 'rgba(253, 230, 138, 0.85)' },
  { top: '60%', left: '6%', delay: 1, size: 18, tint: 'rgba(168, 85, 247, 0.8)' },
  { top: '72%', right: '8%', delay: 0.3, size: 12, tint: 'rgba(249, 168, 212, 0.7)' },
  { bottom: '18%', left: '15%', delay: 0.8, size: 16, tint: 'rgba(34, 211, 238, 0.75)' },
  { bottom: '25%', right: '18%', delay: 1.2, size: 20, tint: 'rgba(253, 230, 138, 0.85)' },
];

// 4-point sparkle path — sharper, more elegant than emoji.
function SparkleIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{ filter: `drop-shadow(0 0 6px ${color})` }}
    >
      <path
        d="M12 2 L13.6 9.4 L21 11 L13.6 12.6 L12 20 L10.4 12.6 L3 11 L10.4 9.4 Z"
        fill={color}
      />
    </svg>
  );
}

export default function WelcomeScreen({
  onCreateRoom,
  onJoinRoom,
}: WelcomeScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-euro-gradient flex flex-col items-center px-6 pt-10 pb-8 sm:justify-center relative overflow-hidden">
      {/* Theme toggle & language switcher & mute — anchored below the
          sticky SiteHeader (3.5rem tall) so they don't collide. */}
      <div className="absolute top-3 right-5 z-10 flex items-center gap-2">
        <MuteToggle />
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Scattered sparkle decorations (SVG, not emoji) */}
      {sparkles.map((s, i) => (
        <motion.span
          key={i}
          className="absolute pointer-events-none select-none"
          style={{ top: s.top, left: s.left, right: s.right, bottom: s.bottom }}
          animate={{
            opacity: [0.35, 0.9, 0.35],
            scale: [0.85, 1.15, 0.85],
            rotate: [0, 12, 0],
          }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            delay: s.delay,
            ease: 'easeInOut',
          }}
        >
          <SparkleIcon size={s.size} color={s.tint} />
        </motion.span>
      ))}

      {/* Logo / Title block */}
      <motion.div
        className="text-center mb-3"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        {/* Eurovision Games logo (contains the wordmark) */}
        <motion.img
          src="/logo.png"
          alt="Eurovision Games"
          width={628}
          height={397}
          className="w-72 sm:w-80 h-auto mx-auto select-none drop-shadow-[0_0_24px_rgba(236,72,153,0.25)]"
          draggable={false}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Year sits just under the logo */}
        <motion.p
          className="text-3xl sm:text-4xl font-extrabold glow-text-gold text-euro-gold -mt-2"
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

      {/* Your Rooms — shown when user has prior rooms in localStorage */}
      <YourRoomsPanel />

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

      {/* Bottom text — mobile: mt-auto pushes to bottom; desktop: absolute bottom so centering above isn't pulled */}
      <motion.p
        className="mt-auto pt-10 sm:absolute sm:bottom-8 sm:mt-0 sm:pt-0 text-sm text-white/50 font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {t('welcome.location')}
      </motion.p>
    </div>
  );
}

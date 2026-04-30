import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import YourRoomsPanel from '../home/YourRoomsPanel';

interface WelcomeScreenProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

const sparkles = [
  { top: '8%', left: '8%', delay: 0, size: 22, tint: 'rgba(249, 168, 212, 0.9)' },
  { top: '14%', right: '10%', delay: 0.5, size: 14, tint: 'rgba(253, 230, 138, 0.85)' },
  { top: '60%', left: '4%', delay: 1, size: 18, tint: 'rgba(168, 85, 247, 0.8)' },
  { bottom: '20%', right: '6%', delay: 0.3, size: 20, tint: 'rgba(34, 211, 238, 0.75)' },
  { bottom: '30%', left: '14%', delay: 1.2, size: 12, tint: 'rgba(249, 168, 212, 0.7)' },
];

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
    <div className="min-h-[calc(100svh-3.5rem)] bg-euro-gradient flex flex-col items-center px-4 sm:px-6 py-4 sm:py-10 lg:py-16 relative overflow-hidden">
      {/* Scattered sparkle decorations */}
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

      {/* Stage container */}
      <div className="w-full max-w-[1140px] flex flex-col items-center justify-center flex-1 relative">
        {/* Logo — centered above both columns */}
        <motion.div
          className="flex justify-center mb-3 sm:mb-8 lg:mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <motion.img
            src="/logo.png"
            alt="Eurovision Games"
            width={628}
            height={397}
            className="w-44 sm:w-72 lg:w-80 h-auto select-none drop-shadow-[0_0_32px_rgba(236,72,153,0.28)]"
            draggable={false}
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        {/* Two-column hero — flat 2x2 grid for responsive reorder */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-y-4 sm:gap-y-6 lg:gap-y-10 gap-x-10 lg:gap-x-16 items-start relative">
          {/* Vertical divider — desktop only */}
          <div
            className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px pointer-events-none"
            style={{
              background:
                'linear-gradient(to bottom, transparent, rgba(255,255,255,0.12) 20%, rgba(255,255,255,0.12) 80%, transparent)',
            }}
            aria-hidden
          />

          {/* ─── B — Brand block (mobile order-1, desktop col-1 row-1) ─── */}
          <motion.div
            className="order-1 lg:order-1 lg:col-start-1 lg:row-start-1 flex flex-col items-center text-center gap-1.5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            {/* Wordmark line */}
            <div className="flex items-baseline justify-center gap-2 leading-none">
              <span className="text-[1.85rem] sm:text-4xl lg:text-[2.5rem] font-extrabold tracking-tight bg-gradient-to-br from-white via-euro-purple-light to-euro-pink bg-clip-text text-transparent">
                ♪ EuroVision
              </span>
              <span className="text-[1.85rem] sm:text-4xl lg:text-[2.5rem] font-extrabold tracking-tight text-euro-gold glow-text-gold">
                2026
              </span>
            </div>

            {/* Event name + category */}
            <p className="text-[0.7rem] sm:text-sm lg:text-base font-semibold text-white/55 tracking-[0.18em] uppercase mt-0.5 leading-snug">
              <strong className="text-white/90 font-bold">{t('welcome.eventName')}</strong>
              {' · '}
              {t('welcome.eventCategory')}
            </p>

            {/* Location pill */}
            <div className="mt-2 sm:mt-4 inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-md text-xs sm:text-sm font-semibold text-white/65">
              <span className="w-1.5 h-1.5 rounded-full bg-euro-green shadow-[0_0_8px_#34d399] animate-pulse" />
              {t('welcome.location')}
            </div>
          </motion.div>

          {/* ─── E — Rooms (mobile order-2, desktop col-2 row-2) ─── */}
          <div className="order-2 lg:order-4 lg:col-start-2 lg:row-start-2 w-full max-w-md mx-auto">
            <YourRoomsPanel />
          </div>

          {/* ─── D — CTAs (mobile order-3, desktop col-2 row-1) ─── */}
          <motion.div
            className="order-3 lg:order-2 lg:col-start-2 lg:row-start-1 flex flex-col gap-3 sm:gap-3.5 w-full max-w-md mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ y: 0 }}
              onClick={onCreateRoom}
              className="w-full px-6 py-4 sm:px-8 sm:py-5 rounded-2xl bg-gradient-to-br from-euro-purple to-euro-pink text-white text-base sm:text-lg lg:text-xl font-bold tracking-tight shadow-[0_6px_32px_rgba(168,85,247,0.4),0_2px_12px_rgba(236,72,153,0.3)] hover:brightness-110 hover:shadow-[0_10px_40px_rgba(168,85,247,0.5),0_4px_16px_rgba(236,72,153,0.4)] transition-all min-h-[58px] sm:min-h-[68px] flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {t('welcome.createRoom')}
            </motion.button>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              onClick={onJoinRoom}
              className="w-full px-5 py-3 sm:px-6 sm:py-4 rounded-2xl bg-white/[0.07] border border-white/[0.18] backdrop-blur-md text-white text-sm sm:text-base font-semibold hover:bg-white/[0.11] hover:border-white/[0.28] transition-all min-h-[50px] sm:min-h-[58px] flex items-center justify-center gap-2 cursor-pointer"
            >
              {t('welcome.joinRoom')}
            </motion.button>
          </motion.div>

          {/* ─── C — Pitch (mobile order-4, desktop col-1 row-2) ─── */}
          <motion.div
            className="order-4 lg:order-3 lg:col-start-1 lg:row-start-2 w-full max-w-md mx-auto pt-5 sm:pt-7 border-t border-white/10 flex flex-col gap-3 items-center text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <div className="text-[0.7rem] sm:text-xs font-bold tracking-[0.2em] uppercase text-euro-cyan flex items-center gap-2">
              <span className="inline-block w-5 h-0.5 bg-euro-cyan rounded-sm" aria-hidden />
              {t('welcome.kicker')}
            </div>

            <h1 className="text-[1.7rem] sm:text-[2.2rem] lg:text-[2.6rem] font-extrabold leading-[1.1] tracking-tight text-white">
              {t('welcome.headlineLine1')}
              <br />
              {t('welcome.headlineLine2')}{' '}
              <span className="bg-gradient-to-r from-euro-purple-light to-euro-pink bg-clip-text text-transparent">
                {t('welcome.headlineAccent')}
              </span>
            </h1>

            <p className="text-sm sm:text-base lg:text-[1.05rem] leading-relaxed text-white/60">
              {t('welcome.body')}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

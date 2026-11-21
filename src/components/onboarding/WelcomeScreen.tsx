import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import YourRoomsPanel from '../home/YourRoomsPanel';
import { useCurrentContest } from '../../lib/currentContest';
import { useLocale } from '../../lib/seo/LocaleContext';
import { contestTexts } from '../../pages/seo/content/contestText';

interface WelcomeScreenProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

// Stage palette: pink-2, gold-2, purple, live.
const sparkles = [
  { top: '8%', left: '8%', delay: 0, size: 22, tint: 'rgba(255, 122, 184, 0.9)' },
  { top: '14%', right: '10%', delay: 0.5, size: 14, tint: 'rgba(255, 224, 138, 0.85)' },
  { top: '60%', left: '4%', delay: 1, size: 18, tint: 'rgba(163, 91, 255, 0.8)' },
  { bottom: '20%', right: '6%', delay: 0.3, size: 20, tint: 'rgba(46, 230, 214, 0.75)' },
  { bottom: '30%', left: '14%', delay: 1.2, size: 12, tint: 'rgba(255, 122, 184, 0.7)' },
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
  const locale = useLocale();
  // The live contest's facts from site.json (bundled on the client: always ready).
  const contest = useCurrentContest();
  const live = contestTexts(contest)[locale];
  // The pulsing "live" dot only while the featured contest is running.
  const running = contest.stage === 'current';
  const reduceMotion = useReducedMotion();

  return (
    <div className="onb-welcome min-h-[calc(100svh-5rem)] sm:min-h-[calc(100svh-6rem)] flex flex-col items-center px-4 sm:px-6 py-3 sm:py-5 lg:py-8 relative overflow-hidden">
      {/* Scattered sparkle decorations */}
      {sparkles.map((s, i) => (
        <motion.span
          key={i}
          className="absolute pointer-events-none select-none"
          style={{ top: s.top, left: s.left, right: s.right, bottom: s.bottom }}
          animate={reduceMotion ? { opacity: 0.6 } : {
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

      {/* Stage container — logo lives in SiteHeader now, so the brand block
          (♪ EuroVision {year} wordmark + location pill) starts directly here. */}
      <div className="w-full max-w-[1140px] flex flex-col items-center justify-center flex-1 relative">
        {/* Two-column hero — flat 2x2 grid for responsive reorder */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-y-4 sm:gap-y-6 lg:gap-y-10 gap-x-10 lg:gap-x-16 items-start relative">
          {/* Vertical divider — desktop only */}
          <div
            className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px pointer-events-none"
            style={{
              background:
                'linear-gradient(to bottom, transparent, rgba(255,255,255,0.09) 20%, rgba(255,255,255,0.09) 80%, transparent)',
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
              <span className="text-[1.85rem] sm:text-4xl lg:text-[2.5rem] font-extrabold tracking-tight grad">
                ♪ EuroVision
              </span>
              <span className="text-[1.85rem] sm:text-4xl lg:text-[2.5rem] font-extrabold tracking-tight text-stage-gold">
                {live.year}
              </span>
            </div>

            {/* Event name + category */}
            <p className="text-[0.7rem] sm:text-sm lg:text-base font-semibold text-stage-text-3 tracking-[0.18em] uppercase mt-0.5 leading-snug">
              <strong className="text-stage-text font-bold">{t('welcome.eventName')}</strong>
              {' · '}
              {t('welcome.eventCategory')}
            </p>

            {/* Location pill */}
            <div className="mt-2 sm:mt-4 inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-stage-line-2 bg-stage-surface text-xs sm:text-sm font-semibold text-stage-text-2">
              {running && <span className="w-1.5 h-1.5 rounded-full bg-stage-live shadow-[0_0_8px_#2EE6D6] animate-pulse" />}
              {t('welcome.location', { city: live.city, month: live.finalMonth, year: live.year, flag: live.flag })}
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
            <button type="button" onClick={onCreateRoom} className="btn btn-primary btn-lg btn-block">
              {t('welcome.createRoom')}
            </button>

            <button type="button" onClick={onJoinRoom} className="btn btn-secondary btn-lg btn-block">
              {t('welcome.joinRoom')}
            </button>
          </motion.div>

          {/* ─── C — Pitch (mobile order-4, desktop col-1 row-2) ─── */}
          <motion.div
            className="order-4 lg:order-3 lg:col-start-1 lg:row-start-2 w-full max-w-md mx-auto pt-5 sm:pt-7 border-t border-stage-line flex flex-col gap-3 items-center text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <div className="text-[0.7rem] sm:text-xs font-bold tracking-[0.2em] uppercase text-stage-live flex items-center gap-2">
              <span className="inline-block w-5 h-0.5 bg-stage-live rounded-sm" aria-hidden />
              {t('welcome.kicker')}
            </div>

            <h1 className="text-[1.7rem] sm:text-[2.2rem] lg:text-[2.6rem] font-extrabold leading-[1.1] tracking-tight text-stage-text">
              {t('welcome.headlineLine1')}
              <br />
              {t('welcome.headlineLine2')}{' '}
              <span className="grad">
                {t('welcome.headlineAccent')}
              </span>
            </h1>

            <p className="text-sm sm:text-base lg:text-[1.05rem] leading-relaxed text-stage-text-2">
              {t('welcome.body')}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

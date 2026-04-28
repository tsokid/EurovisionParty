import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface RoomIntroOverlayProps {
  /** Called once the user dismisses the intro (skip, video end, or video missing/error). */
  onDismiss: () => void;
}

/**
 * Full-screen black "Tap to enter the show" curtain that appears the first
 * time a user enters a given room. Pressing the play button:
 *  1. Tries to play /intro-video.mp4 in fullscreen (mobile) or inline (desktop).
 *  2. Gracefully dismisses if the file is missing or playback fails.
 * A "Skip" affordance is always available.
 */
export default function RoomIntroOverlay({ onDismiss }: RoomIntroOverlayProps) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = async () => {
    setPlaying(true);
    const video = videoRef.current;
    if (!video) {
      onDismiss();
      return;
    }

    try {
      // Try fullscreen on mobile/desktop where supported. Failures are non-fatal.
      try {
        if (video.requestFullscreen) {
          await video.requestFullscreen();
        } else if ('webkitEnterFullscreen' in video) {
          (video as HTMLVideoElement & { webkitEnterFullscreen: () => void })
            .webkitEnterFullscreen();
        }
      } catch { /* fullscreen denied — play inline */ }

      await video.play();
    } catch (err) {
      console.warn('[RoomIntro] Video playback failed:', err);
      onDismiss();
    }
  };

  const handleEnded = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => { /* ignore */ });
    }
    onDismiss();
  };

  /** Fires if the video file is missing or fails to decode. */
  const handleError = () => {
    onDismiss();
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {!playing && (
        <>
          {/* Skip control — top right */}
          <button
            onClick={onDismiss}
            className="absolute top-5 right-5 text-white/40 hover:text-white/80 transition-colors text-sm font-medium tracking-wider uppercase px-3 py-2"
            aria-label={t('intro.skip', { defaultValue: 'Skip' })}
          >
            {t('intro.skip', { defaultValue: 'Skip' })} ✕
          </button>

          {/* Big animated play button */}
          <button
            onClick={handlePlay}
            className="relative cursor-pointer"
            aria-label={t('intro.play', { defaultValue: 'Play intro' })}
          >
            {/* Outer pulsing glow halo */}
            <motion.div
              aria-hidden
              className="absolute inset-0 rounded-full -m-12"
              style={{
                background:
                  'radial-gradient(circle, rgba(236,72,153,0.45) 0%, rgba(134,59,255,0.25) 45%, transparent 70%)',
                filter: 'blur(24px)',
              }}
              animate={{
                scale: [1, 1.35, 1],
                opacity: [0.55, 1, 0.55],
              }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Gradient circle button */}
            <motion.div
              className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-full flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(135deg, #ec4899 0%, #863bff 55%, #47bfff 100%)',
                boxShadow:
                  '0 0 50px rgba(236,72,153,0.55), 0 0 90px rgba(134,59,255,0.35)',
              }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Play triangle, slightly nudged right for optical centering */}
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-14 h-14 sm:w-16 sm:h-16 text-white ml-1.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </motion.div>
          </button>

          {/* Wordmark */}
          <motion.h1
            className="mt-12 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-center px-4"
            style={{
              backgroundImage:
                'linear-gradient(180deg, #fffbe6 0%, #fde68a 40%, #fbbf24 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 22px rgba(251,191,36,0.45))',
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
          >
            EUROVISION.GAMES
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="mt-3 text-xs sm:text-sm tracking-[0.35em] text-white/40 uppercase font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            {t('intro.tapToEnter', { defaultValue: 'Tap to enter the show' })}
          </motion.p>
        </>
      )}

      {/* Video element — preload="none" so it never errors before user taps play.
          When playing, fills the screen (mobile auto-fullscreens via API above). */}
      <video
        ref={videoRef}
        src="/intro-video.mp4"
        preload="none"
        playsInline
        controls={false}
        onEnded={handleEnded}
        onError={handleError}
        className={
          playing
            ? 'absolute inset-0 w-full h-full object-contain bg-black'
            : 'hidden'
        }
      />
    </motion.div>
  );
}

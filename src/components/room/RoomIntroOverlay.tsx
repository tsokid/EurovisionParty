import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../stores/gameStore';

interface RoomIntroOverlayProps {
  /** Called when the user taps "Enter Room" on the end card (or skips). */
  onDismiss: () => void;
}

/**
 * Three-state intro per the redesign handoff:
 *   1. AUDIO GATE — pulsing gradient circle, "Tap to enter the show". User
 *      gesture unlocks audio for the video.
 *   2. VIDEO — plays /intro-video.mp4 with original audio inside a portrait
 *      9:16 frame, optional letterbox bars top/bottom.
 *   3. END CARD — five gold stars, "YOU'RE IN, {NAME}!", REPLAY + ENTER ROOM.
 *
 * Skip ✕ in the corner is always available so users are never trapped.
 */
export default function RoomIntroOverlay({ onDismiss }: RoomIntroOverlayProps) {
  const { t } = useTranslation();
  const { player, room } = useGameStore();
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Player name shown in the end card. Falls back to a friendly default.
  const displayName = (player?.name || t('intro.defaultName', { defaultValue: 'Friend' }))
    .toUpperCase();

  // Personalised end-card subtitle: "get ready · room ABC123"
  const roomCode = room?.code?.toUpperCase();

  const start = async () => {
    setEnded(false);
    setStarted(true);
    const v = videoRef.current;
    if (!v) return;
    try {
      v.currentTime = 0;
      v.muted = false;
      v.volume = 1;
      await v.play();
    } catch (err) {
      console.warn('[RoomIntro] Playback failed:', err);
      // If video fails (missing file, codec, etc.) jump straight to end card.
      setEnded(true);
    }
  };

  const replay = async () => {
    const v = videoRef.current;
    if (!v) return;
    setEnded(false);
    try {
      v.currentTime = 0;
      await v.play();
    } catch { /* ignore */ }
  };

  // Wire up "ended" event on the video element
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnd = () => setEnded(true);
    const onError = () => setEnded(true); // graceful fallback to end card
    v.addEventListener('ended', onEnd);
    v.addEventListener('error', onError);
    return () => {
      v.removeEventListener('ended', onEnd);
      v.removeEventListener('error', onError);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
      {/* Skip ✕ — always reachable */}
      {!ended && (
        <button
          onClick={onDismiss}
          aria-label={t('intro.skip', { defaultValue: 'Skip' })}
          className="absolute top-4 right-4 z-[120] text-white/40 hover:text-white/80 transition-colors text-xs font-semibold uppercase tracking-[0.2em] px-3 py-2"
        >
          {t('intro.skip', { defaultValue: 'Skip' })} ✕
        </button>
      )}

      {/* Portrait 9:16 frame — fills viewport on phones, letterbox left/right on desktop */}
      <div className="relative h-full max-h-screen aspect-[9/16] bg-black overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
        {/* Base video — original audio, fills the frame */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover z-[1]"
          src="/intro-video.mp4"
          playsInline
          preload="auto"
        />

        {/* Letterbox bars (top + bottom 6%) — overlay the video for cinematic feel */}
        <div className="absolute top-0 left-0 right-0 h-[6%] bg-black z-[8] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-[6%] bg-black z-[8] pointer-events-none" />

        {/* AUDIO GATE — initial state */}
        {!started && (
          <button
            onClick={start}
            className={`absolute inset-0 z-[100] flex flex-col items-center justify-center px-6 cursor-pointer transition-opacity duration-500 ${
              started ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            style={{
              background: 'radial-gradient(ellipse at center, #1a0830 0%, #000 70%)',
            }}
            aria-label={t('intro.play', { defaultValue: 'Tap to enter the show' })}
          >
            {/* Pulsing gradient orb with play triangle */}
            <span className="intro-pulse mb-7 w-[110px] h-[110px] rounded-full flex items-center justify-center">
              <span className="intro-play-icon" />
            </span>
            <h1 className="intro-wordmark m-0 mb-1.5">EUROVISION GAMES</h1>
            <p className="m-0 text-[11px] tracking-[0.4em] uppercase text-white/55">
              {t('intro.tapToEnter', { defaultValue: 'tap to enter the show' })}
            </p>
          </button>
        )}

        {/* END CARD — slides in after video ends (or on skip-to-end) */}
        <div
          className={`absolute inset-0 z-[90] flex flex-col items-start justify-center bg-black transition-opacity duration-500 px-[9%] ${
            ended ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="intro-stars mb-9">★ ★ ★ ★ ★</div>
          {player?.is_host ? (
            <div className="intro-bigtext text-white">
              {t('intro.hostLabel', { defaultValue: 'HOST:' })}
            </div>
          ) : (
            <div className="intro-bigtext text-white">
              {t('intro.youreIn', { defaultValue: "YOU'RE IN," })}
            </div>
          )}
          <div className="intro-bigtext intro-name break-words">{displayName}!</div>
          <div className="mt-7 text-[11px] sm:text-xs md:text-sm font-semibold tracking-[0.32em] uppercase text-white/55">
            {roomCode
              ? t('intro.subtitleWithRoom', {
                  defaultValue: 'get ready · room {{code}}',
                  code: roomCode,
                })
              : t('intro.subtitle', { defaultValue: 'get ready · let the show begin' })}
          </div>
          <div className="mt-14 flex flex-col gap-3.5 w-full max-w-[380px]">
            <button onClick={replay} className="intro-btn intro-btn-primary">
              ▸ {t('intro.replay', { defaultValue: 'REPLAY' })}
            </button>
            <button onClick={onDismiss} className="intro-btn intro-btn-ghost">
              → {t('intro.enterRoom', { defaultValue: 'ENTER ROOM' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

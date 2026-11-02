// Our own player around native <video>: poster first, preload="none", nothing
// is requested until a play intent (button, key, or autoplay becoming visible).
// Autoplay (value.autoplay only) is muted, looping, inline, starts when the
// player is visible (IntersectionObserver) and pauses when it is not.
// A draft (`cms-media/` references) plays only under a MediaResolverContext
// (admin preview); on the public site it renders nothing.
import { useContext, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLocale } from '../../lib/seo/LocaleContext';
import type { Locale } from '../../lib/seo/locale';
import { isDim, isPublishedMedia, type CmsVideoValue } from './mediaTypes';
import { isDraftMedia, MediaResolverContext, type MediaResolver, type ResolvedVideo } from './MediaResolver';

const LABELS: Record<Locale, { play: string; pause: string; mute: string; unmute: string; progress: string; player: string }> = {
  en: { play: 'Play', pause: 'Pause', mute: 'Mute', unmute: 'Unmute', progress: 'Progress', player: 'Video player' },
  el: {
    play: 'Αναπαραγωγή',
    pause: 'Παύση',
    mute: 'Σίγαση',
    unmute: 'Ενεργοποίηση ήχου',
    progress: 'Πρόοδος',
    player: 'Πρόγραμμα αναπαραγωγής βίντεο',
  },
};

const btn = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-euro-pink';

/** The files to play: a published value as is, a draft through the resolver; null when it cannot play. */
function source(value: CmsVideoValue, resolver: MediaResolver | null): ResolvedVideo | null {
  if (!value) return null;
  if (isPublishedMedia(value.media, 'mp4') && isPublishedMedia(value.poster, 'webp') && isDim(value.width) && isDim(value.height)) {
    return {
      src: value.media,
      poster: value.poster,
      width: value.width,
      height: value.height,
      ...(isPublishedMedia(value.captions, 'vtt') ? { captions: value.captions } : {}),
    };
  }
  if (!resolver || ![value.media, value.poster, value.captions].some(isDraftMedia)) return null;
  const r = resolver.video(value);
  return r && r.src && r.poster && isDim(r.width) && isDim(r.height) ? r : null;
}

export default function VideoPlayer({ value }: { value: CmsVideoValue }) {
  const t = LABELS[useLocale()];
  const src = source(value, useContext(MediaResolverContext));
  const ref = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const wantPlay = useRef(false);
  const [armed, setArmed] = useState(false); // the source may be requested
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(value?.autoplay === true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const autoplay = !!src && value.autoplay === true;

  // Play once the source attribute is on the element.
  useEffect(() => {
    if (armed && wantPlay.current) {
      wantPlay.current = false;
      void ref.current?.play()?.catch(() => {});
    }
  }, [armed]);

  useEffect(() => {
    if (!autoplay || typeof IntersectionObserver === 'undefined' || !wrap.current) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        if (ref.current?.getAttribute('src')) void ref.current.play()?.catch(() => {});
        else { wantPlay.current = true; setArmed(true); }
      } else {
        wantPlay.current = false;
        ref.current?.pause();
      }
    });
    io.observe(wrap.current);
    return () => io.disconnect();
  }, [autoplay]);

  if (!src) return null;

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (!armed) { wantPlay.current = true; setArmed(true); return; }
    if (v.paused) void v.play()?.catch(() => {});
    else v.pause();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // buttons and the slider keep their own keys
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
  };

  return (
    <div
      ref={wrap}
      role="group"
      aria-label={t.player}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative w-full overflow-hidden rounded-2xl bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-euro-pink"
      style={{ aspectRatio: `${src.width} / ${src.height}` }}
    >
      <video
        ref={ref}
        {...(armed ? { src: src.src } : {})}
        poster={src.poster}
        preload="none"
        playsInline
        muted={muted}
        loop={autoplay}
        className="h-full w-full object-contain"
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
      >
        {armed && src.captions ? <track kind="captions" src={src.captions} default /> : null}
      </video>
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-2">
        <button type="button" className={btn} onClick={toggle} aria-label={playing ? t.pause : t.play}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            {playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
          </svg>
        </button>
        <input
          type="range"
          aria-label={t.progress}
          className="h-1 min-w-0 flex-1 accent-euro-pink"
          min={0}
          max={duration > 0 && Number.isFinite(duration) ? duration : 0}
          step="any"
          value={Math.min(time, duration > 0 ? duration : 0)}
          disabled={!armed || !(duration > 0)}
          onChange={(e) => {
            if (ref.current) ref.current.currentTime = Number(e.target.value);
            setTime(Number(e.target.value));
          }}
        />
        <button type="button" className={btn} onClick={() => setMuted((m) => !m)} aria-label={muted ? t.unmute : t.mute}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M3 9v6h4l5 5V4L7 9z" />
            {muted
              ? <path d="M16 9l5 6m0-6l-5 6" stroke="currentColor" strokeWidth="2" fill="none" />
              : <path d="M15 8a5 5 0 010 8" stroke="currentColor" strokeWidth="2" fill="none" />}
          </svg>
        </button>
      </div>
    </div>
  );
}

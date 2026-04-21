/**
 * Shared audio player for the Eurovision intro track.
 * A single HTMLAudioElement instance is reused so we never stack overlapping
 * playbacks (e.g. unlock + final-phase transitions).
 */

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/eurovision-intro.mp3');
    audio.preload = 'auto';
    audio.volume = 0.7;
  }
  return audio;
}

/** Play the intro track from the start. Safe to call multiple times. */
export function playIntro(): void {
  const el = getAudio();
  try {
    el.currentTime = 0;
    // Must be triggered by a user gesture on first call (autoplay policy).
    void el.play().catch(() => {
      /* autoplay blocked — silent */
    });
  } catch {
    /* ignore */
  }
}

/** Stop any current playback. */
export function stopIntro(): void {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

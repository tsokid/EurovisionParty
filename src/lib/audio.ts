/**
 * Shared audio player for all Eurovision Games sound effects.
 * A single HTMLAudioElement instance is reused so we never stack overlapping
 * playbacks (e.g. unlock + final-phase transitions).
 *
 * Respects the global mute flag in audioStore — muted playback is silently
 * skipped. If mute is toggled mid-playback, the track is paused.
 */

import { useAudioStore } from '../stores/audioStore';

let audio: HTMLAudioElement | null = null;
let unsubscribe: (() => void) | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/eurovision-intro.mp3');
    audio.preload = 'auto';
    audio.volume = 0.7;
  }
  return audio;
}

/**
 * Subscribe once to mute-state changes so toggling mute mid-playback
 * immediately stops the current track (and unmuting does NOT auto-resume —
 * that would need a user gesture).
 */
function ensureMuteSync() {
  if (unsubscribe) return;
  unsubscribe = useAudioStore.subscribe((state, prev) => {
    if (state.muted && !prev.muted && audio) {
      audio.pause();
    }
  });
}

/** Play the intro track from the start. No-op if muted. */
export function playIntro(): void {
  ensureMuteSync();
  if (useAudioStore.getState().muted) return;
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

/**
 * Short buzz where supported (Android). Browsers refuse it before the first
 * tap on the page, so skip it then instead of logging an intervention.
 * Motion map: haptics only on tier 1–2 moments.
 */
export function buzz(pattern: number | number[] = [30, 40, 30]): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    navigator.vibrate(pattern);
  } catch { /* not allowed */ }
}

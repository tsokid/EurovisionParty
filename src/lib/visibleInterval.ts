/**
 * Runs `fn` every `ms` only while the tab is visible (28 Nov 2026).
 *
 * A minimised or background tab sends nothing to Supabase. When the tab
 * comes back to the front, `fn` runs once at once and the timer restarts.
 * `jitter` (0..1) spreads the ticks of many phones over the interval, so
 * they never hit the server in the same second.
 *
 * Returns the cleanup for a useEffect.
 */
export function visibleInterval(fn: () => void, ms: number, opts: { jitter?: number; runNow?: boolean } = {}): () => void {
  const jitter = Math.max(0, Math.min(1, opts.jitter ?? 0));
  let timer: ReturnType<typeof setTimeout> | null = null;
  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

  const stop = () => { if (timer !== null) { clearTimeout(timer); timer = null; } };
  const schedule = () => {
    stop();
    if (!visible()) return;
    const wait = ms * (1 - jitter / 2 + Math.random() * jitter);
    timer = setTimeout(() => { timer = null; if (visible()) { fn(); schedule(); } }, wait);
  };
  const onVisibility = () => {
    if (visible()) { fn(); schedule(); } else stop();
  };

  if (opts.runNow && visible()) fn();
  schedule();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  return () => {
    stop();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
  };
}

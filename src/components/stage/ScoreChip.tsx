import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { POINTS_LANDED_EVENT } from './PointsFlight';

/**
 * Animates a displayed integer from its previous value to `target`
 * (ease-out cubic). With duration 0 the target is shown at once.
 */
export function useCountUp(target: number, duration: number): number {
  const [value, setValue] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    if (duration <= 0 || typeof requestAnimationFrame === 'undefined') {
      shownRef.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    // performance.now() rather than the rAF timestamp: some environments
    // (jsdom, throttled tabs) report rAF times on a different clock.
    const tick = () => {
      const p = Math.min(1, Math.max(0, (performance.now() - start) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      const v = p >= 1 ? target : Math.round(from + (target - from) * eased);
      shownRef.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export interface ScoreChipProps {
  points: number;
  /** Screen-reader text for the final value, e.g. "128 πόντοι". */
  srLabel: string;
  className?: string;
}

/** Count-up duration (motion map: transitions 250–350 ms, moments up to 1.2 s). */
export const SCORE_COUNT_MS = 600;

/**
 * The game-bar points chip (motion map #12): when points change it bumps
 * (scale 1 → 1.15 → 1, 200 ms) and counts up. Under reduced motion the
 * new total is shown at once with no bump.
 */
export function ScoreChip({ points, srLabel, className }: ScoreChipProps) {
  const reduce = useReducedMotion() ?? false;
  const shown = useCountUp(points, reduce ? 0 : SCORE_COUNT_MS);
  const controls = useAnimationControls();
  const prev = useRef(points);

  useEffect(() => {
    if (points === prev.current) return;
    prev.current = points;
    if (!reduce) void controls.start({ scale: [1, 1.15, 1], transition: { duration: 0.2, ease: 'easeOut' } });
  }, [points, reduce, controls]);

  // A flying "+N" chip (PointsFlight) landed here: bump even if the store
  // total has not caught up yet; the count-up follows when it does.
  useEffect(() => {
    if (reduce || typeof window === 'undefined') return;
    const onLand = () => { void controls.start({ scale: [1, 1.15, 1], transition: { duration: 0.2, ease: 'easeOut' } }); };
    window.addEventListener(POINTS_LANDED_EVENT, onLand);
    return () => window.removeEventListener(POINTS_LANDED_EVENT, onLand);
  }, [reduce, controls]);

  return (
    <motion.span className={clsx('gs-pts', className)} animate={controls} data-points={points}>
      <span className="sr-only">{srLabel}</span>
      <span className="num" aria-hidden="true">{shown.toLocaleString()}</span>
    </motion.span>
  );
}

import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { motion, useReducedMotion } from 'framer-motion';
import { PointsChip, type PointsChipProps } from './PointsChip';

/** Fired on window when a flying chip reaches the game-bar points chip. */
export const POINTS_LANDED_EVENT = 'stage:points-landed';

/** Motion prototype timings (motion-quiz-end-m / motion-duel-m). */
const POP = [0.34, 1.56, 0.64, 1] as const;
const FLY_MS = 420;

export interface PointsFlightProps extends PointsChipProps {
  /**
   * After this delay a copy of the chip flies into the game-bar points
   * chip (`.gs-pts`), which then bumps (motion map #12). Default 450 ms.
   * Zero-point chips never fly.
   */
  flyAfterMs?: number;
}

function visibleScoreChip(): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>('.gs-pts')];
  return all.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }) ?? null;
}

/**
 * Motion map #8/#12: the answer's "+N · reason" chip pops in where it was
 * earned (and stays there so the sum can be checked), while a copy floats
 * into the game-bar points chip. Reduced motion: the chip fades in, no copy
 * flies, nothing bumps.
 */
export function PointsFlight({ flyAfterMs = 450, className, ...chip }: PointsFlightProps) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduce || chip.points <= 0) return;
    const src = ref.current;
    if (!src || typeof src.animate !== 'function') return;
    let clone: HTMLElement | null = null;
    const id = setTimeout(() => {
      const target = visibleScoreChip();
      if (!target) return;
      const a = src.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      clone = src.cloneNode(true) as HTMLElement;
      clone.setAttribute('aria-hidden', 'true');
      clone.classList.add('pts-fly');
      Object.assign(clone.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px` });
      document.body.appendChild(clone);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const anim = clone.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 24}px) scale(.85)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${dx}px, ${dy}px) scale(.6)`, opacity: 0 },
        ],
        { duration: FLY_MS, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' },
      );
      anim.onfinish = () => {
        clone?.remove();
        clone = null;
        window.dispatchEvent(new CustomEvent(POINTS_LANDED_EVENT));
      };
    }, flyAfterMs);
    return () => { clearTimeout(id); clone?.remove(); };
  }, [reduce, chip.points, flyAfterMs]);

  return (
    <motion.span
      ref={ref}
      className={clsx('pts-flight', className)}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.6 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={reduce ? { duration: 0.2 } : { duration: 0.2, ease: POP }}
    >
      <PointsChip {...chip} />
    </motion.span>
  );
}

// Flag flight for the predictions picker (motion map #7): when a country is
// tapped in the pool, its flag flies into the slot it lands in.
//
// A shared-layout (FLIP) move done by hand: the pool flag's rect is
// recorded on tap; the slot flag, on mount, starts at that rect and springs
// to its own place. Transform only; skipped under reduced motion. Done
// without framer `layoutId` because the pool keeps showing its own (dimmed)
// flag while the slot shows the moving one.

import { useLayoutEffect, useRef } from 'react';

let pending: { iso: string; rect: DOMRect; at: number } | null = null;

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Remember where the tapped country's flag is, before the slot renders. */
export function launchFlag(iso: string, from: Element | null | undefined) {
  if (!from || reducedMotion()) { pending = null; return; }
  pending = { iso, rect: from.getBoundingClientRect(), at: Date.now() };
}

/** Ref for the slot flag of `iso`: plays the flight once when it mounts. */
export function useLandingFlag<T extends HTMLElement>(iso: string | null) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const p = pending;
    if (!el || !iso || !p || p.iso !== iso || Date.now() - p.at > 1000) return;
    pending = null;
    if (typeof el.animate !== 'function') return;
    const to = el.getBoundingClientRect();
    if (!to.width || !p.rect.width) return;
    const dx = p.rect.left + p.rect.width / 2 - (to.left + to.width / 2);
    const dy = p.rect.top + p.rect.height / 2 - (to.top + to.height / 2);
    const s = p.rect.width / to.width;
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
        { transform: 'translate(0, 0) scale(1.12)', offset: 0.82 },
        { transform: 'none' },
      ],
      { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }, [iso]);
  return ref;
}

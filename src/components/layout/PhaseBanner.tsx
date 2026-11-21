import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { RoomPhase } from '../../lib/types';

/** Phases that get the sweep banner when the room moves into them. */
export const BANNER_PHASES: readonly RoomPhase[] = ['pre_night', 'predictions_open', 'voting_live', 'final'];
/** How long the banner stays before it sweeps out. */
export const PHASE_BANNER_MS = 3200;
const HAPTIC: number[] = [40, 60, 40];

/** Short buzz where supported (Android). Browsers refuse it before the
 *  first tap on the page, so skip it then instead of logging an error. */
function vibrate() {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    navigator.vibrate(HAPTIC);
  } catch { /* not allowed */ }
}

/**
 * Returns the phase to announce, or null. Fires only on a real change of
 * the store's room phase (realtime or polling), never on the first value
 * seen (page load, rejoin), so every phone in the room plays it together.
 */
export function usePhaseBanner(phase: RoomPhase | undefined) {
  const prev = useRef<RoomPhase | null>(null);
  const [shown, setShown] = useState<RoomPhase | null>(null);

  useEffect(() => {
    if (!phase) return;
    const before = prev.current;
    prev.current = phase;
    if (before && before !== phase && BANNER_PHASES.includes(phase)) {
      setShown(phase);
      vibrate();
    }
  }, [phase]);

  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown(null), PHASE_BANNER_MS);
    return () => clearTimeout(id);
  }, [shown]);

  return { shown, dismiss: () => setShown(null) };
}

interface PhaseBannerProps {
  phase: RoomPhase | null;
  onDismiss: () => void;
}

/**
 * Motion map #5: a banner sweeps across with a live pulse. Reduced motion:
 * fade only. Copy: `phaseBanner.<phase>` (EL «Οι προβλέψεις άνοιξαν!»).
 */
export default function PhaseBanner({ phase, onDismiss }: PhaseBannerProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;

  const enter = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.25 } }, exit: { opacity: 0, transition: { duration: 0.25 } } }
    : {
        initial: { x: '-110vw', opacity: 0 },
        animate: { x: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 260, damping: 26 } },
        exit: { x: '110vw', opacity: 0, transition: { duration: 0.3, ease: 'easeIn' as const } },
      };

  return (
    <div className="gs-banner-wrap" aria-live="polite">
      <AnimatePresence>
        {phase && (
          <motion.div key={phase} className={reduce ? 'gs-banner still' : 'gs-banner'} role="status" data-phase={phase} {...enter}>
            <span className="gs-banner-live" aria-hidden="true"><i /></span>
            <span className="gs-banner-text">
              <strong>{t(`phaseBanner.${phase}.title`)}</strong>
              <span>{t(`phaseBanner.${phase}.body`)}</span>
            </span>
            <button type="button" className="gs-banner-x" onClick={onDismiss} aria-label={t('phaseBanner.dismiss')}>
              <X aria-hidden="true" strokeWidth={2.2} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

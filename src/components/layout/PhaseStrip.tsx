import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { PHASE_ORDER } from '../../lib/constants';
import type { RoomPhase } from '../../lib/types';

interface PhaseStripProps {
  phase: RoomPhase;
  /** compact: "Η βραδιά · ● now → next" (mobile); full: every phase (desktop). */
  variant: 'compact' | 'full';
  /** Compact only: makes the strip a button that opens the full phase list. */
  onToggle?: () => void;
  expanded?: boolean;
  className?: string;
}

/**
 * Where the night is. A status indicator only: it is not navigation (the
 * tabs are). Labels are the existing `phases.*.label` strings.
 */
export default function PhaseStrip({ phase, variant, onToggle, expanded, className }: PhaseStripProps) {
  const { t } = useTranslation();
  const idx = Math.max(0, PHASE_ORDER.indexOf(phase));
  const shown = variant === 'full' ? PHASE_ORDER : PHASE_ORDER.slice(idx, idx + 2);
  const offset = variant === 'full' ? 0 : idx;

  const items = (
    <ol className="gs-strip-list">
      {shown.map((p, i) => {
        const at = i + offset;
        const state = at < idx ? 'past' : at === idx ? 'now' : 'next';
        return (
          <li key={p} className={clsx('gs-strip-item', state)} aria-current={state === 'now' ? 'step' : undefined}>
            {i > 0 && <span className="sep" aria-hidden="true">→</span>}
            {state === 'now' && <i className="gs-live-dot" aria-hidden="true" />}
            <span className="lbl">{t(`phases.${p}.label`)}</span>
          </li>
        );
      })}
    </ol>
  );

  const key = <span className="k">{t(variant === 'full' ? 'game.stripWide' : 'game.strip')}</span>;

  if (variant === 'compact' && onToggle) {
    return (
      <div className={clsx('gs-strip gs-mstrip', className)} role="status" aria-label={t('game.stripAria')}>
        <button
          type="button"
          className="gs-strip-btn"
          onClick={onToggle}
          aria-expanded={expanded ?? false}
          aria-label={`${t('game.phasesButton')}: ${t(`phases.${phase}.label`)}`}
        >
          {key}
          {items}
          <ChevronDown className="gs-strip-chev" aria-hidden="true" strokeWidth={2.2} />
        </button>
      </div>
    );
  }

  return (
    <div className={clsx('gs-strip', variant === 'compact' && 'gs-mstrip', className)} role="status" aria-label={t('game.stripAria')}>
      {key}
      {items}
    </div>
  );
}

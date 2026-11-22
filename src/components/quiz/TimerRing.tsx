import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

/** The ring turns red in the last 5 seconds (motion map #8). */
export const TIMER_WARN_SECONDS = 5;

interface TimerRingProps {
  /** Total seconds for this question (quiz 15, duel 12). */
  seconds: number;
  remaining: number;
  size?: number;
}

/**
 * Countdown ring. The arc shortens once per tick (stroke-dashoffset, a
 * paint-only property) and switches to the warning colour at ≤ 5″.
 * Reduced motion: CSS drops the transition.
 */
export default function TimerRing({ seconds, remaining, size = 64 }: TimerRingProps) {
  const { t } = useTranslation();
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const left = Math.max(0, Math.min(seconds, remaining));
  const warn = left <= TIMER_WARN_SECONDS;
  return (
    <div
      className={clsx('qz-ring', warn && 'warn')}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={t('questionCard.timerAria', { left, total: seconds })}
      data-warn={warn || undefined}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="qz-ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="qz-ring-arc"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (seconds > 0 ? left / seconds : 0))}
        />
      </svg>
      <span className="num" aria-hidden="true">{left}</span>
    </div>
  );
}

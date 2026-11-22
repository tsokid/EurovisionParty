import { useTranslation } from 'react-i18next';

interface ProgressRingProps {
  filled: number;
  total: number;
  size?: number;
}

/**
 * Segmented progress ring (motion map #7): one arc per slot. A slot that
 * fills fades its arc in (opacity only), so the ring "fills" as picks land
 * without animating stroke geometry. Reduced motion: no transition.
 */
export default function ProgressRing({ filled, total, size = 52 }: ProgressRingProps) {
  const { t } = useTranslation();
  const r = 20;
  const gap = 0.09; // radians between segments
  const step = (Math.PI * 2) / total;
  const arc = (i: number) => {
    const a0 = -Math.PI / 2 + i * step + gap / 2;
    const a1 = a0 + step - gap;
    const p = (a: number) => `${(24 + r * Math.cos(a)).toFixed(3)} ${(24 + r * Math.sin(a)).toFixed(3)}`;
    return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
  };
  return (
    <span
      className="pk-ring"
      role="img"
      aria-label={t('pick.ringAria', { filled, total })}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="pk-ring-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-stage-pink)" />
            <stop offset="1" stopColor="var(--color-stage-purple)" />
          </linearGradient>
        </defs>
        {Array.from({ length: total }, (_, i) => (
          <path key={`b${i}`} d={arc(i)} className="pk-ring-base" />
        ))}
        {Array.from({ length: total }, (_, i) => (
          <path key={`f${i}`} d={arc(i)} className="pk-ring-seg" data-on={i < filled ? '' : undefined} stroke="url(#pk-ring-g)" />
        ))}
      </svg>
      <span className="num pk-ring-n" aria-hidden="true">{filled}</span>
    </span>
  );
}

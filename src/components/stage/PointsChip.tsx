import clsx from 'clsx';

export interface PointsChipProps {
  points: number;
  /** Why the points were given, e.g. "4s", "σωστή απάντηση", "κλοπή". */
  reason?: string;
  /**
   * Colour override. Default: gains ok (green), losses bad (red), zero
   * neutral. Prediction hits use gold (+50) and pink (+20), per motion #2.
   */
  tone?: 'gold' | 'pink';
  className?: string;
}

/** Signed points with a real minus sign: +8, 0, −12. */
export function formatPoints(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return '0';
}

/**
 * "+N · reason" chip for quiz and duel answers and prediction picks.
 * Motion is added by the screens using it.
 */
export function PointsChip({ points, reason, tone, className }: PointsChipProps) {
  const toneClass = tone ? `chip-${tone}` : points > 0 ? 'chip-ok' : points < 0 ? 'chip-bad' : null;
  return (
    <span className={clsx('chip', toneClass, className)}>
      <span className="num">{formatPoints(points)}</span>
      {reason && <span>· {reason}</span>}
    </span>
  );
}

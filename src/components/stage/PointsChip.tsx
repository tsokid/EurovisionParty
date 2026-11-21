import clsx from 'clsx';

export interface PointsChipProps {
  points: number;
  /** Why the points were given, e.g. "4s", "σωστή απάντηση", "κλοπή". */
  reason?: string;
  className?: string;
}

/** Signed points with a real minus sign: +8, 0, −12. */
export function formatPoints(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return '0';
}

/**
 * "+N · reason" chip for quiz and duel answers. Gains are green (ok),
 * losses red (bad), zero neutral. Motion is added by the screens using it.
 */
export function PointsChip({ points, reason, className }: PointsChipProps) {
  const tone = points > 0 ? 'chip-ok' : points < 0 ? 'chip-bad' : null;
  return (
    <span className={clsx('chip', tone, className)}>
      <span className="num">{formatPoints(points)}</span>
      {reason && <span>· {reason}</span>}
    </span>
  );
}

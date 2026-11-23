import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface StatProps {
  value: ReactNode;
  label: ReactNode;
  /** Gold value (e.g. the final's date). */
  accent?: 'gold';
  className?: string;
}

/** Scoreboard tile: numeral-font value + small label. */
export function Stat({ value, label, accent, className }: StatProps) {
  return (
    <div className={clsx('stat', className)}>
      <div className={clsx('v num', accent === 'gold' && 'text-stage-gold')}>{value}</div>
      <div className="k">{label}</div>
    </div>
  );
}

/** `.stats` grid: 2 columns, 4 from 768px. */
export function Stats({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={clsx('stats', className)}>{children}</div>;
}

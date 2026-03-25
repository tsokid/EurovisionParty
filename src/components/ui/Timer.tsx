import clsx from 'clsx';

interface TimerProps {
  /** Total seconds for the timer */
  seconds: number;
  /** Seconds remaining */
  remaining: number;
  /** Diameter in pixels */
  size?: number;
}

export default function Timer({ seconds, remaining, size = 120 }: TimerProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds > 0 ? remaining / seconds : 0;
  const offset = circumference * (1 - progress);

  const color =
    remaining > 10
      ? 'text-euro-green'
      : remaining > 5
        ? 'text-euro-gold'
        : 'text-euro-red';

  const strokeColor =
    remaining > 10
      ? 'stroke-euro-green'
      : remaining > 5
        ? 'stroke-euro-gold'
        : 'stroke-euro-red';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={clsx('timer-ring', strokeColor)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={clsx('absolute text-3xl font-bold tabular-nums', color)}>
        {remaining}
      </span>
    </div>
  );
}

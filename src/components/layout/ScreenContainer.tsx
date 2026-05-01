import type { ReactNode } from 'react';
import clsx from 'clsx';

interface ScreenContainerProps {
  children: ReactNode;
  /** Optional override; defaults to the standard reading width used
   *  across in-room screens. Predictions use 'wide' so the 5-zone
   *  ranking grid has room to breathe. */
  width?: 'standard' | 'wide';
  className?: string;
}

/**
 * Standard in-room screen wrapper. Centralizes max-width and padding
 * so Quiz / Duels / Leaderboard / Final Results / waiting screens all
 * align horizontally — and start the same distance below the header.
 *
 * AppShell already handles top padding (`pt-4 sm:pt-6` on <main>),
 * so this only adds horizontal padding + a max-width and bottom space.
 */
export default function ScreenContainer({
  children,
  width = 'standard',
  className,
}: ScreenContainerProps) {
  const maxW = width === 'wide' ? 'max-w-5xl' : 'max-w-3xl';
  return (
    <div
      className={clsx(
        'mx-auto w-full px-3 sm:px-5 lg:px-6 pb-6',
        maxW,
        className,
      )}
    >
      {children}
    </div>
  );
}

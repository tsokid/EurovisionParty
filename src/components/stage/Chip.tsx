import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export type ChipVariant = 'default' | 'gold' | 'live' | 'pink';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
  /** Glowing status dot before the label (used with `live`). */
  dot?: boolean;
  children?: ReactNode;
}

export function Chip({ variant = 'default', dot = false, className, children, ...rest }: ChipProps) {
  return (
    <span className={clsx('chip', variant !== 'default' && `chip-${variant}`, className)} {...rest}>
      {dot && <span className="dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

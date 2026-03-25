import clsx from 'clsx';
import type { ReactNode } from 'react';

type BadgeVariant = 'purple' | 'pink' | 'gold' | 'green' | 'red';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  purple: 'bg-euro-purple/30 text-euro-purple-light border-euro-purple-light/30',
  pink: 'bg-euro-pink/20 text-euro-pink-light border-euro-pink/30',
  gold: 'bg-euro-gold/20 text-euro-gold border-euro-gold/30',
  green: 'bg-euro-green/20 text-euro-green border-euro-green/30',
  red: 'bg-euro-red/20 text-euro-red border-euro-red/30',
};

export default function Badge({ variant = 'purple', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium border',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

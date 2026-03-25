import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'strong';
  glow?: boolean;
  children: ReactNode;
}

export default function Card({
  variant = 'default',
  glow = false,
  children,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl p-4',
        variant === 'strong' ? 'glass-strong' : 'glass',
        glow && 'animate-pulse-glow',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

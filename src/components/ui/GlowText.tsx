import clsx from 'clsx';
import type { ElementType, ReactNode } from 'react';

type GlowColor = 'purple' | 'gold' | 'pink';

interface GlowTextProps {
  children: ReactNode;
  color?: GlowColor;
  as?: ElementType;
  className?: string;
}

const colorMap: Record<GlowColor, { text: string; glow: string }> = {
  purple: { text: 'text-euro-purple-light', glow: 'glow-text' },
  gold: { text: 'text-euro-gold', glow: 'glow-text-gold' },
  pink: { text: 'text-euro-pink', glow: 'glow-text-pink' },
};

export default function GlowText({
  children,
  color = 'purple',
  as: Tag = 'h2',
  className,
}: GlowTextProps) {
  const { text, glow } = colorMap[color];

  return (
    <Tag className={clsx('font-bold tracking-tight', text, glow, className)}>
      {children}
    </Tag>
  );
}

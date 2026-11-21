import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'default' | 'hero' | 'link';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant;
  /** Inner padding (`.card-pad`, 20px → 24px from 768px). Ignored by `link`, which has its own. */
  pad?: boolean;
  /** `link` only: renders an `<a>`. */
  href?: string;
  as?: 'div' | 'section' | 'article' | 'li' | 'aside';
  children?: ReactNode;
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: 'card',
  hero: 'card-hero',
  link: 'card-link',
};

/** Stage surface: `.card`, `.card-hero` (soft stage gradient) or `.card-link` (row with icon). */
export function Card({ variant = 'default', pad = false, href, as = 'div', className, children, ...rest }: CardProps) {
  const cls = clsx(VARIANT_CLASS[variant], pad && variant !== 'link' && 'card-pad', className);
  if (variant === 'link' && href !== undefined) {
    return <a href={href} className={cls} {...(rest as HTMLAttributes<HTMLAnchorElement>)}>{children}</a>;
  }
  const Tag = as;
  return <Tag className={cls} {...rest}>{children}</Tag>;
}

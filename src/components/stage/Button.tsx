import clsx from 'clsx';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width (`.btn-block`). */
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

type AsLink = BaseProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps | 'href'>;
type AsButton = BaseProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps>;
export type ButtonProps = AsLink | AsButton;

export function buttonClass({ variant = 'primary', size = 'md', block = false, className }: Omit<BaseProps, 'children'> = {}): string {
  return clsx('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', className);
}

/**
 * Stage button. Renders `<a>` when `href` is given, otherwise
 * `<button type="button">` (pass `type="submit"` explicitly for forms).
 * One `primary` per screen (ds rule: the gradient is the main CTA only).
 */
export function Button(props: ButtonProps) {
  const { variant, size, block, className, children, ...rest } = props;
  const cls = buttonClass({ variant, size, block, className });
  if (rest.href !== undefined) {
    const anchor = rest as Omit<AsLink, keyof BaseProps>;
    return <a {...anchor} className={cls}>{children}</a>;
  }
  const { type = 'button', ...btn } = rest as Omit<AsButton, keyof BaseProps>;
  return <button {...btn} type={type} className={cls}>{children}</button>;
}

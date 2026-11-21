import clsx from 'clsx';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import LocaleLink from '../seo/LocaleLink';

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

type LocaleLinkProps = ComponentProps<typeof LocaleLink>;

/** In-app route: rendered with LocaleLink (locale prefix, CMS prefetch, client-side navigation). */
type AsRouterLink = BaseProps & { to: string; href?: undefined } & Omit<LocaleLinkProps, keyof BaseProps | 'to'>;
type AsLink = BaseProps & { href: string; to?: undefined } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps | 'href'>;
type AsButton = BaseProps & { href?: undefined; to?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps>;
export type ButtonProps = AsRouterLink | AsLink | AsButton;

export function buttonClass({ variant = 'primary', size = 'md', block = false, className }: Omit<BaseProps, 'children'> = {}): string {
  return clsx('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', className);
}

/**
 * Stage button.
 * - `to`: an app route, rendered with `LocaleLink` (unprefixed path, e.g. `/faq`;
 *   the current locale is added).
 * - `href`: a plain `<a>` (external links, or paths already localized).
 * - neither: `<button type="button">` (pass `type="submit"` explicitly for forms).
 * One `primary` per screen (ds rule: the gradient is the main CTA only).
 */
export function Button(props: ButtonProps) {
  const { variant, size, block, className, children, ...rest } = props;
  const cls = buttonClass({ variant, size, block, className });
  if (rest.to !== undefined) {
    const link = rest as Omit<AsRouterLink, keyof BaseProps>;
    return <LocaleLink {...link} className={cls}>{children}</LocaleLink>;
  }
  if (rest.href !== undefined) {
    const { to: _to, ...anchor } = rest as Omit<AsLink, keyof BaseProps>;
    void _to;
    return <a {...anchor} className={cls}>{children}</a>;
  }
  const { type = 'button', to: _to, ...btn } = rest as Omit<AsButton, keyof BaseProps>;
  void _to;
  return <button {...btn} type={type} className={cls}>{children}</button>;
}

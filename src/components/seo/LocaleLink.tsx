import { Link, type LinkProps } from 'react-router-dom';
import { forwardRef } from 'react';
import { useLocale } from '../../lib/seo/LocaleContext';
import { localizePath } from '../../lib/seo/locale';
import { prefetchPageContent } from '../../lib/cms/prefetchPageContent';

type Props = Omit<LinkProps, 'to'> & { to: string };

const LocaleLink = forwardRef<HTMLAnchorElement, Props>(({ to, onMouseEnter, onFocus, onTouchStart, ...rest }, ref) => {
  const locale = useLocale();
  // Absolute / external / mailto / tel / hash unchanged
  if (/^(https?:|mailto:|tel:|#)/.test(to)) {
    return <Link ref={ref} to={to} onMouseEnter={onMouseEnter} onFocus={onFocus} onTouchStart={onTouchStart} {...rest} />;
  }
  const href = localizePath(locale, to);
  // Warm the target page's CMS doc before the click, so the client-side
  // navigation renders it at once (no pending state). No-op off the registry.
  const prefetch = () => prefetchPageContent(href);
  return (
    <Link
      ref={ref}
      to={href}
      onMouseEnter={(e) => { prefetch(); onMouseEnter?.(e); }}
      onFocus={(e) => { prefetch(); onFocus?.(e); }}
      onTouchStart={(e) => { prefetch(); onTouchStart?.(e); }}
      {...rest}
    />
  );
});
LocaleLink.displayName = 'LocaleLink';
export default LocaleLink;

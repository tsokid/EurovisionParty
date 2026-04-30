import { Link, type LinkProps } from 'react-router-dom';
import { forwardRef } from 'react';
import { useLocale } from '../../lib/seo/LocaleContext';
import { localizePath } from '../../lib/seo/locale';

type Props = Omit<LinkProps, 'to'> & { to: string };

const LocaleLink = forwardRef<HTMLAnchorElement, Props>(({ to, ...rest }, ref) => {
  const locale = useLocale();
  // Absolute / external / mailto / tel / hash unchanged
  if (/^(https?:|mailto:|tel:|#)/.test(to)) {
    return <Link ref={ref} to={to} {...rest} />;
  }
  return <Link ref={ref} to={localizePath(locale, to)} {...rest} />;
});
LocaleLink.displayName = 'LocaleLink';
export default LocaleLink;

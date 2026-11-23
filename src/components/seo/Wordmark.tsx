import { useTranslation } from 'react-i18next';
import LocaleLink from './LocaleLink';
import { useSiteSettings } from '../../lib/cms/siteSettings';

/**
 * Text-only site logo (owner decision, option A): "eurovision.games" in the
 * site font, "vision" in the Stage pink → purple gradient, ".games" lighter.
 * Links home; the accessible name comes from aria-label, the letters are
 * presentational; it is built from the CMS site name (site settings).
 * The Organization logo in JSON-LD stays /logo.png.
 */
export default function Wordmark({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { siteName } = useSiteSettings();
  return (
    <LocaleLink to="/" className={className ? `logo wordmark ${className}` : 'logo wordmark'} aria-label={t('siteNav.homeAria', { siteName })}>
      <span aria-hidden="true">euro<span className="wordmark-grad">vision</span><span className="wordmark-tld">.games</span></span>
    </LocaleLink>
  );
}

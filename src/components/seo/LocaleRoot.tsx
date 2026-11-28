import { useEffect } from 'react';
import { Outlet, useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isLocale } from '../../lib/seo/locale';
import { LocaleProvider } from '../../lib/seo/LocaleContext';
import SiteHeader from './SiteHeader';
import BetaBanner from './BetaBanner';
import ScrollToTop from './ScrollToTop';
import BackToTop from './BackToTop';
import CookieConsent from '../cookie/CookieConsent';

export default function LocaleRoot() {
  const params = useParams<{ locale: string }>();
  const { i18n } = useTranslation();

  // Hooks must run unconditionally — call effect even if locale will redirect.
  // Effect checks locale validity itself.
  useEffect(() => {
    if (isLocale(params.locale) && i18n.language !== params.locale) {
      i18n.changeLanguage(params.locale);
    }
    if (isLocale(params.locale)) {
      document.documentElement.lang = params.locale;
    }
  }, [params.locale, i18n]);

  if (!isLocale(params.locale)) {
    return <Navigate to="/en" replace />;
  }

  return (
    <LocaleProvider locale={params.locale}>
      {/* Stage ground behind every public page (game screens live outside, under /room). */}
      <div className="stage-root">
        <ScrollToTop />
        <BetaBanner />
        <SiteHeader />
        {/* The page's own content is the main landmark (28 Nov 2026). The
            footer each page renders inside it keeps role="contentinfo". */}
        <main id="main">
          <Outlet />
        </main>
        <BackToTop />
        <CookieConsent />
      </div>
    </LocaleProvider>
  );
}

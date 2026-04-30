import { Navigate, useLocation } from 'react-router-dom';
import { detectLocale, localizePath, type Locale } from '../../lib/seo/locale';

const STORAGE_KEY = 'europarty-lang';

function readStored(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export default function LocaleRedirect() {
  const { pathname, search, hash } = useLocation();
  const locale: Locale = detectLocale({
    stored: readStored(),
    browser: typeof navigator !== 'undefined' ? navigator.language : null,
  });
  const target = localizePath(locale, pathname) + search + hash;
  return <Navigate to={target} replace />;
}

import { createContext, useContext, type ReactNode } from 'react';
import i18n from '../../i18n';
import { isLocale, type Locale } from './locale';

const Ctx = createContext<Locale | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

/**
 * Returns the current Locale.
 *
 * Inside LocaleRoot (every public /:locale/* route) the value comes from
 * the URL-driven Provider. Outside the public tree — in /room/:code and
 * /admin where there is no Provider — we fall back to the current
 * i18next language (which itself initialises from localStorage and the
 * browser's navigator.language).
 *
 * This used to throw outside of a Provider, which crashed the in-room
 * LanguageSwitcher (mounted by Header / LobbyScreen). The fallback is
 * the right shape for those contexts since URL-driven locale doesn't
 * apply to room/admin paths.
 */
export function useLocale(): Locale {
  const v = useContext(Ctx);
  if (v) return v;
  const fallback = i18n.language?.slice(0, 2)?.toLowerCase();
  return isLocale(fallback) ? fallback : 'en';
}

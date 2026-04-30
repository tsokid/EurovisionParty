import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from './locale';

const Ctx = createContext<Locale | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale(): Locale {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLocale must be used inside <LocaleProvider>');
  return v;
}

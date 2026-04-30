import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'eurovision-beta-banner-dismissed';

// Slim global strip above the SiteHeader signalling that the site is in beta.
// Dismissible — once a user closes it, the choice is remembered in
// localStorage. The banner is part of LocaleRoot so it shows across every
// public page (not in /room/:code or /admin which own their own chrome).
export default function BetaBanner() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      setOpen(dismissed !== '1');
    } catch {
      // Private browsing / storage blocked — show by default
      setOpen(true);
    }
  }, []);

  function dismiss() {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
  }

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative z-50 bg-gradient-to-r from-euro-purple/40 via-euro-pink/40 to-euro-purple/40 border-b border-white/10"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3 text-[12.5px] sm:text-sm">
        <span className="text-base shrink-0" aria-hidden>🧪</span>
        <p className="text-white/90 leading-snug flex-1">
          <span className="font-bold text-white">{t('betaBanner.label', { defaultValue: 'Beta' })}</span>
          <span className="hidden sm:inline">
            {' — '}
            {t('betaBanner.body', {
              defaultValue: 'Eurovision Games is in active development. Expect rapid changes.',
            })}
          </span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('betaBanner.dismiss', { defaultValue: 'Dismiss beta banner' })}
          className="shrink-0 w-6 h-6 rounded-full text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

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
    <div role="status" aria-live="polite" className="betabar">
      <div className="wrap betabar-row">
        <span className="dot text-stage-pink-2" aria-hidden />
        <p className="leading-snug flex-1 m-0">
          <span className="font-bold text-stage-text">{t('betaBanner.label', { defaultValue: 'Beta' })}</span>
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
          className="shrink-0 w-8 h-8 rounded-full text-stage-text-2 hover:text-stage-text hover:bg-stage-surface-2 flex items-center justify-center cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

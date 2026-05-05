import { useEffect } from 'react';
import * as CookieConsentAPI from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import { config } from './cookieconsent.config';
import { useLocale } from '../../lib/seo/LocaleContext';

const CSS_OVERRIDE = `
  :root {
    --cc-bg: #1a0533;
    --cc-primary-color: #a855f7;
    --cc-btn-primary-bg: #6d28d9;
    --cc-btn-primary-hover-bg: #5b21b6;
    --cc-btn-primary-color: #ffffff;
    --cc-btn-secondary-bg: rgba(255,255,255,0.08);
    --cc-btn-secondary-hover-bg: rgba(255,255,255,0.14);
    --cc-btn-secondary-color: #ede9f5;
    --cc-text: rgba(237,233,245,0.92);
    --cc-title-color: #ede9f5;
    --cc-border-color: rgba(255,255,255,0.10);
    --cc-toggle-bg-on: #6d28d9;
    --cc-toggle-bg-off: rgba(255,255,255,0.12);
    --cc-overlay-bg: rgba(10,4,24,0.72);
    --cc-footer-color: rgba(237,233,245,0.70);
    --cc-link-color: #c084fc;
    --cc-separator-border-color: rgba(255,255,255,0.08);
  }
`;

export default function CookieConsent() {
  const locale = useLocale();

  useEffect(() => {
    const styleId = 'cc-theme-override';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = CSS_OVERRIDE;
      document.head.appendChild(style);
    }
    CookieConsentAPI.run({ ...config, language: { ...config.language, default: locale } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    CookieConsentAPI.setLanguage(locale);
  }, [locale]);

  return null;
}

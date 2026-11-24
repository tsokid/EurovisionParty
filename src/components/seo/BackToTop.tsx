import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './StageKit';

// Discreet "back to top" button for long public pages (owner, 24 Nov 2026).
// It shows only on pages at least 3 screens tall, once the reader has scrolled
// past the first 1.2 screens. Nothing is rendered until then, so the
// prerendered HTML (and the SEO) is unchanged.
export const LONG_PAGE_SCREENS = 3;
export const SHOW_AFTER_SCREENS = 1.2;

export function shouldShowBackToTop(scrollY: number, viewport: number, pageHeight: number): boolean {
  if (viewport <= 0) return false;
  return pageHeight >= viewport * LONG_PAGE_SCREENS && scrollY >= viewport * SHOW_AFTER_SCREENS;
}

export default function BackToTop() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      setVisible(shouldShowBackToTop(window.scrollY, window.innerHeight, document.documentElement.scrollHeight));
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  if (!visible) return null;

  const toTop = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button type="button" className="back-top" onClick={toTop} aria-label={t('common.backToTop')} title={t('common.backToTop')}>
      <Icon name="chevron" size={20} className="back-top-ico" />
    </button>
  );
}

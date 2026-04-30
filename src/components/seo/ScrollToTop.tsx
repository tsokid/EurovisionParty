import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// On route change, scroll to top of the new page. If the URL contains a hash
// (e.g. /faq#create), scroll to that element instead — preserves anchored
// deep links like the footer FAQ shortcuts. Uses requestAnimationFrame so the
// destination DOM is mounted before we measure / scroll.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      if (hash) {
        const el = document.getElementById(hash.slice(1));
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
          return;
        }
      }
      window.scrollTo(0, 0);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [pathname, hash]);

  return null;
}

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
        // Decode: non-Latin anchors (the Greek A–Ω index) arrive percent-encoded.
        let id = hash.slice(1);
        try { id = decodeURIComponent(id); } catch { /* malformed: use as is */ }
        const el = document.getElementById(id);
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

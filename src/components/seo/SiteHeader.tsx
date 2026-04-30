import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const NAV = [
  { href: '/how-to-play', label: 'How to play' },
  { href: '/eurovision-night', label: 'Eurovision night' },
  { href: '/eurovision-2026-predictions', label: '2026 predictions' },
  { href: '/eurovision-trivia', label: 'Trivia' },
  { href: '/faq', label: 'FAQ' },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-euro-deep/80 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group" aria-label="Eurovision Games — home">
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-euro-purple-light to-euro-pink shadow-lg shadow-euro-pink/20 flex items-center justify-center text-white text-sm" aria-hidden>✦</span>
          <span className="font-bold text-white tracking-tight group-hover:text-euro-pink-light transition">Eurovision Games</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                to={n.href}
                className={`px-3 py-1.5 rounded-full text-sm transition ${
                  active ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          <Link
            to="/"
            className="ml-2 px-4 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-euro-purple-light to-euro-pink text-white hover:opacity-95 transition"
          >
            Create room
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="site-drawer"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 text-white hover:bg-white/5 transition"
        >
          {open ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div
          id="site-drawer"
          className="lg:hidden border-t border-white/10 bg-euro-deep"
        >
          <nav className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-1" aria-label="Mobile">
            {NAV.map((n) => (
              <Link
                key={n.href}
                to={n.href}
                className="px-3 py-3 rounded-lg text-white/85 hover:bg-white/5 transition"
              >
                {n.label}
              </Link>
            ))}
            <Link
              to="/rules"
              className="px-3 py-3 rounded-lg text-white/85 hover:bg-white/5 transition"
            >
              Rules
            </Link>
            <Link
              to="/scoring"
              className="px-3 py-3 rounded-lg text-white/85 hover:bg-white/5 transition"
            >
              Scoring
            </Link>
            <Link
              to="/"
              className="mt-2 px-4 py-3 rounded-full text-center font-bold bg-gradient-to-r from-euro-purple-light to-euro-pink text-white"
            >
              Create a room
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

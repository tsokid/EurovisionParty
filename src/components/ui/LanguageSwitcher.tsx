import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type LangCode = 'en' | 'el';

interface Lang {
  code: LangCode;
  flag: string;
  label: string;
}

const LANGS: Lang[] = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'el', flag: '🇬🇷', label: 'Ελληνικά' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const current = LANGS.find((l) => l.code === i18n.language) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [open]);

  const select = (code: LangCode) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
        className="flex items-center gap-1 pl-1.5 pr-1 py-1 rounded-full border border-white/15 bg-white/[0.06] hover:bg-white/[0.10] hover:border-white/25 transition cursor-pointer min-h-[34px]"
      >
        <span className="text-base leading-none" aria-hidden>{current.flag}</span>
        <svg
          className={`w-3.5 h-3.5 text-white/60 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Language"
          className="absolute right-0 top-full mt-2 min-w-[180px] rounded-xl border border-white/10 bg-euro-deep/95 backdrop-blur-md shadow-xl shadow-black/40 py-1.5 z-50"
        >
          {LANGS.map((l) => {
            const active = l.code === current.code;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(l.code)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition cursor-pointer ${
                  active ? 'bg-white/[0.06] text-white' : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-lg leading-none" aria-hidden>{l.flag}</span>
                <span className="text-sm font-semibold uppercase tracking-wide flex-1">{l.label}</span>
                {active && (
                  <svg className="w-4 h-4 text-euro-green shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

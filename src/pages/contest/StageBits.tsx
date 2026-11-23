/** Small Stage blocks shared by the archive, country and winners pages. */
import type { ReactNode } from 'react';
import LocaleLink from '../../components/seo/LocaleLink';

const ICONS = {
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></>,
} as const;

export const Chevron = ({ dir = 'right' }: { dir?: 'right' | 'left' }) => (
  <svg className="lc-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={dir === 'right' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
  </svg>
);

/** Aside link card: icon, title, one line, chevron (board `.card-link`). */
export function LinkCard({ to, icon, title, blurb }: { to: string; icon: keyof typeof ICONS; title: ReactNode; blurb: ReactNode }) {
  return (
    <LocaleLink to={to} className="card-link lc">
      <span className="ico">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {ICONS[icon]}
        </svg>
      </span>
      <span className="lc-body">
        <span className="lc-title">{title}</span>
        <span className="t-small">{blurb}</span>
      </span>
      <Chevron />
    </LocaleLink>
  );
}

/** One decade block: numeral-font heading (h3), a meta line, then its table. */
export function DecadeBlock({ id, label, meta, children }: { id: string; label: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="dec" aria-labelledby={`${id}-h`}>
      <div className="dec-head">
        <h3 id={`${id}-h`} className="num dec-title">{label}</h3>
        {meta && <span className="t-meta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

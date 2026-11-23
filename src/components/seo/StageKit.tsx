/**
 * Small Stage building blocks shared by the package-2 content pages (FAQ,
 * night, rules, scoring, legal, games/party/trivia/duels/dashboard, 404):
 * line icons from the boards, check-mark lists, numbered guide sections and
 * the "on this page" menu (sticky `.seg` on phones, left TOC card on desktop).
 */
import type { ReactNode } from 'react';
import LocaleLink from './LocaleLink';

const PATHS = {
  home: <path d="M4 11l8-7 8 7v9H4zM10 20v-5h4v5" />,
  wifi: <path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" />,
  play: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l6-3.5z" /></>,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  list: <path d="M4 6h16M4 12h10M4 18h7" />,
  swords: <path d="M5 19 19 5M14 5h5v5M5 5l5 5M14 14l5 5" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  music: <path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z" />,
  chart: <path d="M7 21V11M12 21V4M17 21v-6" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  calc: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></>,
  tv: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M8 21h8M9 2l3 4 3-4" /></>,
  food: <path d="M5 3v8a3 3 0 0 0 6 0V3M8 3v18M16 3c-2 2-2 7 0 9v9" />,
  mic: <path d="M12 3a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4zM5 11a7 7 0 0 0 14 0M12 18v3" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>,
  steal: <path d="M7 17 17 7M9 7h8v8" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12l5 5L20 7" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

/** Rounded icon box (`.ico`). */
export const IconBox = ({ name, size = 20 }: { name: IconName; size?: number }) => (
  <span className="ico"><Icon name={name} size={size} /></span>
);

export const Tick = () => <Icon name="check" size={18} className="tick" />;

/** Check-mark list: bold lead-in, then the rest of the sentence (plain text). */
export function Ticks({ items, tone }: { items: { strong: string; rest: string }[]; tone?: 'x' }) {
  return (
    <ul className={tone === 'x' ? 'ticks ticks-x' : 'ticks'}>
      {items.map((it, i) => (
        <li key={i}>
          {tone === 'x' ? <Icon name="x" size={18} className="tick" /> : <Tick />}
          <span>
            <strong>{it.strong}</strong>{' '}
            {it.rest}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One numbered guide section (howto/rules boards): eyebrow, H2, intro, body. */
export function GuideSection({ id, n, eyebrow, title, intro, children, className }: {
  id: string;
  n?: number;
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const k = n != null ? `${String(n).padStart(2, '0')}${eyebrow ? ` · ${eyebrow}` : ''}` : eyebrow;
  return (
    <section id={id} className={`cs guide-sec${className ? ` ${className}` : ''}`} aria-labelledby={`${id}-h`}>
      <div className="guide-head">
        {k && <span className="t-eyebrow">{k}</span>}
        <h2 id={`${id}-h`} className="t-h2 text-stage-text">{title}</h2>
        {intro && <p className="t-body">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

export interface TocItem {
  id: string;
  title: string;
  /** Right-hand meta (FAQ: number of questions). */
  count?: number;
  icon?: IconName;
}

/** Sticky in-page `.seg` for phones (hidden from 1024px). */
export function TocSeg({ label, items }: { label: string; items: TocItem[] }) {
  return (
    <div className="howto-seg">
      <nav aria-label={label} className="seg wrap-seg">
        {items.map((s) => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
      </nav>
    </div>
  );
}

/** Desktop TOC card: numbered (rules/howto) or with icons and counts (FAQ). */
export function TocCard({ label, items, numbered = true }: { label: string; items: TocItem[]; numbered?: boolean }) {
  return (
    <nav aria-label={label} className="card toc">
      <span className="t-eyebrow toc-k">{label}</span>
      {items.map((s, i) => (
        <a key={s.id} href={`#${s.id}`}>
          {s.icon ? <Icon name={s.icon} size={16} className="toc-ico" /> : numbered && <span className="num">{String(i + 1).padStart(2, '0')}</span>}
          <span className="toc-t">{s.title}</span>
          {s.count != null && <span className="num toc-n">{s.count}</span>}
        </a>
      ))}
    </nav>
  );
}

/** Icon card link (board `.card-link` with `.ico`, title, one line, chevron). */
export function IconLink({ to, icon, title, blurb, headingLevel = 3 }: {
  to: string;
  icon: IconName;
  title: ReactNode;
  blurb?: ReactNode;
  headingLevel?: 3 | 0;
}) {
  return (
    <LocaleLink to={to} className="card-link lc">
      <IconBox name={icon} />
      <span className="lc-body">
        {headingLevel === 3 ? <h3 className="lc-title">{title}</h3> : <span className="lc-title">{title}</span>}
        {blurb && <span className="t-small">{blurb}</span>}
      </span>
      <Icon name="chevron" size={18} className="lc-chev" />
    </LocaleLink>
  );
}

/** Plain aside link list (FAQ «Για λεπτομέρειες», scoring aside). */
export function SideLinks({ label, items }: { label?: string; items: { href: string; title: string }[] }) {
  return (
    <nav aria-label={label} className="side-links">
      {label && <span className="t-eyebrow">{label}</span>}
      <ul>
        {items.map((it) => (
          <li key={it.href}>
            <LocaleLink to={it.href}>
              <span>{it.title}</span>
              <Icon name="chevron" size={16} />
            </LocaleLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Hero stat tiles (numeral-font value + label), `tone` colours the value. */
export function HeroStats({ items }: { items: { v: ReactNode; k: ReactNode; tone?: 'gold' | 'pink' }[] }) {
  return (
    <dl className="kit-stats">
      {items.map((s, i) => (
        <div key={i} className="stat">
          <dt className="k">{s.k}</dt>
          <dd className={`v num${s.tone ? ` text-stage-${s.tone === 'gold' ? 'gold' : 'pink-2'}` : ''}`}>{s.v}</dd>
        </div>
      ))}
    </dl>
  );
}

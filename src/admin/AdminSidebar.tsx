// The admin's left nav, organised like the site (spec §3): Site (Header,
// Footer and its columns, Pages grouped by where they appear), Contests,
// Game, Media, Settings. Screens whose content is not CMS-backed yet carry
// the phase they arrive in. Every entry is a link, so it opens in a new tab,
// and the active one follows the URL.
import clsx from 'clsx';
import { useState, type ComponentType } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity, Award, CalendarDays, ChevronRight, FileText, Image, LayoutDashboard,
  PanelBottom, PanelTop, Radar, Settings, Shield, Smile,
} from 'lucide-react';
import { adminPaths } from './paths';
import { docLabel, footerColumns, pageGroups } from './siteStructure';
import { t } from './i18n';

type Icon = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;

interface Item {
  label: string;
  to: string;
  icon: Icon;
  /** Only exact matches are active. */
  end?: boolean;
  /** Not CMS-backed yet: the phase it arrives in. */
  later?: string;
}

const SECTIONS: Array<{ title: string; items: Item[] }> = [
  {
    title: t.nav.contests,
    items: [{ label: t.nav.yearsEntries, to: adminPaths.contests(), icon: CalendarDays }],
  },
  {
    title: t.nav.game,
    items: [
      { label: t.nav.monitor, to: adminPaths.monitor(), icon: Activity },
      { label: t.nav.parser, to: adminPaths.parser(), icon: Radar },
      { label: t.nav.winners, to: adminPaths.winners(), icon: Award },
      { label: t.nav.avatars, to: adminPaths.avatars(), icon: Smile },
    ],
  },
  {
    title: t.nav.media,
    items: [{ label: t.nav.mediaLibrary, to: adminPaths.media(), icon: Image, later: 'P6' }],
  },
  {
    title: t.nav.settings,
    items: [
      { label: t.nav.siteSettings, to: adminPaths.settings(), icon: Settings, end: true },
      { label: t.nav.admins, to: adminPaths.admins(), icon: Shield },
    ],
  },
];

const ROW = 'flex items-center gap-2.5 rounded-stage-sm px-2.5 min-h-9 text-sm transition-colors';
const rowClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    ROW,
    isActive
      ? 'bg-stage-surface-2 text-stage-text font-semibold'
      : 'text-stage-text-2 hover:bg-stage-surface hover:text-stage-text',
  );

function Later({ phase }: { phase: string }) {
  return (
    <span className="ml-auto rounded-stage-pill border border-stage-line px-1.5 text-[11px] leading-5 text-stage-text-3" title={t.shell.comingIn(phase)}>
      {phase}
    </span>
  );
}

function NavItem({ item }: { item: Item }) {
  const { icon: I } = item;
  return (
    <NavLink to={item.to} end={item.end} className={rowClass}>
      <I size={16} aria-hidden className="shrink-0 text-stage-text-3" />
      <span className="truncate">{item.label}</span>
      {item.later && <Later phase={item.later} />}
    </NavLink>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="t-eyebrow px-2.5 pt-5 pb-1.5 text-[11px]">{children}</h2>;
}

/** Pages, grouped by where they appear; the group of the open page starts expanded. */
function PagesTree() {
  const { pathname } = useLocation();
  const groups = pageGroups();
  const activeDoc = /^\/admin\/pages\/([^/]+)(?:\/history(?:\/[^/]+)?)?$/.exec(pathname)?.[1];
  const active = activeDoc ? decodeURIComponent(activeDoc) : null;
  // A group is open when the user opened it, or (until they close it) when it holds the open page.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(new Map());
  const isOpen = (key: string, docIds: string[]) => toggled.get(key) ?? (!!active && docIds.includes(active));
  const toggle = (key: string, docIds: string[]) =>
    setToggled((prev) => new Map(prev).set(key, !isOpen(key, docIds)));

  return (
    <ul className="ml-[18px] border-l border-stage-line pl-2 mt-0.5 space-y-0.5">
      {groups.map((g) => {
        const expanded = isOpen(g.key, g.docIds);
        const id = `admin-nav-pages-${g.key.replace(/[^a-z-]/g, '-')}`;
        return (
          <li key={g.key}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={id}
              onClick={() => toggle(g.key, g.docIds)}
              className={clsx(ROW, 'w-full text-left text-stage-text-3 hover:text-stage-text cursor-pointer')}
            >
              <ChevronRight size={14} aria-hidden className={clsx('shrink-0 transition-transform', expanded && 'rotate-90')} />
              <span className="truncate">{g.title}</span>
              <span className="ml-auto text-[11px] text-stage-text-3">{g.docIds.length}</span>
            </button>
            {expanded && (
              <ul id={id} className="ml-[18px] space-y-0.5">
                {g.docIds.map((docId) => (
                  <li key={docId}>
                    <NavLink to={adminPaths.pages(docId)} className={rowClass}>
                      <span className="truncate">{docLabel(docId)}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminSidebar() {
  const { pathname } = useLocation();
  const inFooter = pathname === adminPaths.footer() || pathname.startsWith(`${adminPaths.footer()}/`);

  return (
    <nav aria-label={t.shell.nav} className="px-3 pb-6">
      <div className="pt-3">
        <NavItem item={{ label: t.nav.overview, to: adminPaths.overview(), icon: LayoutDashboard, end: true }} />
      </div>

      <SectionTitle>{t.nav.site}</SectionTitle>
      <ul className="space-y-0.5">
        <li><NavItem item={{ label: t.nav.header, to: adminPaths.header(), icon: PanelTop }} /></li>
        <li>
          <NavItem item={{ label: t.nav.footer, to: adminPaths.footer(), icon: PanelBottom, end: true }} />
          {inFooter && (
            <ul className="ml-[18px] border-l border-stage-line pl-2 mt-0.5 space-y-0.5">
              {footerColumns().map((c) => (
                <li key={c.key}>
                  <NavLink to={adminPaths.footer(c.key)} className={rowClass}>
                    <span className="truncate">{c.title}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </li>
        <li>
          <NavItem item={{ label: t.nav.pages, to: adminPaths.pages(), icon: FileText, end: true }} />
          <PagesTree />
        </li>
      </ul>

      {SECTIONS.map((s) => (
        <div key={s.title}>
          <SectionTitle>{s.title}</SectionTitle>
          <ul className="space-y-0.5">
            {s.items.map((item) => (
              <li key={item.to}><NavItem item={item} /></li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

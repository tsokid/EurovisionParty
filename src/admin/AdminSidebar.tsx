// The admin's left nav, organised like the site (spec §3): Site (Header,
// Footer and its columns, Pages grouped by where they appear), Contests,
// Game, Media, Settings. Screens whose content is not CMS-backed yet carry
// the phase they arrive in. Every entry is a link, so it opens in a new tab,
// and the active one follows the URL.
//
// Every section, and the Pages list, opens and closes (28 Nov 2026, the
// owner: "I can't have them all open all the time"). The section of the
// open screen starts open; what the owner opens or closes is remembered on
// this browser.
import clsx from 'clsx';
import { useCallback, useState, type ComponentType, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity, Award, CalendarDays, ChevronRight, FileText, Image, LayoutDashboard,
  MessageCircleQuestionMark, PanelBottom, PanelTop, Radar, Rocket, Settings, Shield, Smile,
} from 'lucide-react';
import { adminPaths } from './paths';
import { docLabel, footerColumns, pageGroups } from './siteStructure';
import { t } from './i18n';
import { hasGaps, useTranslationGaps, type Gaps } from './cms/translationStatus';

/** The tree-level translation flag (CMS P6): a red dot on a doc missing EN or EL. */
function GapDot({ gaps, label }: { gaps?: Gaps; label?: string }) {
  if (!hasGaps(gaps) && !label) return null;
  const text = label ?? t.translations.treeMissing(gaps!.en, gaps!.el);
  return (
    <span className="ml-auto inline-block size-2 shrink-0 rounded-full bg-stage-bad" title={text} data-testid="tree-missing">
      <span className="sr-only">{text}</span>
    </span>
  );
}

type Icon = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;

interface Item {
  label: string;
  to: string;
  icon: Icon;
  /** A CMS doc behind the screen: its translation flag shows. */
  docId?: string;
  /** Only exact matches are active. */
  end?: boolean;
  /** Not CMS-backed yet: the phase it arrives in. */
  later?: string;
}

const SECTIONS: Array<{ key: string; title: string; items: Item[] }> = [
  {
    key: 'contests',
    title: t.nav.contests,
    items: [{ label: t.nav.yearsEntries, to: adminPaths.contests(), icon: CalendarDays }],
  },
  {
    key: 'game',
    title: t.nav.game,
    items: [
      { label: t.nav.monitor, to: adminPaths.monitor(), icon: Activity },
      { label: t.nav.questions, to: adminPaths.questions(), icon: MessageCircleQuestionMark },
      { label: t.nav.parser, to: adminPaths.parser(), icon: Radar },
      { label: t.nav.winners, to: adminPaths.winners(), icon: Award },
      { label: t.nav.avatars, to: adminPaths.avatars(), icon: Smile },
    ],
  },
  {
    key: 'media',
    title: t.nav.media,
    items: [{ label: t.nav.mediaLibrary, to: adminPaths.media(), icon: Image }],
  },
  {
    key: 'settings',
    title: t.nav.settings,
    items: [
      { label: t.nav.siteSettings, to: adminPaths.settings(), icon: Settings, end: true, docId: 'site-settings' },
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
  const gaps = useTranslationGaps();
  return (
    <NavLink to={item.to} end={item.end} className={rowClass}>
      <I size={16} aria-hidden className="shrink-0 text-stage-text-3" />
      <span className="truncate">{item.label}</span>
      {item.later && <Later phase={item.later} />}
      {item.docId && <GapDot gaps={gaps.get(item.docId)} />}
    </NavLink>
  );
}

// ── Open / closed, remembered per browser ──────────────────────────────
const STORE_KEY = 'admin-nav-open';
function readOpen(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, boolean>; } catch { return {}; }
}
function useOpenState() {
  const [open, setOpen] = useState<Record<string, boolean>>(readOpen);
  const isOpen = useCallback((key: string, fallback: boolean) => open[key] ?? fallback, [open]);
  const toggle = useCallback((key: string, fallback: boolean) => {
    setOpen((prev) => {
      const next = { ...prev, [key]: !(prev[key] ?? fallback) };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);
  return { isOpen, toggle };
}

/** A section heading that opens and closes its list. */
function Section({ id, title, expanded, onToggle, children }: {
  id: string; title: string; expanded: boolean; onToggle: () => void; children: ReactNode;
}) {
  const listId = `admin-nav-${id}`;
  return (
    <div>
      <h2 className="pt-5 pb-1.5">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={onToggle}
          className="t-eyebrow flex w-full items-center gap-1.5 rounded-stage-sm px-2.5 text-left text-[11px] hover:text-stage-text cursor-pointer"
        >
          <ChevronRight size={12} aria-hidden className={clsx('shrink-0 transition-transform', expanded && 'rotate-90')} />
          {title}
        </button>
      </h2>
      {expanded && <div id={listId}>{children}</div>}
    </div>
  );
}

/** Pages, grouped by where they appear; the group of the open page starts expanded. */
function PagesTree() {
  const { pathname } = useLocation();
  const groups = pageGroups();
  const gaps = useTranslationGaps();
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
              {g.docIds.some((d) => hasGaps(gaps.get(d))) && <GapDot label={t.translations.groupMissing} />}
              <span className={clsx('text-[11px] text-stage-text-3', !g.docIds.some((d) => hasGaps(gaps.get(d))) && 'ml-auto')}>{g.docIds.length}</span>
            </button>
            {expanded && (
              <ul id={id} className="ml-[18px] space-y-0.5">
                {g.docIds.map((docId) => (
                  <li key={docId}>
                    <NavLink to={adminPaths.pages(docId)} className={rowClass}>
                      <span className="truncate">{docLabel(docId)}</span>
                      <GapDot gaps={gaps.get(docId)} />
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

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

export default function AdminSidebar() {
  const { pathname } = useLocation();
  const inFooter = under(pathname, adminPaths.footer());
  const inPages = under(pathname, adminPaths.pages());
  const inSite = inFooter || inPages || under(pathname, adminPaths.header());
  const { isOpen, toggle } = useOpenState();
  const siteOpen = isOpen('site', inSite);
  const pagesOpen = isOpen('pages', inPages);

  return (
    <nav aria-label={t.shell.nav} className="px-3 pb-6">
      <div className="pt-3">
        <NavItem item={{ label: t.nav.overview, to: adminPaths.overview(), icon: LayoutDashboard, end: true }} />
        <NavItem item={{ label: t.nav.publish, to: adminPaths.publish(), icon: Rocket }} />
      </div>

      <Section id="site" title={t.nav.site} expanded={siteOpen} onToggle={() => toggle('site', inSite)}>
      <ul className="space-y-0.5">
        <li><NavItem item={{ label: t.nav.header, to: adminPaths.header(), icon: PanelTop, docId: 'site-header' }} /></li>
        <li>
          <NavItem item={{ label: t.nav.footer, to: adminPaths.footer(), icon: PanelBottom, end: true, docId: 'site-footer' }} />
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
          <div className="flex items-center">
            <div className="min-w-0 flex-1">
              <NavItem item={{ label: t.nav.pages, to: adminPaths.pages(), icon: FileText, end: true }} />
            </div>
            <button
              type="button"
              aria-expanded={pagesOpen}
              aria-controls="admin-nav-pages-tree"
              aria-label={t.nav.pages}
              onClick={() => toggle('pages', inPages)}
              className="grid size-9 shrink-0 place-items-center rounded-stage-sm text-stage-text-3 hover:bg-stage-surface hover:text-stage-text cursor-pointer"
            >
              <ChevronRight size={14} aria-hidden className={clsx('transition-transform', pagesOpen && 'rotate-90')} />
            </button>
          </div>
          {pagesOpen && <div id="admin-nav-pages-tree"><PagesTree /></div>}
        </li>
      </ul>
      </Section>

      {SECTIONS.map((s) => {
        const here = s.items.some((item) => under(pathname, item.to));
        return (
          <Section key={s.key} id={s.key} title={s.title} expanded={isOpen(s.key, here)} onToggle={() => toggle(s.key, here)}>
            <ul className="space-y-0.5">
              {s.items.map((item) => (
                <li key={item.to}><NavItem item={item} /></li>
              ))}
            </ul>
          </Section>
        );
      })}
    </nav>
  );
}

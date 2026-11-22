// The routed screens of the admin (spec §3 URL map). Each one reads its item
// from the URL, sets the breadcrumb, and renders the existing module with
// the selection passed in; the modules themselves are unchanged inside.
// One pattern per module (`contests/*`, `pages/*`, …) keeps the module
// mounted while its item changes, as when the selection was local state.
//
// The screens are matched here on the full pathname (matchPath), not with
// descendant <Routes>: the app's route table opens the admin through several
// patterns (ADMIN_ROUTE_PATTERNS in routeConfig.tsx), and descendant routes
// would be relative to whichever one matched.
import type { ComponentType, ReactNode } from 'react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import Contests from './modules/Contests';
import Pages from './modules/Pages';
import Winners from './modules/Winners';
import EurovisionParser from './modules/EurovisionParser';
import PhaseMonitor from './modules/PhaseMonitor';
import SuperAdmins from './modules/SuperAdmins';
import { PublishBar } from './modules/contests/PublishBar';
import { usePublisher } from './modules/contests/publish';
import { PUBLISH_PAGES_TEXT, SITE_PAGES } from './modules/pages/sitePages';
import { editorialTitle } from './modules/pages/editorialPages';
import { isEditorialDocId } from '../../supabase/functions/_shared/cms/pagesIndex';
import { useAdminCrumbs, useAdminLive, type Crumb } from './adminMeta';
import { adminPaths, parseContestRoute, parseYear, splatSegments } from './paths';
import HeaderEditor from './modules/site/HeaderEditor';
import FooterEditor, { COLUMN_TITLE } from './modules/site/FooterEditor';
import SettingsEditor from './modules/site/SettingsEditor';
import AvatarsLibrary from './modules/avatars/AvatarsLibrary';
import { FOOTER_COLUMN_KEYS, type FooterColumnKey } from './paths';
import { footerColumn } from './siteStructure';

const LINK = 'text-stage-pink-2 hover:underline';
const NOT_FOUND: Crumb[] = [{ label: 'Not found' }];

function ScreenTitle({ title, lede }: { title: string; lede?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold text-stage-text m-0">{title}</h1>
      {lede && <p className="t-small mt-1.5 max-w-2xl">{lede}</p>}
    </header>
  );
}

/** A screen whose content becomes editable in a later phase: says so, and what exists today. */
function Later({ title, phase, crumbs, children }: { title: string; phase: string; crumbs: Crumb[]; children: ReactNode }) {
  useAdminCrumbs(crumbs);
  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold text-stage-text m-0">{title}</h1>
        <span className="chip">Coming in {phase}</span>
      </div>
      <div className="card card-pad space-y-3 t-small">{children}</div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────
const START: Array<{ to: string; title: string; text: string }> = [
  { to: adminPaths.pages(), title: 'Pages', text: 'The copy of every site page, in English and Greek.' },
  { to: adminPaths.contests(), title: 'Contests', text: 'Contest years, their lifecycle and entries.' },
  { to: adminPaths.parser(), title: 'Parser & controls', text: 'Parse participants and results, move the rooms.' },
  { to: adminPaths.monitor(), title: 'Room phases', text: 'Every room and the phase it is in.' },
];

function Overview() {
  useAdminCrumbs([{ label: 'Overview' }]);
  const publisher = usePublisher();
  return (
    <div className="max-w-4xl space-y-5">
      <ScreenTitle title="Overview" />
      <PublishBar publisher={publisher} />
      <p className="text-xs text-white/50 max-w-2xl">{PUBLISH_PAGES_TEXT}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {START.map((s) => (
          <li key={s.to}>
            <Link to={s.to} className="card card-pad block h-full hover:border-stage-line-2 transition-colors">
              <span className="block font-semibold text-stage-text">{s.title}</span>
              <span className="t-small block mt-1">{s.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Site ─────────────────────────────────────────────────────────────
function HeaderScreen() {
  useAdminCrumbs([{ label: 'Site' }, { label: 'Header' }]);
  useAdminLive('/');
  return <HeaderEditor />;
}

type ScreenProps = { splat?: string };

function FooterScreen({ splat }: ScreenProps) {
  const [key, ...rest] = splatSegments(splat);
  const column = key === undefined ? null : (FOOTER_COLUMN_KEYS as readonly string[]).includes(key) ? (key as FooterColumnKey) : undefined;
  const valid = column !== undefined && rest.length === 0;
  useAdminCrumbs(!valid ? NOT_FOUND : column
    ? [{ label: 'Site' }, { label: 'Footer', to: adminPaths.footer() }, { label: footerColumn(column)?.title ?? COLUMN_TITLE[column] }]
    : [{ label: 'Site' }, { label: 'Footer' }]);
  useAdminLive(valid ? '/' : null);
  if (!valid) return <NotFound />;
  return <FooterEditor key={column ?? 'all'} column={column} />;
}

function PagesScreen({ splat }: ScreenProps) {
  const navigate = useNavigate();
  const parts = splatSegments(splat);
  const docId = parts[0] ?? null;
  const known = docId === null || SITE_PAGES.some((p) => p.docId === docId) || isEditorialDocId(docId);
  const site = SITE_PAGES.find((p) => p.docId === docId);
  const label = docId ? site?.label ?? editorialTitle(docId) : null;
  const valid = known && parts.length <= 1;
  useAdminCrumbs(
    !valid ? NOT_FOUND : docId
      ? [{ label: 'Site' }, { label: 'Pages', to: adminPaths.pages() }, { label: label ?? docId }]
      : [{ label: 'Site' }, { label: 'Pages' }],
  );
  if (!valid) return <NotFound />;
  return <Pages docId={docId} onOpen={(next) => navigate(adminPaths.pages(next))} />;
}

// ── Contests ─────────────────────────────────────────────────────────
function ContestsScreen({ splat }: ScreenProps) {
  const navigate = useNavigate();
  const route = parseContestRoute(splat);
  const { year, section, iso } = route;
  const crumbs: Crumb[] = [{ label: 'Contests', to: year === null ? undefined : adminPaths.contests() }];
  if (year !== null) {
    crumbs.push({ label: String(year), to: section === 'details' ? undefined : adminPaths.contests(year) });
    if (section === 'entries') crumbs.push({ label: 'Entries', to: iso ? adminPaths.contests(year, 'entries') : undefined });
    if (iso) crumbs.push({ label: iso });
  }
  useAdminCrumbs(route.valid ? crumbs : NOT_FOUND);
  if (!route.valid) return <NotFound />;
  return (
    <Contests
      year={year}
      section={section}
      iso={iso}
      onSelect={(y) => navigate(adminPaths.contests(y))}
      entryPath={(y, code) => adminPaths.contests(y, 'entries', code)}
    />
  );
}

// ── Game ─────────────────────────────────────────────────────────────
function MonitorScreen() {
  useAdminCrumbs([{ label: 'Game' }, { label: 'Room phases' }]);
  return <PhaseMonitor />;
}

function ParserScreen({ splat }: ScreenProps) {
  const navigate = useNavigate();
  const parts = splatSegments(splat);
  const year = parseYear(parts[0]);
  const valid = parts.length === 0 || (parts.length === 1 && year !== null);
  useAdminCrumbs(
    !valid ? NOT_FOUND : year === null
      ? [{ label: 'Game' }, { label: 'Parser & controls' }]
      : [{ label: 'Game' }, { label: 'Parser & controls', to: adminPaths.parser() }, { label: String(year) }],
  );
  if (!valid) return <NotFound />;
  return <EurovisionParser year={year} onPickYear={(y) => navigate(adminPaths.parser(y))} />;
}

function WinnersScreen({ splat }: ScreenProps) {
  const navigate = useNavigate();
  const parts = splatSegments(splat);
  const roomId = parts[0] ?? null;
  useAdminCrumbs(
    parts.length > 1 ? NOT_FOUND : roomId
      ? [{ label: 'Game' }, { label: 'Winners', to: adminPaths.winners() }, { label: 'Room' }]
      : [{ label: 'Game' }, { label: 'Winners' }],
  );
  if (parts.length > 1) return <NotFound />;
  return <Winners roomId={roomId} onSelectRoom={(id) => navigate(adminPaths.winners(id))} />;
}

function AvatarsScreen() {
  useAdminCrumbs([{ label: 'Game' }, { label: 'Avatars' }]);
  return <AvatarsLibrary />;
}

// ── Media, settings ──────────────────────────────────────────────────
function MediaScreen() {
  return (
    <Later title="Media library" phase="P6" crumbs={[{ label: 'Media' }]}>
      <p>
        A library of every uploaded image and video, with alt text in English and Greek, comes in P6.
      </p>
      <p className="text-stage-text-3">
        Today you upload and pick media inside a page editor, under <Link to={adminPaths.pages()} className={LINK}>Pages</Link>.
      </p>
    </Later>
  );
}

function SettingsScreen() {
  useAdminCrumbs([{ label: 'Settings' }, { label: 'Site settings' }]);
  return <SettingsEditor />;
}

function AdminsScreen() {
  useAdminCrumbs([{ label: 'Settings' }, { label: 'Super admins' }]);
  return <SuperAdmins />;
}

function NotFound() {
  useAdminCrumbs(NOT_FOUND);
  useAdminLive(null);
  return (
    <div className="max-w-xl">
      <ScreenTitle title="Nothing here" lede="No admin screen has this address. It may have been mistyped, or the item no longer exists." />
      <Link to={adminPaths.overview()} className={LINK}>Go to the overview</Link>
    </div>
  );
}

const SCREENS: Array<{ pattern: string; Screen: ComponentType<ScreenProps> }> = [
  { pattern: '/admin', Screen: Overview },
  { pattern: '/admin/header', Screen: HeaderScreen },
  { pattern: '/admin/footer/*', Screen: FooterScreen },
  { pattern: '/admin/pages/*', Screen: PagesScreen },
  { pattern: '/admin/contests/*', Screen: ContestsScreen },
  { pattern: '/admin/game/monitor', Screen: MonitorScreen },
  { pattern: '/admin/game/parser/*', Screen: ParserScreen },
  { pattern: '/admin/game/winners/*', Screen: WinnersScreen },
  { pattern: '/admin/game/avatars', Screen: AvatarsScreen },
  { pattern: '/admin/media', Screen: MediaScreen },
  { pattern: '/admin/settings', Screen: SettingsScreen },
  { pattern: '/admin/system/admins', Screen: AdminsScreen },
];

/** The screen for the current /admin URL ("Nothing here" when none matches). */
export function AdminRoutes() {
  const { pathname } = useLocation();
  for (const { pattern, Screen } of SCREENS) {
    const m = matchPath({ path: pattern, end: true }, pathname);
    if (m) return <Screen key={pattern} splat={m.params['*']} />;
  }
  return <NotFound key="not-found" />;
}

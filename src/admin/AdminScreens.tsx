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
import Questions from './modules/questions/Questions';
import SuperAdmins from './modules/SuperAdmins';
import DbSize from './modules/overview/DbSize';
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
import { MediaAsset, MediaLibrary } from './modules/media/MediaLibrary';
import { FOOTER_COLUMN_KEYS, type FooterColumnKey } from './paths';
import { footerColumn, sitePagePath } from './siteStructure';
import { t } from './i18n';
import { DocHistory } from './cms/DocHistory';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { cmsGet, cmsSave } from './modules/pages/cmsApi';
import { pageBase, pageRemote } from './modules/pages/PageEditor';
import { publishedSiteDoc } from '../lib/cms/siteChrome';
import type { SiteWideDocId } from '../../supabase/functions/_shared/cms/siteLinks';
import type { DocValue } from './modules/pages/form/SchemaForm';
import { useCallback } from 'react';
import { DocPublishScreen, PublishQueueScreen, RunScreen } from './publish/PublishScreens';

const LINK = 'text-stage-pink-2 hover:underline';
const NOT_FOUND: Crumb[] = [{ label: t.nav.notFound }];

function ScreenTitle({ title, lede }: { title: string; lede?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold text-stage-text m-0">{title}</h1>
      {lede && <p className="t-small mt-1.5 max-w-2xl">{lede}</p>}
    </header>
  );
}

/** A screen whose content becomes editable in a later phase: says so, and what exists today. */
// ── Overview ─────────────────────────────────────────────────────────
const START_TO: Record<string, string> = {
  pages: adminPaths.pages(), contests: adminPaths.contests(), parser: adminPaths.parser(), monitor: adminPaths.monitor(),
};
const START = t.overview.start.map((s) => ({ to: START_TO[s.key], title: s.title, text: s.text }));

function Overview() {
  useAdminCrumbs([{ label: t.nav.overview }]);
  const publisher = usePublisher();
  return (
    <div className="max-w-4xl space-y-5">
      <ScreenTitle title={t.overview.title} />
      <PublishBar publisher={publisher} reviewTo={adminPaths.publish()} />
      <p className="t-meta max-w-2xl">{PUBLISH_PAGES_TEXT}</p>
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
      <DbSize />
    </div>
  );
}

// ── Site ─────────────────────────────────────────────────────────────
type ScreenProps = { splat?: string };

/** "history" or "history/:revId" after an editor's path: the selected revision ('' for none); null: no history; undefined: invalid. */
function historyOf(parts: string[]): string | null | undefined {
  if (parts.length === 0) return null;
  if (parts[0] !== 'history' || parts.length > 2) return undefined;
  return parts[1] ?? '';
}

const HISTORY_CRUMB: Crumb = { label: t.nav.history };

/** The history screen of a site-wide doc (header, footer, settings). */
function SiteDocHistory({ docId, rev }: { docId: SiteWideDocId; rev: string }) {
  const navigate = useNavigate();
  const loadCurrent = useCallback(async () => {
    const row = await cmsGet(docId);
    return row ? { value: row.data, updatedAt: row.updated_at } : { value: publishedSiteDoc(docId), updatedAt: null };
  }, [docId]);
  const loadLive = useCallback(async () => publishedSiteDoc(docId), [docId]);
  const saveDraft = useCallback((v: unknown, exp: string | null) => cmsSave(docId, docId, v as DocValue, exp), [docId]);
  return (
    <DocHistory
      docId={docId}
      label={t.docs[docId]}
      schema={CMS_DOC_TYPES[docId]?.schema}
      loadCurrent={loadCurrent}
      loadLive={loadLive}
      saveDraft={saveDraft}
      selected={rev || null}
      onSelect={(sel) => navigate(adminPaths.history(docId, sel), { replace: true })}
      editorPath={adminPaths.editorOf(docId)}
      onRestored={() => navigate(adminPaths.editorOf(docId))}
    />
  );
}

/** The history screen of a page or editorial doc. */
function PageDocHistory({ docId, label, rev }: { docId: string; label: string; rev: string }) {
  const navigate = useNavigate();
  const docType = docTypeFor(docId);
  const loadCurrent = useCallback(() => pageRemote(docId), [docId]);
  const loadLive = useCallback(async () => (await pageBase(docId)).value, [docId]);
  const saveDraft = useCallback((v: unknown, exp: string | null) => cmsSave(docId, docType, v as DocValue, exp), [docId, docType]);
  return (
    <DocHistory
      docId={docId}
      label={label}
      schema={CMS_DOC_TYPES[docType]?.schema}
      loadCurrent={loadCurrent}
      loadLive={loadLive}
      saveDraft={saveDraft}
      selected={rev || null}
      onSelect={(sel) => navigate(adminPaths.history(docId, sel), { replace: true })}
      editorPath={adminPaths.pages(docId)}
      onRestored={() => navigate(adminPaths.pages(docId))}
    />
  );
}

const SITE_CRUMB: Crumb = { label: t.nav.site };
const PUBLISH_CRUMB: Crumb = { label: t.nav.publish };

/** …/publish of a site-wide doc: the diff and the Vercel preview flow. */
function SiteDocPublish({ docId, crumbs }: { docId: SiteWideDocId; crumbs: Crumb[] }) {
  useAdminCrumbs(crumbs);
  useAdminLive('/');
  return <DocPublishScreen docId={docId} label={t.docs[docId]} />;
}

function HeaderScreen({ splat }: ScreenProps) {
  const parts = splatSegments(splat);
  if (parts.length === 1 && parts[0] === 'publish') {
    return <SiteDocPublish docId="site-header" crumbs={[SITE_CRUMB, { label: t.nav.header, to: adminPaths.header() }, PUBLISH_CRUMB]} />;
  }
  return <HeaderMain parts={parts} />;
}

function HeaderMain({ parts }: { parts: string[] }) {
  const hist = historyOf(parts);
  const crumbs: Crumb[] = hist == null
    ? [SITE_CRUMB, { label: t.nav.header }]
    : [SITE_CRUMB, { label: t.nav.header, to: adminPaths.header() }, HISTORY_CRUMB];
  useAdminCrumbs(hist === undefined ? NOT_FOUND : crumbs);
  useAdminLive(hist === undefined ? null : '/');
  if (hist === undefined) return <NotFound />;
  if (hist !== null) return <SiteDocHistory docId="site-header" rev={hist} />;
  return <HeaderEditor />;
}


function FooterScreen({ splat }: ScreenProps) {
  const parts = splatSegments(splat);
  if (parts.length === 1 && parts[0] === 'publish') {
    return <SiteDocPublish docId="site-footer" crumbs={[SITE_CRUMB, { label: t.nav.footer, to: adminPaths.footer() }, PUBLISH_CRUMB]} />;
  }
  if (parts[0] === 'history') return <FooterHistoryScreen parts={parts} />;
  return <FooterColumnScreen parts={parts} />;
}

function FooterHistoryScreen({ parts }: { parts: string[] }) {
  const hist = historyOf(parts);
  useAdminCrumbs(hist == null ? NOT_FOUND : [SITE_CRUMB, { label: t.nav.footer, to: adminPaths.footer() }, HISTORY_CRUMB]);
  useAdminLive(hist == null ? null : '/');
  if (hist == null) return <NotFound />;
  return <SiteDocHistory docId="site-footer" rev={hist} />;
}

function FooterColumnScreen({ parts }: { parts: string[] }) {
  const [key, ...rest] = parts;
  const column = key === undefined ? null : (FOOTER_COLUMN_KEYS as readonly string[]).includes(key) ? (key as FooterColumnKey) : undefined;
  const valid = column !== undefined && rest.length === 0;
  useAdminCrumbs(!valid ? NOT_FOUND : column
    ? [SITE_CRUMB, { label: t.nav.footer, to: adminPaths.footer() }, { label: footerColumn(column)?.title ?? COLUMN_TITLE[column] }]
    : [SITE_CRUMB, { label: t.nav.footer }]);
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
  const publishing = docId !== null && parts.length === 2 && parts[1] === 'publish';
  const hist = publishing ? null : historyOf(parts.slice(1));
  const valid = known && hist !== undefined;
  const inHistory = valid && docId !== null && hist != null;
  const crumbs: Crumb[] = !docId
    ? [SITE_CRUMB, { label: t.nav.pages }]
    : inHistory || publishing
      ? [SITE_CRUMB, { label: t.nav.pages, to: adminPaths.pages() }, { label: label ?? docId, to: adminPaths.pages(docId) }, publishing ? PUBLISH_CRUMB : HISTORY_CRUMB]
      : [SITE_CRUMB, { label: t.nav.pages, to: adminPaths.pages() }, { label: label ?? docId }];
  useAdminCrumbs(valid ? crumbs : NOT_FOUND);
  if (!valid) return <NotFound />;
  if (publishing) return <PagePublish key={docId} docId={docId!} label={label ?? docId!} />;
  if (inHistory) return <PageDocHistory key={docId} docId={docId!} label={label ?? docId!} rev={hist!} />;
  return <Pages docId={docId} onOpen={(next) => navigate(adminPaths.pages(next))} />;
}

function PagePublish({ docId, label }: { docId: string; label: string }) {
  useAdminLive(sitePagePath(docId));
  return <DocPublishScreen docId={docId} label={label} />;
}

// ── Publish ──────────────────────────────────────────────────────────
function PublishScreen({ splat }: ScreenProps) {
  const parts = splatSegments(splat);
  const runId = parts[0] === 'runs' && parts.length === 2 && /^\d+$/.test(parts[1]) ? Number(parts[1]) : null;
  const valid = parts.length === 0 || runId !== null;
  useAdminCrumbs(!valid ? NOT_FOUND : runId === null ? [PUBLISH_CRUMB] : [{ label: t.nav.publish, to: adminPaths.publish() }, { label: t.nav.run(runId) }]);
  if (!valid) return <NotFound />;
  if (runId !== null) return <RunScreen key={runId} runId={runId} />;
  return <PublishQueueScreen />;
}

// ── Contests ─────────────────────────────────────────────────────────
function ContestsScreen({ splat }: ScreenProps) {
  const navigate = useNavigate();
  const route = parseContestRoute(splat);
  const { year, section, iso } = route;
  const crumbs: Crumb[] = [{ label: t.nav.contests, to: year === null ? undefined : adminPaths.contests() }];
  if (year !== null) {
    crumbs.push({ label: String(year), to: section === 'details' ? undefined : adminPaths.contests(year) });
    if (section === 'entries') crumbs.push({ label: t.nav.entries, to: iso ? adminPaths.contests(year, 'entries') : undefined });
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
  useAdminCrumbs([{ label: t.nav.game }, { label: t.nav.monitor }]);
  return <PhaseMonitor />;
}

function ParserScreen({ splat }: ScreenProps) {
  const navigate = useNavigate();
  const parts = splatSegments(splat);
  const year = parseYear(parts[0]);
  const valid = parts.length === 0 || (parts.length === 1 && year !== null);
  useAdminCrumbs(
    !valid ? NOT_FOUND : year === null
      ? [{ label: t.nav.game }, { label: t.nav.parser }]
      : [{ label: t.nav.game }, { label: t.nav.parser, to: adminPaths.parser() }, { label: String(year) }],
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
      ? [{ label: t.nav.game }, { label: t.nav.winners, to: adminPaths.winners() }, { label: t.nav.room }]
      : [{ label: t.nav.game }, { label: t.nav.winners }],
  );
  if (parts.length > 1) return <NotFound />;
  return <Winners roomId={roomId} onSelectRoom={(id) => navigate(adminPaths.winners(id))} />;
}

function QuestionsScreen() {
  useAdminCrumbs([{ label: t.nav.game }, { label: t.nav.questions }]);
  return <Questions />;
}

function AvatarsScreen() {
  useAdminCrumbs([{ label: t.nav.game }, { label: t.nav.avatars }]);
  return <AvatarsLibrary />;
}

// ── Media, settings ──────────────────────────────────────────────────
function MediaScreen({ splat }: ScreenProps) {
  const parts = splatSegments(splat);
  const id = parts[0] ?? null;
  const valid = parts.length === 0 || (parts.length === 1 && /^[0-9a-f-]{36}$/.test(parts[0]));
  useAdminCrumbs(!valid ? NOT_FOUND : id
    ? [{ label: t.nav.media }, { label: t.nav.mediaLibrary, to: adminPaths.media() }, { label: t.media.file }]
    : [{ label: t.nav.media }, { label: t.nav.mediaLibrary }]);
  if (!valid) return <NotFound />;
  return id ? <MediaAsset id={id} /> : <MediaLibrary />;
}

function SettingsScreen({ splat }: ScreenProps) {
  const parts = splatSegments(splat);
  if (parts.length === 1 && parts[0] === 'publish') {
    return <SiteDocPublish docId="site-settings" crumbs={[{ label: t.nav.settings }, { label: t.nav.siteSettings, to: adminPaths.settings() }, PUBLISH_CRUMB]} />;
  }
  return <SettingsMain parts={parts} />;
}

function SettingsMain({ parts }: { parts: string[] }) {
  const hist = historyOf(parts);
  const crumbs: Crumb[] = hist == null
    ? [{ label: t.nav.settings }, { label: t.nav.siteSettings }]
    : [{ label: t.nav.settings }, { label: t.nav.siteSettings, to: adminPaths.settings() }, HISTORY_CRUMB];
  useAdminCrumbs(hist === undefined ? NOT_FOUND : crumbs);
  if (hist === undefined) return <NotFound />;
  if (hist !== null) return <SiteDocHistory docId="site-settings" rev={hist} />;
  return <SettingsEditor />;
}

function AdminsScreen() {
  useAdminCrumbs([{ label: t.nav.settings }, { label: t.nav.admins }]);
  return <SuperAdmins />;
}

function NotFound() {
  useAdminCrumbs(NOT_FOUND);
  useAdminLive(null);
  return (
    <div className="max-w-xl">
      <ScreenTitle title={t.notFound.title} lede={t.notFound.lede} />
      <Link to={adminPaths.overview()} className={LINK}>{t.notFound.back}</Link>
    </div>
  );
}

const SCREENS: Array<{ pattern: string; Screen: ComponentType<ScreenProps> }> = [
  { pattern: '/admin', Screen: Overview },
  { pattern: '/admin/header/*', Screen: HeaderScreen },
  { pattern: '/admin/footer/*', Screen: FooterScreen },
  { pattern: '/admin/pages/*', Screen: PagesScreen },
  { pattern: '/admin/publish/*', Screen: PublishScreen },
  { pattern: '/admin/contests/*', Screen: ContestsScreen },
  { pattern: '/admin/game/monitor', Screen: MonitorScreen },
  { pattern: '/admin/game/parser/*', Screen: ParserScreen },
  { pattern: '/admin/game/winners/*', Screen: WinnersScreen },
  { pattern: '/admin/game/questions', Screen: QuestionsScreen },
  { pattern: '/admin/game/avatars', Screen: AvatarsScreen },
  { pattern: '/admin/media/*', Screen: MediaScreen },
  { pattern: '/admin/settings/*', Screen: SettingsScreen },
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

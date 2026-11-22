// The admin shell (spec §3): a left nav organised like the site, a top bar
// (breadcrumb, "View live" for the item on screen, the signed-in user) and
// the routed screens under /admin/*. Every screen has its own URL, so
// back/forward and reload restore it. Below lg the nav is a drawer.
//
// One unsaved-edits guard covers the whole admin (unsavedGuard.ts): route
// changes ask through useRouteLeaveGuard, sign-out through confirmLeave, and
// closing the tab through beforeunload.
import { ToastHost } from './ui/kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, LogOut, Menu, X } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import { AdminRoutes } from './AdminScreens';
import { createUnsavedGuard, UnsavedGuardContext, useRouteLeaveGuard } from './unsavedGuard';
import type { AdminAuth } from './useAdminAuth';
import { AdminNavContext, type AdminNav } from './adminNav';
import { AdminMetaContext, type AdminMetaApi, type Crumb } from './adminMeta';
import { adminPaths, screenKey } from './paths';
import { localizePath } from '../lib/seo/locale';

interface Props {
  auth: AdminAuth;
}

function Brand() {
  return (
    <Link to={adminPaths.overview()} className="flex items-center gap-2 px-5 h-14 shrink-0 border-b border-stage-line">
      <span className="grad font-bold text-lg leading-none">eurovision.games</span>
      <span className="t-meta">admin</span>
    </Link>
  );
}

function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length === 0) return <span className="flex-1" />;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex items-center gap-1.5 text-sm min-w-0">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          // On small screens only the last two crumbs show.
          const hideSmall = i < crumbs.length - 2;
          return (
            <li key={`${i}-${c.label}`} className={`flex items-center gap-1.5 min-w-0 ${hideSmall ? 'hidden md:flex' : ''}`}>
              {i > 0 && <span aria-hidden className={`text-stage-text-3 ${i === crumbs.length - 2 ? 'hidden md:inline' : ''}`}>/</span>}
              {last ? (
                <span aria-current="page" className="truncate font-semibold text-stage-text">{c.label}</span>
              ) : c.to ? (
                <Link to={c.to} className="truncate text-stage-text-2 hover:text-stage-text">{c.label}</Link>
              ) : (
                <span className="truncate text-stage-text-3">{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** "View live" for the item on screen: its public page in each locale. */
function LiveLinks({ path }: { path: string | null }) {
  if (!path) return null;
  const link = 'inline-flex items-center gap-1 rounded-stage-pill border border-stage-line-2 px-2.5 h-8 text-xs font-semibold text-stage-text-2 hover:text-stage-text hover:border-stage-text-3';
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="t-meta hidden sm:inline">View live</span>
      {(['en', 'el'] as const).map((l) => (
        <a key={l} href={localizePath(l, path)} target="_blank" rel="noopener noreferrer" className={link} aria-label={`View live (${l.toUpperCase()}), opens a new tab`}>
          {l.toUpperCase()}
          <ExternalLink size={12} aria-hidden />
        </a>
      ))}
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AdminShell({ auth }: Props) {
  const { email, logout } = auth;
  const [guard] = useState(createUnsavedGuard);
  useRouteLeaveGuard(guard, screenKey);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [live, setLive] = useState<string | null>(null);
  const meta = useMemo<AdminMetaApi>(() => ({ setCrumbs, setLive }), []);
  const nav = useMemo<AdminNav>(() => ({ openDoc: (docId) => navigate(adminPaths.pages(docId)) }), [navigate]);

  useEffect(() => {
    const last = crumbs[crumbs.length - 1]?.label;
    document.title = last ? `${last} · admin` : 'admin';
  }, [crumbs]);

  // Mobile drawer: open for the path it was opened on, so any navigation
  // closes it; Escape closes it too. Focus stays inside and returns to the
  // menu button.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawer = drawerPath === pathname;
  const setDrawer = useCallback((open: boolean) => setDrawerPath(open ? pathname : null), [pathname]);
  const menuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeDrawer = useCallback(() => setDrawerPath(null), []);
  useEffect(() => {
    if (!drawer) return;
    const node = drawerRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeDrawer(); return; }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastItem?.focus(); }
      else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const trigger = menuRef.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      trigger?.focus();
    };
  }, [drawer, closeDrawer]);

  const signOut = () => {
    if (guard.confirmLeave()) logout();
  };

  const user = (
    <div className="flex items-center gap-2 min-w-0">
      <span className="truncate text-sm text-stage-text-2" title={email ?? undefined}>{email}</span>
      <button
        type="button"
        onClick={signOut}
        className="inline-flex items-center gap-1.5 rounded-stage-pill border border-stage-line-2 px-3 h-8 text-xs font-semibold text-stage-text-2 hover:text-stage-text cursor-pointer shrink-0"
      >
        <LogOut size={13} aria-hidden />
        Sign out
      </button>
    </div>
  );

  return (
    <UnsavedGuardContext.Provider value={guard}>
      <AdminNavContext.Provider value={nav}>
        <AdminMetaContext.Provider value={meta}>
          <div className="min-h-dvh flex bg-stage-bg text-stage-text">
            {/* Desktop nav */}
            <aside className="hidden lg:flex w-64 shrink-0 flex-col sticky top-0 h-dvh border-r border-stage-line bg-stage-bg-2">
              <Brand />
              <div className="flex-1 overflow-y-auto">
                <AdminSidebar />
              </div>
            </aside>

            {/* Mobile drawer */}
            {drawer && (
              <div className="lg:hidden fixed inset-0 z-50">
                <div className="absolute inset-0 bg-black/60" onClick={closeDrawer} aria-hidden />
                <div
                  ref={drawerRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Admin menu"
                  className="absolute inset-y-0 left-0 w-[86vw] max-w-80 flex flex-col bg-stage-bg-2 border-r border-stage-line shadow-stage"
                >
                  <div className="flex items-center justify-between border-b border-stage-line pr-2">
                    <Brand />
                    <button
                      type="button"
                      onClick={closeDrawer}
                      aria-label="Close menu"
                      className="grid place-items-center w-10 h-10 rounded-stage-pill text-stage-text-2 hover:text-stage-text cursor-pointer"
                    >
                      <X size={20} aria-hidden />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <AdminSidebar />
                  </div>
                  <div className="border-t border-stage-line p-3">{user}</div>
                </div>
              </div>
            )}

            <div className="flex-1 min-w-0 flex flex-col">
              <header className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 md:px-6 border-b border-stage-line bg-stage-bg/90 backdrop-blur">
                <button
                  ref={menuRef}
                  type="button"
                  onClick={() => setDrawer(true)}
                  aria-label="Open menu"
                  aria-expanded={drawer}
                  className="lg:hidden grid place-items-center w-10 h-10 -ml-2 rounded-stage-pill text-stage-text-2 hover:text-stage-text cursor-pointer"
                >
                  <Menu size={20} aria-hidden />
                </button>
                <Breadcrumb crumbs={crumbs} />
                <LiveLinks path={live} />
                <div className="hidden lg:flex max-w-72">{user}</div>
              </header>
              <main className="flex-1 min-w-0 p-4 md:p-6">
                <ToastHost>
                  <AdminRoutes />
                </ToastHost>
              </main>
            </div>
          </div>
        </AdminMetaContext.Provider>
      </AdminNavContext.Provider>
    </UnsavedGuardContext.Provider>
  );
}

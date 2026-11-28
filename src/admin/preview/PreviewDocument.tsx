/**
 * The admin preview of a CMS draft: the real public page, with its real
 * header and footer, rendered from the draft. This is what the preview iframe
 * (/admin/preview/:docId/:locale) shows; the editor talks to it over the
 * bridge (protocol.ts).
 *
 * The same components and the same overlay as the build: the page reads its
 * doc through usePageContent, the header and footer through useSiteDoc, and
 * PageContentOverrideProvider overlays the drafts with overlayDrafts, the
 * function publish-content uses for the pages after a publish. The parity
 * test renders one fixture through this and through the prerender and
 * compares the HTML (tests/admin/previewParity.test.tsx).
 *
 * Isolation (from the admin and from the public site's shared state):
 * - Content: the previewed docs are never read from (or written to) the
 *   content cache or the network. Other docs (site.json, contests/*.json)
 *   load as usual.
 * - Head: PreviewModeContext makes SchemaHead skip every document.head write,
 *   and LocaleLink skip prefetching.
 * - Markers: PreviewModeContext also turns on cmsAttrs (data-cms-path), which
 *   the public site and the prerender never render.
 * - Routing: a detached MemoryRouter at the page's public path. Editorial docs
 *   (archive-*, country-*, hub-*) preview their data page at `path`. Link
 *   clicks and form submits are swallowed.
 * - Locale: a LocaleProvider and a cloned i18next instance, so the locale
 *   never changes the global language or <html lang>.
 * - Safety: the draft may not validate yet, so the page gets a sanitized copy
 *   (sanitizePreview.ts).
 * - Media: draft references (cms-media/<uuid>) resolve through signed URLs of
 *   the private bucket (media/previewResolver.ts).
 * - Errors: a malformed draft shows «Σφάλμα προεπισκόπησης: …» in the pane only.
 */
import { Component, useMemo, type ReactNode, type SyntheticEvent } from 'react';
import { Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { routes } from '../../routeConfig';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { PAGE_REGISTRY } from '../../lib/seo/registry';
import { localizePath, type Locale } from '../../lib/seo/locale';
import { LocaleProvider } from '../../lib/seo/LocaleContext';
import { PreviewModeContext } from '../../lib/seo/PreviewMode';
import { CmsDocContext } from '../../lib/cms/cmsAttrs';
import { PageContentOverrideProvider } from '../../lib/cms/PageContentOverride';
import SiteHeader from '../../components/seo/SiteHeader';
import BetaBanner from '../../components/seo/BetaBanner';
import { docTypeFor } from '../../../supabase/functions/_shared/cms/registry';
import { editorialFamily, type EditorialFamily } from '../../../supabase/functions/_shared/cms/pagesIndex';
import type { DraftDoc } from '../../../supabase/functions/_shared/cms/overlay';
import { sanitizePreviewDoc } from '../modules/pages/sanitizePreview';
import { MediaResolverContext } from '../../components/cms/MediaResolver';
import { usePreviewMediaResolver } from '../modules/pages/media/previewResolver';
import { DetachedMemoryRouter } from '../modules/pages/DetachedMemoryRouter';
import { t } from '../i18n';

const NOT_FOUND_PATH = '/page-not-found';

/** The page a site-wide doc is previewed on (its draft shows in the header or footer of every page). */
export const SITE_DOC_PAGE = 'home';

/** The page doc whose page shows `docId` (a site-wide doc shows on the home page). */
export function previewPageDoc(docId: string): string {
  return docId === 'site-header' || docId === 'site-footer' || docId === 'site-settings' ? SITE_DOC_PAGE : docId;
}

type Target = { element: ReactNode; path: string };

/** The public page component for a page docId, and its unprefixed path in `locale`. */
function previewTarget(docId: string, locale: Locale): Target | null {
  if (docId === 'not-found') return { element: <NotFoundPage />, path: NOT_FOUND_PATH };
  const page = PAGE_REGISTRY.find((p) => p.id === docId);
  if (!page) return null;
  const slug = page.slugByLocale[locale];
  const children = routes.find((r) => r.path === '/:locale')?.children ?? [];
  const route = slug === '/' ? children.find((r) => r.index) : children.find((r) => r.path === slug.slice(1));
  return route?.element ? { element: route.element, path: slug } : null;
}

/** The data page route of each editorial family, under /:locale. */
const EDITORIAL_ROUTE: Record<EditorialFamily, string> = {
  archive: 'past-contests/:slug',
  country: 'countries/:slug',
  hub: ':slug',
};

/** The page component of an editorial family (the hub page is the index child of its :slug route). */
function editorialElement(family: EditorialFamily): ReactNode {
  const children = routes.find((r) => r.path === '/:locale')?.children ?? [];
  const route = children.find((r) => r.path === EDITORIAL_ROUTE[family]);
  return family === 'hub' ? route?.children?.find((r) => r.index)?.element : route?.element;
}

function EditorialPreviewPage({ family, path, locale }: { family: EditorialFamily; path: string; locale: Locale }) {
  const element = editorialElement(family);
  if (!element) throw new Error(`no page to preview for ${family} editorial`);
  return (
    <DetachedMemoryRouter key={`${path}:${locale}`} path={localizePath(locale, path)}>
      <PageChrome>
        <Routes>
          <Route path={`/:locale/${EDITORIAL_ROUTE[family]}`} element={element} />
        </Routes>
      </PageChrome>
    </DetachedMemoryRouter>
  );
}

/** LocaleRoot's markup around a page (the ground, the beta strip, the header); its effects stay out of the preview. */
function PageChrome({ children }: { children: ReactNode }) {
  return (
    <div className="stage-root">
      <BetaBanner />
      <SiteHeader />
      <main id="main">{children}</main>
    </div>
  );
}

type BoundaryProps = { resetKeys: unknown[]; children: ReactNode };

class PreviewErrorBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: BoundaryProps) {
    // A new draft (or locale) gets a fresh attempt.
    if (this.state.error && prev.resetKeys.some((k, i) => k !== this.props.resetKeys[i])) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="m-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-200">
          {t.preview.error}: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

function PreviewPage({ docId, locale, path }: { docId: string; locale: Locale; path?: string | null }) {
  const family = editorialFamily(docId);
  if (family) {
    if (path === null) return <p className="m-4 text-sm text-white/60">{t.media2.finding}</p>;
    if (!path) throw new Error(`no page to preview for "${docId}" (its year or country is not listed)`);
    return <EditorialPreviewPage family={family} path={path} locale={locale} />;
  }
  const pageDoc = previewPageDoc(docId);
  const target = previewTarget(pageDoc, locale);
  if (!target) throw new Error(`no page to preview for "${docId}"`);
  return (
    <DetachedMemoryRouter key={`${pageDoc}:${locale}`} path={localizePath(locale, target.path)}>
      <PageChrome>{target.element}</PageChrome>
    </DetachedMemoryRouter>
  );
}

/** Links go nowhere and forms submit nothing (e.g. the home page's create-room form). */
function swallowLinkClick(e: SyntheticEvent) {
  if ((e.target as Element | null)?.closest?.('a')) e.preventDefault();
}
function swallowSubmit(e: SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

const NO_DRAFTS: readonly DraftDoc[] = [];

/** The page's markup only (no bridge, no outlines): shared by the frame and the parity test. */
export function PreviewBody({ docId, doc, locale, path, drafts = NO_DRAFTS }: {
  docId: string;
  /** The draft `{ en, el }`, as edited (sanitized here). */
  doc: unknown;
  locale: Locale;
  path?: string | null;
  /** Other saved drafts the page shows (the header and footer), overlaid like a publish would. */
  drafts?: readonly DraftDoc[];
}) {
  // A private i18next instance for the page's own UI strings.
  const localI18n = useMemo(() => i18n.cloneInstance({ lng: locale }), [locale]);
  // Never render the draft itself: rawHtml and hrefs are made safe on a copy.
  const safeDoc = useMemo(() => sanitizePreviewDoc(docTypeFor(docId), doc), [docId, doc]);
  const safeDrafts = useMemo(
    () => drafts.map((d) => ({ doc_id: d.doc_id, data: sanitizePreviewDoc(docTypeFor(d.doc_id), d.data) })),
    [drafts],
  );
  const media = usePreviewMediaResolver(safeDoc);
  const pageDoc = editorialFamily(docId) ? docId : previewPageDoc(docId);

  return (
    <PreviewErrorBoundary resetKeys={[docId, doc, locale, path, drafts]}>
      <PreviewModeContext.Provider value={true}>
        <CmsDocContext.Provider value={pageDoc}>
          <I18nextProvider i18n={localI18n}>
            <LocaleProvider locale={locale}>
              <PageContentOverrideProvider docId={docId} doc={safeDoc} drafts={safeDrafts}>
                <MediaResolverContext.Provider value={media}>
                  <PreviewPage docId={docId} locale={locale} path={path} />
                </MediaResolverContext.Provider>
              </PageContentOverrideProvider>
            </LocaleProvider>
          </I18nextProvider>
        </CmsDocContext.Provider>
      </PreviewModeContext.Provider>
    </PreviewErrorBoundary>
  );
}

export default function PreviewDocument(props: Parameters<typeof PreviewBody>[0]) {
  return (
    <div
      data-testid="preview-pane"
      lang={props.locale}
      className="relative bg-euro-gradient"
      onClickCapture={swallowLinkClick}
      onSubmitCapture={swallowSubmit}
    >
      <PreviewBody {...props} />
    </div>
  );
}

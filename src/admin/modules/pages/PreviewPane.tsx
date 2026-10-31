/**
 * Admin preview of a CMS page draft: renders the real public page component
 * for `docId` with the draft in place of content/pages/{docId}.json.
 *
 * Isolation from the admin (and from the public site's shared state):
 * - Content: PageContentOverrideProvider serves the draft; the previewed doc
 *   is never read from (or written to) the content cache or the network.
 *   Other docs the page reads (site.json, contests/*.json) load as usual.
 * - Head: PreviewModeContext makes SchemaHead skip every document.head write
 *   (title, meta, canonical, hreflang, JSON-LD). There is no head collector,
 *   so NotFoundPage's setStatus(404) is a no-op.
 * - Routing: the page gets its own MemoryRouter at its public path, with the
 *   admin's router contexts reset so nothing reaches the admin's router.
 *   An editorial doc (archive-*, country-*, hub-*) previews its data page at
 *   `path` (from the Pages module), matched by the page's own route so it
 *   reads its :slug; the page loads its contest data as on the site.
 *   Link clicks and form submits inside the pane are swallowed.
 * - Locale: a local LocaleProvider plus a cloned i18next instance, so the
 *   EN/EL toggle never changes the global language or <html lang>.
 * - Safety: the draft may not validate yet, so the page gets a sanitized
 *   copy (sanitizePreview.ts): rawHtml outside the allowlist is shown as
 *   escaped text, an unsafe href becomes "#" and an invalid media reference "".
 * - Media: draft references (cms-media/<uuid>) render through a
 *   MediaResolverContext backed by media_list and signed URLs of the private
 *   bucket (media/previewResolver.ts). The public site has no resolver.
 * - Errors: a malformed draft or a placeholder the page does not supply
 *   (interpolate throws) shows "Preview error: …" inside the pane only.
 */
import { Component, useMemo, useState, type ReactNode, type SyntheticEvent } from 'react';
import { Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import { routes } from '../../../routeConfig';
import { NotFoundPage } from '../../../pages/NotFoundPage';
import { PAGE_REGISTRY } from '../../../lib/seo/registry';
import { localizePath, type Locale } from '../../../lib/seo/locale';
import { LocaleProvider } from '../../../lib/seo/LocaleContext';
import { PreviewModeContext } from '../../../lib/seo/PreviewMode';
import { PageContentOverrideProvider } from '../../../lib/cms/PageContentOverride';
import { docTypeFor } from '../../../../supabase/functions/_shared/cms/registry';
import { editorialFamily, type EditorialFamily } from '../../../../supabase/functions/_shared/cms/pagesIndex';
import { sanitizePreviewDoc } from './sanitizePreview';
import { MediaResolverContext } from '../../../components/cms/MediaResolver';
import { usePreviewMediaResolver } from './media/previewResolver';
import { DetachedMemoryRouter } from './DetachedMemoryRouter';

const LOCALES: Locale[] = ['en', 'el'];
const NOT_FOUND_PATH = '/page-not-found';

type Target = { element: ReactNode; path: string };

/** The public page component for a docId, and its unprefixed path in `locale`. */
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
      <Routes>
        <Route path={`/:locale/${EDITORIAL_ROUTE[family]}`} element={element} />
      </Routes>
    </DetachedMemoryRouter>
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
          Preview error: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

function PreviewPage({ docId, locale, path }: { docId: string; locale: Locale; path?: string | null }) {
  const family = editorialFamily(docId);
  if (family) {
    if (path === null) return <p className="m-4 text-sm text-white/60">Finding the page to preview…</p>;
    if (!path) throw new Error(`no page to preview for "${docId}" (its year or country is not listed)`);
    return <EditorialPreviewPage family={family} path={path} locale={locale} />;
  }
  const target = previewTarget(docId, locale);
  if (!target) throw new Error(`no page to preview for "${docId}"`);
  return (
    <DetachedMemoryRouter key={`${docId}:${locale}`} path={localizePath(locale, target.path)}>
      {target.element}
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

export default function PreviewPane({ docId, doc, path, initialLocale = 'en' }: {
  docId: string;
  /** The draft document `{ en, el }`, as edited (not necessarily valid). */
  doc: unknown;
  /** Editorial docs: the unprefixed public path of the data page to show; null while it is being looked up. */
  path?: string | null;
  initialLocale?: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  // A private i18next instance for the page's own UI strings (footer etc.).
  const localI18n = useMemo(() => i18n.cloneInstance({ lng: locale }), [locale]);
  // Never render the draft itself: rawHtml and hrefs are made safe on a copy.
  const safeDoc = useMemo(() => sanitizePreviewDoc(docTypeFor(docId), doc), [docId, doc]);
  const media = usePreviewMediaResolver(safeDoc);

  return (
    <section className="flex flex-col rounded-xl border border-white/10 bg-black/20">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2 text-xs">
        <span className="text-white/60">Preview — links are disabled</span>
        <div role="group" aria-label="Preview language" className="flex gap-1">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={l === locale}
              onClick={() => setLocale(l)}
              className={`rounded px-2 py-1 font-semibold ${l === locale ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div
        data-testid="preview-pane"
        lang={locale}
        className="relative overflow-auto bg-euro-gradient"
        onClickCapture={swallowLinkClick}
        onSubmitCapture={swallowSubmit}
      >
        <PreviewErrorBoundary resetKeys={[docId, doc, locale, path]}>
          <PreviewModeContext.Provider value={true}>
            <I18nextProvider i18n={localI18n}>
              <LocaleProvider locale={locale}>
                <PageContentOverrideProvider docId={docId} doc={safeDoc}>
                  <MediaResolverContext.Provider value={media}>
                    <PreviewPage docId={docId} locale={locale} path={path} />
                  </MediaResolverContext.Provider>
                </PageContentOverrideProvider>
              </LocaleProvider>
            </I18nextProvider>
          </PreviewModeContext.Provider>
        </PreviewErrorBoundary>
      </div>
    </section>
  );
}

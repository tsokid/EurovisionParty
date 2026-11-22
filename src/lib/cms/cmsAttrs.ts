/**
 * Click-to-edit markers for the admin preview (Track 3 §5, P4).
 *
 * `useCmsAttrs(docId?)` returns `attrs(path)`, which a component spreads on
 * the element that renders a CMS field:
 *
 *   <h1 {...attrs('hero.title')}>…</h1>
 *
 * In the admin preview (PreviewModeContext true) it gives
 * `{ 'data-cms-path': 'faq:el:hero.title' }`: the doc id, the locale and the
 * field's path inside that locale, the same path the editor's form uses.
 * Everywhere else, the public site and the prerender included, it gives `{}`,
 * so a spread adds nothing and the HTML stays byte-identical (the build checks
 * that dist/ holds no data-cms-path).
 *
 * `docId` defaults to the page doc the preview is showing (CmsDocContext, set
 * by the preview). The header and footer pass their own ids.
 */
import { createContext, useCallback, useContext } from 'react';
import { usePreviewMode } from '../seo/PreviewMode';
import { useLocale } from '../seo/LocaleContext';

/**
 * The attribute that carries `docId:locale:path` (data-cms-path). Spelled out
 * at runtime so the built JS does not hold the literal either: the build
 * checks that nothing in dist/ contains it (scripts/cms/check-no-cms-markers.ts).
 */
export const CMS_PATH_ATTR: string = ['data', 'cms', 'path'].join('-');

export type CmsAttrs = Readonly<Record<string, string>>;

/** The page doc the admin preview is showing (null outside the preview). */
export const CmsDocContext = createContext<string | null>(null);

const NONE: CmsAttrs = Object.freeze({});
const none = () => NONE;

/** `docId:locale:path`, the value of data-cms-path. */
export const cmsPathValue = (docId: string, locale: string, path: string): string => `${docId}:${locale}:${path}`;

/** Splits a data-cms-path value; null when malformed. */
export function parseCmsPath(value: string): { docId: string; locale: string; path: string } | null {
  const m = /^([a-z0-9-]+):([a-z]{2}):(.+)$/.exec(value);
  return m ? { docId: m[1], locale: m[2], path: m[3] } : null;
}

export function useCmsAttrs(docId?: string): (path: string) => CmsAttrs {
  const preview = usePreviewMode();
  const pageDoc = useContext(CmsDocContext);
  const locale = useLocale();
  const id = docId ?? pageDoc;
  const attrs = useCallback((path: string): CmsAttrs => ({ [CMS_PATH_ATTR]: cmsPathValue(id!, locale, path) }), [id, locale]);
  return preview && id ? attrs : none;
}

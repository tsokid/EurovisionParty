import type { ContentState } from '../../lib/seo/useContent';
import { useLocale } from '../../lib/seo/LocaleContext';
import { ContentPending } from '../contest/ContentPending';
import { NotFoundPage } from '../NotFoundPage';

/**
 * What a static page renders while its CMS document (usePageContent) is not
 * ready. Only reachable on client-side navigation: prerendered pages inline
 * their document, and the server render throws if it is missing.
 * - loading / error: ContentPending (with retry on error).
 * - missing: the 404 page, as the contest pages do. NotFoundPage itself must
 *   therefore never render this fallback for its own document.
 */
export function PageContentFallback({ state }: { state: Exclude<ContentState<unknown>, { status: 'ready' }> }) {
  const locale = useLocale();
  if (state.status === 'missing') return <NotFoundPage />;
  return <ContentPending locale={locale} retry={state.status === 'error' ? state.retry : undefined} />;
}

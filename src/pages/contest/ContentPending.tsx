import type { Locale } from '../../lib/seo/locale';
import SiteFooter from '../../components/seo/SiteFooter';
import { hubCopy } from './content/hubCopy';

/**
 * Placeholder while a content file loads on client-side navigation, or the
 * error state (with retry) when it could not be fetched. Prerendered pages
 * never show it: their content is inlined. `inline` renders it inside a page
 * section instead of as the page body. As the page body it keeps the site
 * footer (pages render their own; LocaleRoot renders the header), so the
 * chrome does not drop out during a client-side load. The data-content-state attribute lets
 * the prerender check (scripts/seo/checkPrerender.ts) reject a page that was
 * built in this state.
 */
export function ContentPending({ locale, retry, inline = false }: { locale: Locale; retry?: () => void; inline?: boolean }) {
  const c = hubCopy[locale];
  const error = retry !== undefined;
  const Tag = inline ? 'div' : 'main';
  const layout = inline ? 'py-6 flex flex-col items-start gap-3' : 'min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4';
  const body = (
    <Tag className={layout} aria-busy={!error} data-content-state={error ? 'error' : 'pending'}>
      <p className="text-white/70 text-lg" role={error ? 'alert' : 'status'}>{error ? c.error : c.loading}</p>
      {error && (
        <button
          type="button"
          onClick={retry}
          className="rounded-full border border-white/20 px-5 py-2 text-white hover:bg-white/10 transition"
        >
          {c.retry}
        </button>
      )}
    </Tag>
  );
  if (inline) return body;
  return (
    <>
      {body}
      <SiteFooter />
    </>
  );
}

import type { Locale } from '../../lib/seo/locale';
import { hubCopy } from './content/hubCopy';

/**
 * Placeholder while a content file loads on client-side navigation, or the
 * error state (with retry) when it could not be fetched. Prerendered pages
 * never show it: their content is inlined. `inline` renders it inside a page
 * section instead of as the page body.
 */
export function ContentPending({ locale, retry, inline = false }: { locale: Locale; retry?: () => void; inline?: boolean }) {
  const c = hubCopy[locale];
  const error = retry !== undefined;
  const Tag = inline ? 'div' : 'main';
  const layout = inline ? 'py-6 flex flex-col items-start gap-3' : 'min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4';
  return (
    <Tag className={layout} aria-busy={!error}>
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
}

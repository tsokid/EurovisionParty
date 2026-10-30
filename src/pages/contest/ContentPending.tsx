import type { Locale } from '../../lib/seo/locale';
import { hubCopy } from './content/hubCopy';

/**
 * Placeholder while a content file loads on client-side navigation, or the
 * error state (with retry) when it could not be fetched. Prerendered pages
 * never show it: their content is inlined.
 */
export function ContentPending({ locale, retry }: { locale: Locale; retry?: () => void }) {
  const c = hubCopy[locale];
  const error = retry !== undefined;
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4" aria-busy={!error}>
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
    </main>
  );
}

// The doc-level translation flags (CMS P6, spec §4 "EN/EL"): one chip per
// language, «EL: λείπουν 3» in red or «EN: πλήρες» quiet. A red chip jumps to
// the first empty field of that language (the form marks each with
// data-cms-missing, LeafField), switching nothing else.
import type { RefObject } from 'react';
import type { MissingTranslations } from '../../../supabase/functions/_shared/cms/translations';
import { t } from '../i18n';

export function TranslationChips({ missing, formRef }: { missing: MissingTranslations; formRef: RefObject<HTMLElement | null> }) {
  const jump = (locale: 'en' | 'el') => {
    const root = formRef.current;
    if (!root) return;
    const first = root.querySelector<HTMLElement>(`[data-cms-missing][data-cms-field^="${locale}."]`)
      ?? root.querySelector<HTMLElement>(`[data-cms-field="${locale}.${missing[locale][0]}"]`);
    if (!first) return;
    first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    first.focus({ preventScroll: true });
  };
  return (
    <div role="group" aria-label={t.translations.label} className="flex flex-wrap items-center gap-1.5" data-testid="translation-chips">
      {(['en', 'el'] as const).map((l) => {
        const n = missing[l].length;
        const tag = l.toUpperCase();
        return n > 0 ? (
          <button
            key={l}
            type="button"
            onClick={() => jump(l)}
            aria-label={t.translations.jump(tag, n)}
            className="chip chip-bad !text-[12px] !py-0.5 cursor-pointer inline-flex items-center gap-1"
          >
            <span aria-hidden className="inline-block size-1.5 rounded-full bg-current" />
            {t.translations.docMissing(tag, n)}
          </button>
        ) : (
          <span key={l} className="chip !text-[12px] !py-0.5" title={t.translations.complete(tag)}>{t.translations.docComplete(tag)}</span>
        );
      })}
    </div>
  );
}

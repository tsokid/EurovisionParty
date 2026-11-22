// The rich text field's toolbar (inserts the limited Markdown around the
// selection) and its live preview, rendered by the public RichText component.
import type { SyntheticEvent } from 'react';
import RichText from '../../../../../components/cms/RichText';
import { LocaleProvider } from '../../../../../lib/seo/LocaleContext';
import { PreviewModeContext } from '../../../../../lib/seo/PreviewMode';
import { DetachedMemoryRouter } from '../../DetachedMemoryRouter';
import type { Locale } from '../formModel';
import type { MarkdownAction } from './markdownToolbar';
import { SMALL_BUTTON } from './styles';
import { t as tr } from '../../../../i18n';

const TOOLS: { action: MarkdownAction; label: string; text: string; className?: string }[] = [
  { action: 'bold', label: tr.form.md.bold, text: tr.form.mdText.bold, className: 'font-bold' },
  { action: 'italic', label: tr.form.md.italic, text: tr.form.mdText.italic, className: 'italic' },
  { action: 'link', label: tr.form.md.link, text: tr.form.mdText.link },
  { action: 'list', label: tr.form.md.list, text: tr.form.mdText.list },
  { action: 'heading', label: tr.form.md.heading, text: tr.form.mdText.heading },
];

/** `name` is the textarea's accessible name, e.g. "Story (EN)". */
export function RichTextToolbar({ name, onAction }: { name: string; onAction: (a: MarkdownAction) => void }) {
  return (
    <div role="toolbar" aria-label={`Μορφοποίηση: ${name}`} className="flex flex-wrap gap-1">
      {TOOLS.map((t) => (
        <button
          key={t.action}
          type="button"
          aria-label={`${t.label} (${name})`}
          title={t.label}
          // Keep the textarea's selection: the click must not move focus first.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction(t.action)}
          className={`${SMALL_BUTTON}${t.className ? ` ${t.className}` : ''}`}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}

const swallowLinks = (e: SyntheticEvent) => {
  if ((e.target as Element | null)?.closest?.('a')) e.preventDefault();
};

/** The text as the site renders it (links inert). Nothing for empty text. */
export function RichTextPreview({ text, locale }: { text: string; locale: Locale }) {
  if (!text.trim()) return null;
  return (
    <div
      data-testid={`richtext-preview-${locale}`}
      lang={locale}
      onClickCapture={swallowLinks}
      className="rounded border border-white/10 bg-black/20 p-2 text-sm"
    >
      <div className="mb-1 text-[10px] uppercase tracking-wide text-white/30">Preview</div>
      <PreviewModeContext.Provider value={true}>
        <LocaleProvider locale={locale}>
          <DetachedMemoryRouter path={`/${locale}`}>
            <RichText source={text} className="space-y-2 text-white/80 leading-relaxed" />
          </DetachedMemoryRouter>
        </LocaleProvider>
      </PreviewModeContext.Provider>
    </div>
  );
}

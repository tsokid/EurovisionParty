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

const TOOLS: { action: MarkdownAction; label: string; text: string; className?: string }[] = [
  { action: 'bold', label: 'Bold', text: 'B', className: 'font-bold' },
  { action: 'italic', label: 'Italic', text: 'I', className: 'italic' },
  { action: 'link', label: 'Link', text: 'Link' },
  { action: 'list', label: 'List', text: '• List' },
  { action: 'heading', label: 'Heading', text: 'Heading' },
];

/** `name` is the textarea's accessible name, e.g. "Story (EN)". */
export function RichTextToolbar({ name, onAction }: { name: string; onAction: (a: MarkdownAction) => void }) {
  return (
    <div role="toolbar" aria-label={`Formatting for ${name}`} className="flex flex-wrap gap-1">
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

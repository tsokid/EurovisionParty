// The richText toolbar's edits: each inserts the limited Markdown of
// supabase/functions/_shared/cms/richText.ts around the selection and returns
// the new text with the range to select next.

export type MarkdownAction = 'bold' | 'italic' | 'link' | 'list' | 'heading';

export type Edited = { text: string; start: number; end: number };

const SAMPLE: Record<'bold' | 'italic' | 'link', string> = { bold: 'bold text', italic: 'italic text', link: 'link text' };

/** Start of the line holding `pos`. */
const lineStart = (text: string, pos: number) => text.lastIndexOf('\n', pos - 1) + 1;

function lineEnd(text: string, pos: number): number {
  const i = text.indexOf('\n', pos);
  return i === -1 ? text.length : i;
}

export function applyMarkdown(text: string, start: number, end: number, action: MarkdownAction): Edited {
  const sel = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);
  switch (action) {
    case 'bold':
    case 'italic': {
      const mark = action === 'bold' ? '**' : '*';
      const inner = sel || SAMPLE[action];
      const at = start + mark.length;
      return { text: `${before}${mark}${inner}${mark}${after}`, start: at, end: at + inner.length };
    }
    case 'link': {
      const label = sel || SAMPLE.link;
      const url = 'https://';
      const at = start + label.length + 3; // "[" label "]("
      return { text: `${before}[${label}](${url})${after}`, start: at, end: at + url.length };
    }
    case 'list':
    case 'heading': {
      const from = lineStart(text, start);
      const to = action === 'list' ? lineEnd(text, Math.max(start, end - (end > start ? 1 : 0))) : lineEnd(text, start);
      const lines = text.slice(from, to).split('\n');
      const out = action === 'list'
        ? lines.map((l) => (/^\s*$/.test(l) || l.startsWith('- ') ? l : `- ${l}`))
        : lines.map((l) => `### ${l.replace(/^#+\s*/, '')}`);
      const block = out.join('\n');
      return { text: text.slice(0, from) + block + text.slice(to), start: from, end: from + block.length };
    }
  }
}

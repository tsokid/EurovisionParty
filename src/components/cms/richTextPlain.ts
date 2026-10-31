// Plain-text form of a richText source (for FAQPage JSON-LD answers).
import { parseRichText, type RichInline } from '../../../supabase/functions/_shared/cms/richText';

const inline = (nodes: RichInline[]): string =>
  nodes.map((n) => (n.type === 'text' ? n.value : inline(n.children))).join('');

/** Paragraphs, headings and list items joined by single spaces; no markup. */
export function richTextToPlain(source: string): string {
  const parts: string[] = [];
  for (const b of parseRichText(source)) {
    if (b.type === 'list') for (const item of b.items) parts.push(inline(item));
    else parts.push(inline(b.children));
  }
  return parts.map((p) => p.trim()).filter(Boolean).join(' ');
}

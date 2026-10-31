// Renders richText source (limited Markdown, see supabase/functions/_shared/cms/richText.ts)
// as React elements. No raw HTML anywhere: text goes through React's escaping,
// links are either internal (LocaleLink) or https:// with rel noopener.
//
// This file ships in the public client bundle: it imports the zod-free parser
// only, never fields.ts (tests/cms/rendererGuard.test.ts checks both).
import type { ReactNode } from 'react';
import LocaleLink from '../seo/LocaleLink';
import { parseRichText, type RichInline } from '../../../supabase/functions/_shared/cms/richText';

function inline(nodes: RichInline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'text':
        return n.value;
      case 'strong':
        return <strong key={i} className="font-bold text-white">{inline(n.children)}</strong>;
      case 'em':
        return <em key={i}>{inline(n.children)}</em>;
      case 'link':
        return n.href.startsWith('/') ? (
          <LocaleLink key={i} to={n.href} className="text-euro-pink underline underline-offset-2 hover:opacity-80">{inline(n.children)}</LocaleLink>
        ) : (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="text-euro-pink underline underline-offset-2 hover:opacity-80">{inline(n.children)}</a>
        );
    }
  });
}

export default function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = parseRichText(source);
  if (!blocks.length) return null;
  return (
    <div className={className ?? 'space-y-4 text-white/80 leading-relaxed'}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'paragraph':
            return <p key={i}>{inline(b.children)}</p>;
          case 'heading':
            return <h3 key={i} className="text-xl font-bold text-white pt-2">{inline(b.children)}</h3>;
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return (
              <Tag key={i} className={`${b.ordered ? 'list-decimal' : 'list-disc'} pl-6 space-y-1`}>
                {b.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
              </Tag>
            );
          }
        }
      })}
    </div>
  );
}

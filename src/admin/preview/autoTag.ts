// Text-to-field mapping inside the preview (frame side only).
//
// Shared components carry explicit markers (cmsAttrs: the header, the footer,
// the hero, the block zones). The rest of a page's copy is rendered by
// page-specific markup that only receives strings, so the frame maps it by
// text: every string field of the draft (its active locale) is reduced to the
// text it renders (Markdown and the allowed inline HTML stripped, each line and
// paragraph on its own, {placeholders} as wildcards), and an element whose own
// text equals one of them gets that field's data-cms-path, marked
// data-cms-auto so the next pass can clear it. Explicit markers always win.
//
// This runs in the admin only: the public site and the prerender never load it.
import { CMS_PATH_ATTR, cmsPathValue } from '../../lib/cms/cmsAttrs';

export const AUTO_ATTR = 'data-cms-auto';

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'svg', 'SVG', 'path', 'IFRAME', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Whitespace collapsed, trimmed, NFC. */
export const normText = (s: string): string => s.normalize('NFC').replace(/[\s ]+/g, ' ').trim();

/** The text a Markdown or inline-HTML string renders (one chunk). */
export function plainText(s: string): string {
  return normText(
    s
      .replace(/<[^>]*>/g, '')
      .replace(/&(#39|[a-z]+);/gi, (m, e: string) => ENTITIES[e.toLowerCase()] ?? m)
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
      .replace(/(\*\*|__|\*|`)/g, ''),
  );
}

/** The chunks a string field can render as: the whole text, each paragraph, each line. */
export function textChunks(s: string): string[] {
  const out = new Set<string>();
  const add = (c: string) => {
    const p = plainText(c);
    if (p) out.add(p);
  };
  add(s);
  for (const para of s.split(/\n\s*\n/)) add(para);
  for (const line of s.split('\n')) add(line);
  return [...out];
}

type Index = { exact: Map<string, string>; patterns: Array<{ re: RegExp; path: string }> };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every string leaf of `value` as path -> text chunks, in document order. */
export function buildIndex(value: unknown, accept: (path: string) => boolean = () => true): Index {
  const index: Index = { exact: new Map(), patterns: [] };
  const visit = (v: unknown, path: string) => {
    if (typeof v === 'string') {
      if (!path || !accept(path)) return;
      for (const chunk of textChunks(v)) {
        if (/\{[^}]+\}/.test(chunk)) {
          const literal = chunk.replace(/\{[^}]+\}/g, '');
          if (normText(literal).length < 3) continue;
          const source = chunk.split(/\{[^}]+\}/).map(escapeRe).join('.+?');
          index.patterns.push({ re: new RegExp(`^${source}$`, 'u'), path });
        } else if (!index.exact.has(chunk)) {
          index.exact.set(chunk, path);
        }
      }
      return;
    }
    if (Array.isArray(v)) v.forEach((x, i) => visit(x, path ? `${path}.${i}` : String(i)));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, path ? `${path}.${k}` : k);
  };
  visit(value, '');
  return index;
}

const hasOwnText = (el: Element) => [...el.childNodes].some((n) => n.nodeType === 3 && /\S/.test(n.nodeValue ?? ''));

/**
 * Clears the previous pass and tags every element of `root` whose own text
 * renders a string field of `value` (the doc's active locale). Returns the
 * number of elements tagged.
 */
export function autoTag(root: ParentNode, docId: string, locale: string, value: unknown, accept?: (path: string) => boolean): number {
  for (const el of root.querySelectorAll(`[${AUTO_ATTR}]`)) {
    el.removeAttribute(AUTO_ATTR);
    el.removeAttribute(CMS_PATH_ATTR);
  }
  const index = buildIndex(value, accept);
  if (index.exact.size === 0 && index.patterns.length === 0) return 0;
  let n = 0;
  for (const el of root.querySelectorAll('*')) {
    if (SKIP.has(el.tagName) || el.hasAttribute(CMS_PATH_ATTR) || !hasOwnText(el)) continue;
    if (el.closest('svg')) continue;
    const text = normText(el.textContent ?? '');
    if (!text) continue;
    let path = index.exact.get(text);
    if (!path) path = index.patterns.find((p) => p.re.test(text))?.path;
    if (!path) continue;
    el.setAttribute(CMS_PATH_ATTR, cmsPathValue(docId, locale, path));
    el.setAttribute(AUTO_ATTR, '');
    n++;
  }
  return n;
}

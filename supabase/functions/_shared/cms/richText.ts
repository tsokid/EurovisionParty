// Limited Markdown for richText fields (spec §3 "Field kinds").
//
// Allowed: paragraphs (separated by a blank line), `**bold**`, `*italic*`,
// `[label](address)`, bullet lists (`- item`), numbered lists (`1. item`) and
// `### ` headings. Addresses are a page on this site (`/faq`) or `https://`.
// Everything else is an error, never silently kept: raw `<`, images, code,
// quotes, other heading levels, unclosed markers, unsafe or nested links.
// A literal `\ * [ ] ( ) < > # -` is written with a backslash in front.
//
// Zod-free and import-light on purpose: src/components/cms/RichText.tsx
// imports this file, so it ships in the public client bundle.
//
// parseRichText never throws and never produces an unsafe node: a link whose
// address fails isSafeHref comes out as its plain label. richTextErrors says
// what is wrong, with 1-based line numbers, for the editor and validateDocument.
//
// Inline markers do not span lines: a paragraph's lines are parsed one by one
// and joined with a space. List items are one line each.
import { isSafeHref } from './html.ts';

export type RichInline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: RichInline[] }
  | { type: 'em'; children: RichInline[] }
  | { type: 'link'; href: string; children: RichInline[] };

export type RichBlock =
  | { type: 'paragraph'; children: RichInline[] }
  | { type: 'heading'; level: 3; children: RichInline[] }
  | { type: 'list'; ordered: boolean; items: RichInline[][] };

export type RichTextError = { line: number; message: string };

const ESCAPABLE = '\\*[]()<>#-';

function mergeText(nodes: RichInline[]): RichInline[] {
  const out: RichInline[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (n.type === 'text' && last?.type === 'text') last.value += n.value;
    else out.push(n);
  }
  return out;
}

type Stop = '' | '**' | '*' | ']';

function parseLine(src: string, line: number, errors: RichTextError[]): RichInline[] {
  let i = 0;
  const err = (message: string) => errors.push({ line, message });

  const run = (stop: Stop, inLink: boolean): RichInline[] => {
    const out: RichInline[] = [];
    let buf = '';
    const flush = () => {
      if (buf) out.push({ type: 'text', value: buf });
      buf = '';
    };
    while (i < src.length) {
      const c = src[i];
      // Inside *italic*, "**" opens a bold run only after a space; after text it is "*" closing italic then "*"...
      const nestedStrong = stop === '*' && src.startsWith('**', i) && (i === 0 || /\s/.test(src[i - 1]));
      if (stop && !nestedStrong && src.startsWith(stop, i)) break;
      if (c === '\\' && i + 1 < src.length && ESCAPABLE.includes(src[i + 1])) {
        buf += src[i + 1];
        i += 2;
      } else if (c === '<') {
        err('Raw HTML is not allowed (write \\< for a literal <)');
        buf += c;
        i++;
      } else if (c === '`') {
        err('Code is not supported');
        buf += c;
        i++;
      } else if (c === '!' && src[i + 1] === '[') {
        err('Images are not supported in rich text');
        buf += c;
        i++;
      } else if (src.startsWith('**', i)) {
        flush();
        i += 2;
        const children = run('**', inLink);
        if (src.startsWith('**', i)) i += 2;
        else err('Unclosed ** (bold)');
        out.push({ type: 'strong', children });
      } else if (c === '*') {
        flush();
        i += 1;
        const children = run('*', inLink);
        if (src[i] === '*') i += 1;
        else err('Unclosed * (italic)');
        out.push({ type: 'em', children });
      } else if (c === '[') {
        flush();
        if (inLink) err('Links cannot be nested');
        i += 1;
        const children = run(']', true);
        if (src[i] === ']') i += 1;
        else err('Unclosed [ (link label)');
        if (src[i] === '(') {
          const close = src.indexOf(')', i);
          if (close < 0) {
            err('Unclosed ( (link address)');
            i = src.length;
            out.push(...children);
          } else {
            const href = src.slice(i + 1, close);
            i = close + 1;
            if (isSafeHref(href)) out.push({ type: 'link', href, children });
            else {
              err(`Unsafe link address "${href}" (must start with / or https://)`);
              out.push(...children);
            }
          }
        } else {
          err('A link needs an address: [label](/page) or [label](https://...)');
          out.push(...children);
        }
      } else {
        buf += c;
        i++;
      }
    }
    flush();
    return mergeText(out);
  };

  return run('', false);
}

const BULLET = /^[-] (.*)$/;
const NUMBERED = /^\d+\. (.*)$/;
const HEADING = /^(#+)(?: (.*))?$/;

function parse(source: string): { blocks: RichBlock[]; errors: RichTextError[] } {
  const errors: RichTextError[] = [];
  const blocks: RichBlock[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let inPara = false;
  let list: Extract<RichBlock, { type: 'list' }> | null = null;
  const closeAll = () => {
    inPara = false;
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = idx + 1;
    const text = raw.trimEnd();
    if (text.trim() === '') return closeAll();

    const heading = HEADING.exec(text);
    if (heading && /^#/.test(text)) {
      closeAll();
      if (heading[1] !== '###') errors.push({ line, message: 'Only ### headings are supported' });
      else if (!heading[2]?.trim()) errors.push({ line, message: 'Empty heading' });
      blocks.push({ type: 'heading', level: 3, children: parseLine(heading[2] ?? '', line, errors) });
      return;
    }
    if (text.startsWith('>')) {
      errors.push({ line, message: 'Quotes are not supported (write \\> for a literal >)' });
    }
    const bullet = BULLET.exec(text);
    const numbered = bullet ? null : NUMBERED.exec(text);
    const item = bullet ?? numbered;
    if (item) {
      const ordered = !bullet;
      inPara = false;
      if (!list || list.ordered !== ordered) {
        list = { type: 'list', ordered, items: [] };
        blocks.push(list);
      }
      list.items.push(parseLine(item[1], line, errors));
      return;
    }
    list = null;
    const inline = parseLine(text.trim(), line, errors);
    if (inPara) {
      const p = blocks[blocks.length - 1] as Extract<RichBlock, { type: 'paragraph' }>;
      p.children = mergeText([...p.children, { type: 'text', value: ' ' }, ...inline]);
    } else {
      blocks.push({ type: 'paragraph', children: inline });
      inPara = true;
    }
  });
  // One report per line and message: `<b>x</b>` is one problem, not two.
  const seen = new Set<string>();
  const unique = errors.filter((e) => !seen.has(`${e.line}:${e.message}`) && !!seen.add(`${e.line}:${e.message}`));
  return { blocks, errors: unique };
}

/** The AST of `source`. Never throws; unsafe links come out as their label. */
export function parseRichText(source: string): RichBlock[] {
  return parse(source).blocks;
}

/** What is wrong with `source`, with 1-based line numbers; empty when it is valid. */
export function richTextErrors(source: string): RichTextError[] {
  return parse(source).errors;
}

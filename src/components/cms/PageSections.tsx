// The body of a section-based static page as a list (CMS P6, owner decision
// Q4 = B): the page's own sections, placed by `{ type: 'section', key }`
// items of the doc's `layout`, with blocks of the design system's set
// (Blocks.tsx) between them.
//
// pageSections() returns the children to put straight inside LegalFrame or
// ArticleFrame, which read their direct <Section> children for the "on this
// page" menu and the section ids: a function, not a component, so each
// Section stays a direct child. A doc without a layout (every committed doc
// until an editor changes one) gives the sections in the order the page lists
// them and nothing else: exactly the children the page had before layouts
// existed. Consecutive blocks render as one Blocks run, as the old
// extraBlocks zone did.
//
// Zod-free: the public bundle imports this file.
import { cloneElement, Fragment, isValidElement, type ReactNode } from 'react';
import Blocks from './Blocks';
import type { CmsBlock } from './mediaTypes';

/** A layout item: one of the page's sections, or a block. */
export type LayoutItem = { type: 'section'; key: string } | (CmsBlock & { id?: string });

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The layout to render: the doc's, else the sections in the page's order. Unknown sections are skipped. */
export function effectiveLayout(layout: unknown, keys: readonly string[]): LayoutItem[] {
  if (!Array.isArray(layout)) return keys.map((key) => ({ type: 'section', key }));
  return layout.filter((it): it is LayoutItem => isRecord(it) && typeof it.type === 'string'
    && (it.type !== 'section' || (typeof it.key === 'string' && keys.includes(it.key))));
}

/** The blocks of a layout (no sections): what the FAQ JSON-LD merge reads. */
export function layoutBlocks(layout: unknown): CmsBlock[] {
  return Array.isArray(layout) ? layout.filter((it): it is CmsBlock => isRecord(it) && typeof it.type === 'string' && it.type !== 'section') : [];
}

/**
 * The page body: each section (rendered by its function, in layout order)
 * and each run of consecutive blocks, keyed, ready to be the frame's
 * children. `sections` lists the page's sections in their default order.
 */
export function pageSections(layout: unknown, sections: Record<string, () => ReactNode>): ReactNode[] {
  const items = effectiveLayout(layout, Object.keys(sections));
  const out: ReactNode[] = [];
  let run: { start: number; items: CmsBlock[] } | null = null;
  const flush = () => {
    if (run) out.push(<Blocks key={`b:${run.start}`} value={run.items} cms="layout" start={run.start} />);
    run = null;
  };
  items.forEach((it, i) => {
    if (it.type !== 'section') {
      if (run && run.start + run.items.length === i) run.items.push(it);
      else {
        flush();
        run = { start: i, items: [it] };
      }
      return;
    }
    flush();
    const node = sections[it.key]();
    out.push(isValidElement(node) ? cloneElement(node, { key: `s:${it.key}` }) : <Fragment key={`s:${it.key}`}>{node}</Fragment>);
  });
  flush();
  return out;
}

// Pure side of the `extraBlocks` zone of the static pages (see ExtraBlocks.tsx).
import { buildFaqPage } from '../../lib/seo/schema';
import { faqEntries } from './faqEntries';
import type { CmsBlock } from './mediaTypes';

type LdBlock = { '@type'?: unknown; mainEntity?: unknown };

/**
 * The page's JSON-LD with the FAQ blocks of its extraBlocks added. Computed
 * while rendering (effects do not run under SSR). Without FAQ blocks it is the
 * very same list. A page that already emits a FAQPage gets the extra questions
 * appended to it (one FAQPage per page); otherwise one is inserted before the
 * trailing breadcrumb list, or at the end.
 */
export function mergeFaqJsonLd<T extends object>(jsonLd: T[], extra: unknown): T[] {
  // `extra` is a doc's extraBlocks as published: validated by the doc type, typed loosely here.
  const entries = faqEntries(extra as readonly CmsBlock[] | undefined);
  if (!entries.length) return jsonLd;
  const added = buildFaqPage(entries) as unknown as LdBlock & T;
  const own = jsonLd.findIndex((b) => (b as LdBlock)['@type'] === 'FAQPage');
  if (own >= 0) {
    const page = jsonLd[own] as LdBlock;
    const existing = Array.isArray(page.mainEntity) ? page.mainEntity : [];
    const merged = { ...jsonLd[own], mainEntity: [...existing, ...(added.mainEntity as unknown[])] };
    return jsonLd.map((b, i) => (i === own ? merged : b));
  }
  const last = jsonLd.length - 1;
  const atEnd = last >= 0 && (jsonLd[last] as LdBlock)['@type'] === 'BreadcrumbList' ? last : jsonLd.length;
  return [...jsonLd.slice(0, atEnd), added, ...jsonLd.slice(atEnd)];
}

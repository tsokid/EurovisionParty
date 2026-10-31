// FAQPage JSON-LD entries ({ q, a } = FaqEntry of lib/seo/schema.ts, ready for
// buildFaqPage) from a blocks value. Pure, so a page can compute them during
// SSR; Blocks' onFaq reports the same list.
import type { FaqEntry } from '../../lib/seo/schema';
import type { CmsBlock } from './mediaTypes';
import { richTextToPlain } from './richTextPlain';

export function faqEntries(value: readonly CmsBlock[] | undefined): FaqEntry[] {
  const out: FaqEntry[] = [];
  for (const b of Array.isArray(value) ? value : []) {
    if (b?.type !== 'faq' || !Array.isArray(b.items)) continue;
    for (const it of b.items) {
      const q = typeof it?.q === 'string' ? it.q.trim() : '';
      const a = typeof it?.a === 'string' ? richTextToPlain(it.a) : '';
      if (q && a) out.push({ q, a });
    }
  }
  return out;
}

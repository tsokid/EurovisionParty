export interface FaqEntry { q: string; a: string }
export interface StepEntry { title: string; text: string }
export interface RelatedCardEntry { id: string; title: string; blurb: string }

export interface PageContent {
  pageId: string;
  locale: 'en' | 'el';
  meta: { title: string; description: string };
  hero: { eyebrow?: string; title: string; lede: string };
  sections: Array<
    | { type: 'paragraph'; id?: string; title?: string; html: string }
    | { type: 'list'; id?: string; title?: string; items: string[] }
    | { type: 'steps'; id?: string; title?: string; steps: StepEntry[] }
    | { type: 'table'; id?: string; title?: string; headers: string[]; rows: string[][]; caption?: string }
    | { type: 'faq'; id?: string; title?: string; items: FaqEntry[] }
    | { type: 'cta'; id?: string; title: string; body: string; primaryLabel: string; primaryHref: string; secondaryLabel?: string; secondaryHref?: string }
    | { type: 'related'; id?: string; title?: string; cards: RelatedCardEntry[] }
    | { type: 'definitionBlock'; id?: string; html: string }
  >;
}

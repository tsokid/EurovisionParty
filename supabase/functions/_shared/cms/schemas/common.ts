// Building blocks shared by the static-page schemas. Each mirrors a small
// interface that the former src/pages/seo/content/*Copy.ts files repeated.
import { group, list, text, tuple } from '../fields.ts';

/** An internal path such as `/faq`: the same in every locale. */
export const href = () => text({ shared: true, help: 'Internal path, e.g. /faq (same in both languages)' });

/** A related-page card: internal path, card title and one-line blurb. */
export const relatedItem = group({ href: href(), title: text(), blurb: text() });

/** A bullet with a bold lead-in: `{ bold, rest }`. */
export const boldRest = group({ bold: text(), rest: text() });

/** A bullet with a strong lead-in: `{ strong, rest }`, both plain text. */
export const strongRest = group({ strong: text(), rest: text() });

/** A bullet with a strong lead-in whose `rest` is rendered as raw HTML (may contain <em>, <strong>, <a>). */
export const strongRestHtml = group({ strong: text(), rest: text({ rawHtml: true, help: 'HTML' }) });

/** A question and its answer. */
export const qa = group({ q: text(), a: text() });

/** Page meta with only a title, description and keywords. */
export const basicMeta = group({ title: text(), description: text(), keywords: list(text()) });

/** Article JSON-LD headline and description. */
export const articleSchema = group({ articleHeadline: text(), articleDescription: text() });

/** Hero chip, title and lede. */
export const hero = group({ chip: text(), title: text(), lede: text() });

/** Breadcrumb labels for Home and the current page. */
export const crumbs = group({ home: text(), current: text() });

/** Closing call-to-action banner. */
export const cta = group({ title: text(), body: text(), primary: text(), secondary: text() });

/** Three table column headers. */
export const headers3 = tuple([text(), text(), text()]);

/** Two table column headers. */
export const headers2 = tuple([text(), text()]);

/** Meta of the legal pages (privacy, terms, cookies). */
export const legalMeta = group({
  title: text(),
  description: text(),
  schemaDescription: text(),
  webPageDescription: text(),
  webPageMainEntityName: text(),
  webPageMainEntityAbout: text(),
  keywords: list(text()),
});

/** A `{ title, body }` section. */
export const titleBody = group({ title: text(), body: text() });

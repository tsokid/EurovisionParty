// Building blocks shared by the static-page schemas. Each mirrors a small
// interface that the former src/pages/seo/content/*Copy.ts files repeated.
import { group, href as hrefField, list, text, tuple, type GroupFieldOptions, type StringFieldOptions } from '../fields.ts';

/** An internal path such as `/faq`: the same in every locale. */
export const href = () => hrefField({ help: 'Internal path, e.g. /faq (same in both languages)' });

/** Labels of the groups every page has; the form humanises other keys. */
export const META_LABEL = { label: 'Page meta (SEO)' } as const satisfies GroupFieldOptions;
export const HERO_LABEL = { label: 'Hero' } as const satisfies GroupFieldOptions;
export const CTA_LABEL = { label: 'Call to action' } as const satisfies GroupFieldOptions;

/** The page title in search results and the browser tab: aim for 60 characters at most (a warning, not an error). */
export const seoTitle = (opts: StringFieldOptions = {}) =>
  text({ label: 'SEO title', help: 'Shown in search results and the browser tab; about 60 characters at most', softMaxLength: 60, ...opts });

/** The search-result snippet: aim for 160 characters at most (a warning, not an error). */
export const metaDescription = (opts: StringFieldOptions = {}) =>
  text({ label: 'Meta description', help: 'The search-result snippet; about 160 characters at most', softMaxLength: 160, ...opts });

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
export const basicMeta = group({ title: seoTitle(), description: metaDescription(), keywords: list(text()) }, META_LABEL);

/** Article JSON-LD headline and description. */
export const articleSchema = group({ articleHeadline: text(), articleDescription: text() });

/** Hero chip, title and lede. */
export const hero = group({ chip: text(), title: text(), lede: text() }, HERO_LABEL);

/** Breadcrumb labels for Home and the current page. */
export const crumbs = group({ home: text(), current: text() });

/** Closing call-to-action banner. */
export const cta = group({ title: text(), body: text(), primary: text(), secondary: text() }, CTA_LABEL);

/** Three table column headers. */
export const headers3 = tuple([text(), text(), text()]);

/** Two table column headers. */
export const headers2 = tuple([text(), text()]);

/** Meta of the legal pages (privacy, terms, cookies). */
export const legalMeta = group({
  title: seoTitle(),
  description: metaDescription(),
  schemaDescription: metaDescription({ label: 'Schema description' }),
  webPageDescription: text(),
  webPageMainEntityName: text(),
  webPageMainEntityAbout: text(),
  keywords: list(text()),
}, META_LABEL);

/** A `{ title, body }` section. */
export const titleBody = group({ title: text(), body: text() });

/** A HowTo JSON-LD step. */
export const howToStep = group({ name: text(), text: text() });

/** A related card's title and blurb; the page supplies the href. */
export const titleBlurb = group({ title: text(), blurb: text() });

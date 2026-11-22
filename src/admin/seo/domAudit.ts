// What the SEO panel reads from the preview's rendered page (CMS P6, spec
// §4.1: "the checks run on the preview's rendered DOM"). The preview frame
// computes it after every render and posts it to the editor (protocol.ts
// `audit`); the editor turns it into checks (seoChecks.ts).
//
// Pure DOM reading, admin only.

export type DomAudit = {
  /** The text of every <h1>, in document order. */
  h1: string[];
  /** Every <img>: its source and alt attribute (null when the attribute is missing). */
  images: Array<{ src: string; alt: string | null }>;
  /** Every <a href> of the page itself (not the header or footer): the raw href, its rel and text. */
  links: Array<{ href: string; rel: string; text: string }>;
  /** The ids on the page (in-page anchors resolve to these). */
  ids: string[];
};

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * The site header, its drawer and the footer: site-wide docs with their own
 * link model (page ids, never typed paths), checked on their own screens.
 * Their links are left out of a page's link check; their h1s and images
 * (none today) still count.
 */
export const CHROME_SELECTOR = 'header.topbar, #site-drawer, footer.footer';

/** The audit of `scope` (the preview's page; the admin's own overlays hold no h1, images or links). */
export function auditDom(scope: ParentNode): DomAudit {
  const h1 = [...scope.querySelectorAll('h1')].map((el) => norm(el.textContent));
  const images = [...scope.querySelectorAll('img')].map((img) => ({ src: img.getAttribute('src') ?? '', alt: img.hasAttribute('alt') ? img.getAttribute('alt') : null }));
  const links = [...scope.querySelectorAll('a[href]')].filter((a) => !a.closest(CHROME_SELECTOR)).map((a) => ({ href: a.getAttribute('href') ?? '', rel: a.getAttribute('rel') ?? '', text: norm(a.textContent).slice(0, 80) }));
  const ids = [...scope.querySelectorAll('[id]')].map((el) => el.id).filter(Boolean);
  return { h1, images, links, ids };
}

/** Equality of two audits (the frame posts only a changed one). */
export const sameAudit = (a: DomAudit | null, b: DomAudit): boolean => !!a && JSON.stringify(a) === JSON.stringify(b);

import type { HreflangLink } from './hreflang';

export interface HeadInput {
  title: string;
  description: string;
  /** Omit for pages that must not be canonicalised (404). Also drives og:url. */
  canonical?: string;
  /** e.g. 'noindex' for the 404 page. */
  robots?: string;
  jsonLd?: object | object[];
  hreflang?: HreflangLink[];
  ogLocale?: 'en_US' | 'el_GR';
  ogLocaleAlternate?: ('en_US' | 'el_GR')[];
  // Per-page Open Graph + Twitter overrides. Static defaults live in index.html.
  ogType?: 'website' | 'article';
  ogImage?: string; // absolute URL
  twitterTitle?: string;
  twitterDescription?: string;
  // Article-only (sets article:published_time / article:modified_time)
  articlePublishedTime?: string; // ISO 8601
  articleModifiedTime?: string;  // ISO 8601
  // Page-level keywords (low SEO weight but harmless and useful for some
  // social previews and internal tooling).
  keywords?: string[];
}

const DEFAULT_OG_IMAGE = 'https://eurovision.games/logo.png';

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const metaName = (name: string, content: string) => `<meta name="${name}" content="${esc(content)}">`;
const metaProp = (prop: string, content: string) => `<meta property="${prop}" content="${esc(content)}">`;

/**
 * Attribute on every prerendered tag that SchemaHead's effect *appends*
 * (rather than updates in place). The client removes these before appending
 * its own, so hydration never duplicates them.
 */
export const SSR_ATTR = 'data-ssr';
const ssrProp = (prop: string, content: string) => `<meta property="${prop}" content="${esc(content)}" ${SSR_ATTR}>`;

/** HTML string for every head tag SchemaHead writes client-side in its effect. */
export function headTagsHtml(input: HeadInput): string {
  const {
    title, description, canonical, robots, jsonLd, hreflang, ogLocale, ogLocaleAlternate,
    ogType, ogImage, twitterTitle, twitterDescription,
    articlePublishedTime, articleModifiedTime, keywords,
  } = input;
  const image = ogImage ?? DEFAULT_OG_IMAGE;
  const out: string[] = [
    `<title>${esc(title)}</title>`,
    metaName('description', description),
    metaProp('og:title', title),
    metaProp('og:description', description),
    metaProp('og:type', ogType ?? 'website'),
    metaProp('og:image', image),
    metaName('twitter:image', image),
    metaName('twitter:card', 'summary_large_image'),
    metaName('twitter:title', twitterTitle ?? title),
    metaName('twitter:description', twitterDescription ?? description),
  ];
  if (canonical) out.push(metaProp('og:url', canonical));
  if (robots) out.push(metaName('robots', robots));
  if (ogLocale) out.push(metaProp('og:locale', ogLocale));
  for (const loc of ogLocaleAlternate ?? []) out.push(ssrProp('og:locale:alternate', loc));
  if (keywords && keywords.length) out.push(metaName('keywords', keywords.join(', ')));
  if (ogType === 'article') {
    if (articlePublishedTime) out.push(ssrProp('article:published_time', articlePublishedTime));
    if (articleModifiedTime) out.push(ssrProp('article:modified_time', articleModifiedTime));
  }
  if (canonical) out.push(`<link rel="canonical" href="${esc(canonical)}">`);
  for (const h of hreflang ?? []) {
    out.push(`<link rel="alternate" hreflang="${esc(h.hreflang)}" href="${esc(h.href)}" ${SSR_ATTR}>`);
  }
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  for (const b of blocks) {
    out.push(`<script type="application/ld+json" ${SSR_ATTR}>${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`);
  }
  return out.join('\n');
}

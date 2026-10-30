import type { HreflangLink } from './hreflang';

export interface HeadInput {
  title: string;
  description: string;
  canonical: string;
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

/** HTML string for every head tag SchemaHead writes client-side in its effect. */
export function headTagsHtml(input: HeadInput): string {
  const {
    title, description, canonical, jsonLd, hreflang, ogLocale, ogLocaleAlternate,
    ogType, ogImage, twitterTitle, twitterDescription,
    articlePublishedTime, articleModifiedTime, keywords,
  } = input;
  const image = ogImage ?? DEFAULT_OG_IMAGE;
  const out: string[] = [
    `<title>${esc(title)}</title>`,
    metaName('description', description),
    metaProp('og:title', title),
    metaProp('og:description', description),
    metaProp('og:url', canonical),
    metaProp('og:type', ogType ?? 'website'),
    metaProp('og:image', image),
    metaName('twitter:image', image),
    metaName('twitter:card', 'summary_large_image'),
    metaName('twitter:title', twitterTitle ?? title),
    metaName('twitter:description', twitterDescription ?? description),
  ];
  if (ogLocale) out.push(metaProp('og:locale', ogLocale));
  for (const loc of ogLocaleAlternate ?? []) out.push(metaProp('og:locale:alternate', loc));
  if (keywords && keywords.length) out.push(metaName('keywords', keywords.join(', ')));
  if (ogType === 'article') {
    if (articlePublishedTime) out.push(metaProp('article:published_time', articlePublishedTime));
    if (articleModifiedTime) out.push(metaProp('article:modified_time', articleModifiedTime));
  }
  out.push(`<link rel="canonical" href="${esc(canonical)}">`);
  for (const h of hreflang ?? []) {
    out.push(`<link rel="alternate" hreflang="${esc(h.hreflang)}" href="${esc(h.href)}">`);
  }
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  for (const b of blocks) {
    out.push(`<script type="application/ld+json">${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`);
  }
  return out.join('\n');
}

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';
import { localizePath } from '../../src/lib/seo/locale';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE = 'https://eurovision.games';
const OUT = resolve(__dirname, '../../public/sitemap.xml');

interface UrlEntry {
  loc: string;
  alternates: { hreflang: string; href: string }[];
  priority: number;
  changefreq: string;
}

function buildEntries(): UrlEntry[] {
  const entries: UrlEntry[] = [];
  for (const page of PAGE_REGISTRY) {
    const enUrl = page.greekExclusive ? null : SITE + localizePath('en', page.slugByLocale.en);
    const elUrl = page.englishExclusive ? null : SITE + localizePath('el', page.slugByLocale.el);
    const alternates: UrlEntry['alternates'] = [];
    if (enUrl) alternates.push({ hreflang: 'en', href: enUrl });
    if (elUrl) alternates.push({ hreflang: 'el', href: elUrl });
    alternates.push({ hreflang: 'x-default', href: enUrl ?? elUrl! });

    if (enUrl) {
      entries.push({ loc: enUrl, alternates, priority: page.priority, changefreq: page.changefreq });
    }
    if (elUrl) {
      entries.push({ loc: elUrl, alternates, priority: page.priority, changefreq: page.changefreq });
    }
  }
  return entries;
}

function entryXml(e: UrlEntry): string {
  const alts = e.alternates
    .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
    .join('\n');
  return [
    '  <url>',
    `    <loc>${e.loc}</loc>`,
    `    <changefreq>${e.changefreq}</changefreq>`,
    `    <priority>${e.priority.toFixed(1)}</priority>`,
    alts,
    '  </url>',
  ].join('\n');
}

function buildXml(entries: UrlEntry[]): string {
  const body = entries.map(entryXml).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset',
    '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '  xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    body,
    '</urlset>',
    '',
  ].join('\n');
}

const entries = buildEntries();
const xml = buildXml(entries);
writeFileSync(OUT, xml, 'utf8');
console.log(`Sitemap written: ${OUT} (${entries.length} URLs)`);

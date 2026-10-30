export interface BuiltPage {
  url: string;
  html: string;
}

function tagAttr(html: string, tag: RegExp, attr: string): string | null {
  const m = html.match(tag);
  if (!m) return null;
  const a = m[0].match(new RegExp(`${attr}\s*=\s*"([^"]*)"`, 'i'));
  return a ? a[1].trim() : null;
}

function titleOf(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

const descOf = (html: string) => tagAttr(html, /<meta\b[^>]*name\s*=\s*"description"[^>]*>/i, 'content');
const canonicalOf = (html: string) => tagAttr(html, /<link\b[^>]*rel\s*=\s*"canonical"[^>]*>/i, 'href');

function localeOf(url: string): string {
  return new URL(url).pathname.split('/').filter(Boolean)[0] ?? '';
}

/** Returns a list of problems; empty means the prerendered output passes. */
export function checkPrerender(pages: BuiltPage[], sitemapLocs: string[], has404: boolean): string[] {
  const errors: string[] = [];
  const urls = new Set(pages.map((p) => p.url));

  for (const loc of sitemapLocs) {
    if (!urls.has(loc)) errors.push(`sitemap URL has no built file: ${loc}`);
  }
  if (!has404) errors.push('dist/404.html is missing');

  const seenTitle = new Map<string, string>();
  const seenDesc = new Map<string, string>();
  for (const { url, html } of pages) {
    const locale = localeOf(url);
    const title = titleOf(html);
    if (!title) errors.push(`missing <title>: ${url}`);
    else {
      const key = `${locale}\n${title}`;
      const prev = seenTitle.get(key);
      if (prev) errors.push(`duplicate title "${title}": ${prev} and ${url}`);
      else seenTitle.set(key, url);
    }
    const desc = descOf(html);
    if (!desc) errors.push(`missing meta description: ${url}`);
    else {
      const key = `${locale}\n${desc}`;
      const prev = seenDesc.get(key);
      if (prev) errors.push(`duplicate description "${desc}": ${prev} and ${url}`);
      else seenDesc.set(key, url);
    }
    const canonical = canonicalOf(html);
    if (canonical !== url) errors.push(`canonical mismatch: ${url} has canonical ${canonical ?? '(none)'}`);
  }
  return errors;
}

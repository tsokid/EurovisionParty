import type { Locale } from '../../src/lib/seo/locale';

export interface PrerenderedPage {
  html: string;
  headHtml: string;
  lang: Locale;
}

const SEO_START = '<!--seo:start-->';
const SEO_END = '<!--seo:end-->';
const APP_START = '<!--app:start-->';
const APP_END = '<!--app:end-->';

function requireMarker(template: string, marker: string): number {
  const i = template.indexOf(marker);
  if (i === -1) throw new Error(`injectPage: missing marker ${marker} in template`);
  return i;
}

/**
 * Replace [start, end] (markers included) with `content`. With `trim`, also
 * swallows the whitespace around the block so the replacement sits flush
 * against its parent — #root must contain exactly the React markup to hydrate.
 */
function replaceBlock(template: string, start: string, end: string, content: string, trim: boolean): string {
  let from = requireMarker(template, start);
  let to = requireMarker(template, end) + end.length;
  if (to < from) throw new Error(`injectPage: marker ${end} precedes ${start}`);
  if (trim) {
    while (from > 0 && /\s/.test(template[from - 1])) from--;
    while (to < template.length && /\s/.test(template[to])) to++;
  }
  return template.slice(0, from) + content + template.slice(to);
}

export interface InjectOptions {
  /**
   * Mark #root with data-prerendered so the client hydrates (default true).
   * false for 404.html: it is served for arbitrary URLs, so its markup will not
   * match what the client renders there — the client must createRoot instead.
   */
  prerenderedFlag?: boolean;
}

/** Fill the built SPA shell with one page's server-rendered head and body. */
export function injectPage(template: string, page: PrerenderedPage, opts: InjectOptions = {}): string {
  const { prerenderedFlag = true } = opts;
  let out = replaceBlock(template, SEO_START, SEO_END, page.headHtml, false);
  out = replaceBlock(out, APP_START, APP_END, page.html, true);

  if (!/<html lang="[^"]*">/.test(out)) throw new Error('injectPage: missing marker <html lang="…">');
  out = out.replace(/<html lang="[^"]*">/, () => `<html lang="${page.lang}">`);

  if (!out.includes('<div id="root">')) throw new Error('injectPage: missing marker <div id="root">');
  if (!prerenderedFlag) return out;
  out = out.replace('<div id="root">', () => '<div id="root" data-prerendered="true">');
  return out;
}

/** `/en` → `en.html`, `/en/how-to-play` → `en/how-to-play.html` (served via Vercel cleanUrls). */
export function outputPath(urlPath: string): string {
  const trimmed = urlPath.replace(/^\/+|\/+$/g, '');
  if (!trimmed) throw new Error(`outputPath: cannot map root path "${urlPath}"`);
  return `${trimmed}.html`;
}

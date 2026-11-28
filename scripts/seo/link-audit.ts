/**
 * Internal links that do not land directly on a page (28 Nov 2026): every
 * href in the built dist/ HTML, routed through vercel.json like Vercel
 * would. Reports links that pass through a redirect, end on a 404, or move a
 * Greek page's reader to an English page. Run after a build:
 *   npx tsx scripts/seo/link-audit.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveUrl, type VercelConfig } from './resolveUrl';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = join(ROOT, 'dist');
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as VercelConfig;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const files = walk(DIST).filter((f) => !/[\/](index|404)\.html$/.test(f) || /[\/](en|el)[\/]/.test(f));
const built = new Set<string>();
for (const f of files) {
  const rel = relative(DIST, f).split(sep).join('/');
  built.add('/' + rel.replace(/\/index\.html$/, '').replace(/\.html$/, ''));
}

type Hit = { page: string; href: string; final: string; hops: number; status: number };
const hits: Hit[] = [];
for (const f of files) {
  const page = '/' + relative(DIST, f).split(sep).join('/').replace(/\.html$/, '');
  const html = readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    let href = m[1].replace(/&amp;/g, '&');
    if (href.startsWith('https://eurovision.games')) href = href.slice('https://eurovision.games'.length) || '/';
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const path = href.split(/[?#]/)[0] || '/';
    if (path.startsWith('/room/') || path.startsWith('/admin')) continue;
    const r = resolveUrl(path, vercel, built, { acceptLanguage: page.startsWith('/el') ? 'el' : 'en' });
    const langJump = page.startsWith('/el') && r.final.startsWith('/en');
    if (r.hops > 0 || r.status === 404 || langJump) hits.push({ page, href, final: r.final, hops: r.hops, status: r.status });
  }
}

const byPage = new Map<string, Hit[]>();
for (const h of hits) byPage.set(h.page, [...(byPage.get(h.page) ?? []), h]);
const byHref = new Map<string, number>();
for (const h of hits) byHref.set(`${h.href} → ${h.final} (${h.status}${h.hops ? `, ${h.hops} redirect` : ''})`, (byHref.get(`${h.href} → ${h.final} (${h.status}${h.hops ? `, ${h.hops} redirect` : ''})`) ?? 0) + 1);
console.log(`${hits.length} links on ${byPage.size} pages do not land directly:`);
for (const [k, n] of [...byHref].sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${k}`);
process.exitCode = hits.length ? 1 : 0;

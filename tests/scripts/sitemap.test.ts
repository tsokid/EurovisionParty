import { describe, it, expect, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The script writes to a temp file here: the tracked public/sitemap.xml is
// only (re)written by `npm run build` (prebuild), never by the test run.
const dir = mkdtempSync(join(tmpdir(), 'sitemap-test-'));
const out = join(dir, 'sitemap.xml');
const tracked = resolve(process.cwd(), 'public/sitemap.xml');

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('sitemap.xml', () => {
  it('regenerates with hreflang entries', () => {
    const before = statSync(tracked).mtimeMs;
    execSync(`npm run sitemap -- "${out}"`, { stdio: 'pipe' });
    expect(statSync(tracked).mtimeMs, 'public/sitemap.xml must not be rewritten').toBe(before);
    const xml = readFileSync(out, 'utf8');
    expect(xml).toContain('<urlset');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain('hreflang="en"');
    expect(xml).toContain('hreflang="el"');
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).toContain('https://eurovision.games/en/eurovision-night');
    expect(xml).toContain('https://eurovision.games/el/eurovision-night');
    // Data-driven pages: indexable ones are listed, noindex ones are not (e.g. one-participation countries).
    expect(xml).toContain('https://eurovision.games/en/eurovision-2026</loc>');
    expect(xml).toContain('https://eurovision.games/el/countries</loc>');
    expect(xml).toContain('https://eurovision.games/en/past-contests</loc>');
    expect(xml).toContain('https://eurovision.games/en/countries/greece</loc>');
    expect(xml).not.toContain('https://eurovision.games/en/countries/morocco</loc>');
    // Every archived year (1956-2025) is indexable: listed in both locales.
    expect(xml).toContain('https://eurovision.games/en/past-contests/eurovision-2019-tel-aviv</loc>');
    expect(xml).toContain('https://eurovision.games/el/past-contests/eurovision-1956-lugano</loc>');
    expect(xml.match(/<loc>https:\/\/eurovision\.games\/(en|el)\/past-contests\/eurovision-\d{4}-[a-z-]+<\/loc>/g)).toHaveLength(140);
  }, 120_000); // spawns tsx and ~80 git log calls: slow under full-suite load

  // 23 Nov 2026: on Vercel's shallow clone every URL got the build date.
  const lastmods = (xml: string) => [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);

  it('with full git history, lastmod follows each page (not one date for all)', () => {
    const xml = readFileSync(out, 'utf8');
    expect(new Set(lastmods(xml)).size).toBeGreaterThan(3);
  });

  it('in a shallow clone it keeps the committed lastmod of each URL', () => {
    const shallowOut = join(dir, 'shallow.xml');
    execSync(`npm run sitemap -- "${shallowOut}"`, { stdio: 'pipe', env: { ...process.env, SITEMAP_ASSUME_SHALLOW: '1' } });
    const committed = new Map(
      [...readFileSync(tracked, 'utf8').matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]),
    );
    const xml = readFileSync(shallowOut, 'utf8');
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
      if (committed.has(m[1])) expect(m[2], m[1]).toBe(committed.get(m[1]));
    }
  }, 120_000);
});

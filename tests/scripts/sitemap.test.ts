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
    // Data-driven pages: indexable ones are listed, noindex ones are not.
    expect(xml).toContain('https://eurovision.games/en/eurovision-2026</loc>');
    expect(xml).toContain('https://eurovision.games/el/countries</loc>');
    expect(xml).toContain('https://eurovision.games/en/past-contests</loc>');
    expect(xml).toContain('https://eurovision.games/en/countries/greece</loc>');
    expect(xml).not.toContain('https://eurovision.games/en/countries/morocco</loc>');
    expect(xml).not.toContain('https://eurovision.games/en/past-contests/eurovision-2019-tel-aviv</loc>');
  }, 120_000); // spawns tsx and ~80 git log calls: slow under full-suite load
});

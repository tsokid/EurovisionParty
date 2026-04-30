import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('sitemap.xml', () => {
  it('regenerates with hreflang entries', () => {
    execSync('npm run sitemap', { stdio: 'pipe' });
    const xml = readFileSync(resolve(process.cwd(), 'public/sitemap.xml'), 'utf8');
    expect(xml).toContain('<urlset');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain('hreflang="en"');
    expect(xml).toContain('hreflang="el"');
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).toContain('https://eurovision.games/en/eurovision-night');
    expect(xml).toContain('https://eurovision.games/el/eurovision-night');
  });
});

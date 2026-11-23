// Owner, 23 Nov 2026 (option A): the site's fonts are served from
// eurovision.games itself. The CSP allows fonts and stylesheets from 'self'
// only, so a Google Fonts link was silently blocked and every page fell back
// to the system font; Space Grotesk and Bebas Neue also had no Greek.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const css = readFileSync(resolve(root, 'src/index.css'), 'utf8');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

describe('self-hosted fonts', () => {
  it('loads no font or font stylesheet from another host', () => {
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(css).not.toMatch(/Space Grotesk|Bebas Neue/);
  });

  it('declares Manrope and Sofia Sans Extra Condensed with Greek, from files that exist', () => {
    const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
    const of = (family: string) => faces.filter((f) => f.includes(`'${family}'`));
    for (const family of ['Manrope', 'Sofia Sans Extra Condensed']) {
      const fs = of(family);
      expect(fs.length).toBe(3);
      expect(fs.some((f) => f.includes('U+0370-0377'))).toBe(true);
      for (const f of fs) {
        const url = /url\('([^']+)'\)/.exec(f)![1];
        expect(url.startsWith('/fonts/')).toBe(true);
        expect(existsSync(resolve(root, 'public', url.slice(1)))).toBe(true);
        expect(f).toMatch(/font-display:\s*swap/);
      }
    }
  });

  it('uses them for the text and the numerals, and preloads the Latin text face', () => {
    expect(css).toMatch(/--font-sans:\s*'Manrope'/);
    expect(css).toMatch(/--font-stage:\s*'Manrope'/);
    expect(css).toMatch(/--font-stage-num:\s*'Sofia Sans Extra Condensed'/);
    expect(html).toContain('<link rel="preload" href="/fonts/manrope-v23-latin.woff2" as="font" type="font/woff2" crossorigin />');
  });
});

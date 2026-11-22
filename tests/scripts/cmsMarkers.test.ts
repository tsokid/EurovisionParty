// @vitest-environment node
// P4 build check: the preview's click-to-edit markers (data-cms-path) never
// reach the site. Three layers: the build step's scanner, every page the
// prerender renders (both locales, the data pages too), and, after
// `npm run build`, every text file in dist/.
import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { findMarkers, MARKER } from '../../scripts/cms/check-no-cms-markers';
import { render } from '../../src/entry-server';
import { allPageUrls } from '../../src/lib/seo/registry';
import pkg from '../../package.json';

const ROOT = resolve(__dirname, '../..');

describe('check-no-cms-markers', () => {
  it('is the attribute cmsAttrs renders', () => {
    expect(MARKER).toBe('data-cms-path');
  });

  it('finds a marker in any text file of dist and ignores binaries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cms-markers-'));
    try {
      mkdirSync(join(dir, 'en'));
      mkdirSync(join(dir, 'assets'));
      writeFileSync(join(dir, 'en', 'faq.html'), '<h1 data-cms-path="faq:en:hero.title">x</h1>');
      writeFileSync(join(dir, 'assets', 'a.js'), 'const ok = 1;');
      writeFileSync(join(dir, 'assets', 'b.json'), '{"x":"data-cms-path"}');
      writeFileSync(join(dir, 'assets', 'c.webp'), 'data-cms-path');
      expect(findMarkers(dir)).toEqual([{ file: 'assets/b.json', count: 1 }, { file: 'en/faq.html', count: 1 }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('runs in npm run build, after the prerender check', () => {
    const steps = pkg.scripts.build.split('&&').map((s: string) => s.trim());
    expect(steps.indexOf('tsx scripts/cms/check-no-cms-markers.ts')).toBe(steps.indexOf('tsx scripts/seo/check-prerender.ts') + 1);
  });
});

describe('the prerender never renders a marker', () => {
  it('every static page, both locales, and the 404 page', async () => {
    const hits: string[] = [];
    for (const url of [...allPageUrls().map((u) => u.path), '/en/__404', '/el/__404']) {
      const r = await render(url);
      if (r.html.includes(MARKER) || JSON.stringify(r.content).includes(MARKER)) hits.push(url);
    }
    expect(hits).toEqual([]);
  }, 120_000);
});

const built = existsSync(resolve(ROOT, 'dist/assets'));
describe.skipIf(!built)('after npm run build', () => {
  it('dist/ holds no data-cms-path anywhere', () => {
    expect(findMarkers(resolve(ROOT, 'dist'))).toEqual([]);
  });
});

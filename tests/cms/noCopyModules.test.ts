// @vitest-environment node
// Page copy lives in content/pages/*.json. No per-page "Copy" module may come
// back under src/pages/seo/content or src/pages/content.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(__dirname, '../../src');

/** Kept on purpose: contest data templates (3b) and the live-contest facts helper. */
const ALLOWED = new Set(['contestText.ts']);

const dirs = ['pages/seo/content', 'pages/content'];

describe('no per-page copy modules remain', () => {
  it.each(dirs)('src/%s holds no *Copy.ts, and only allowed files', (dir) => {
    const path = resolve(SRC, dir);
    const files = existsSync(path) ? readdirSync(path) : [];
    expect(files.filter((f) => /Copy\.tsx?$/.test(f)), `${dir} *Copy modules`).toEqual([]);
    expect(files.filter((f) => !ALLOWED.has(f)), `${dir} unexpected files`).toEqual([]);
  });

  it('the contest copy templates are the only *Copy modules in src', () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(resolve(SRC, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/Copy\.tsx?$/.test(e.name)) found.push(rel);
      }
    };
    walk('.');
    expect(found.sort()).toEqual([
      './pages/contest/content/archiveCopy.ts',
      './pages/contest/content/countryCopy.ts',
      './pages/contest/content/hubCopy.ts',
    ]);
  });
});

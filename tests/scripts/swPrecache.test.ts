// @vitest-environment node
// The service worker precaches the public app for every visitor; the lazy
// admin (and any chunk only it loads) must not be in that manifest. Runs
// against the last `npm run build`; skipped when dist/sw.js is missing.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');
const SW = resolve(DIST, 'sw.js');
// The build moves the Vite manifest out of dist/ (scripts/move-build-manifest.ts).
const MANIFEST = resolve(__dirname, '../../dist-meta/manifest.json');
const built = existsSync(SW) && existsSync(MANIFEST);

if (!built) console.warn('swPrecache.test: dist/sw.js not found — run `npm run build` first; skipping.');

type Entry = { file: string; isEntry?: boolean; isDynamicEntry?: boolean; imports?: string[]; dynamicImports?: string[] };

describe.skipIf(!built)('service worker precache (dist/sw.js)', () => {
  const sw = built ? readFileSync(SW, 'utf8') : '';
  const manifest: Record<string, Entry> = built ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  const precached = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);

  // Public chunks: the entry and its static imports.
  const reach = (start: string[], out = new Set<string>()) => {
    const walk = (key: string) => {
      const e = manifest[key];
      if (!e || out.has(key)) return;
      out.add(key);
      (e.imports ?? []).forEach(walk);
    };
    start.forEach(walk);
    return out;
  };
  const entryKeys = Object.keys(manifest).filter((k) => manifest[k].isEntry);
  const publicKeys = reach(entryKeys);
  const adminKey = Object.keys(manifest).find((k) => /src\/admin\/AdminRoute\.tsx$/.test(k));
  const adminOnly = adminKey ? [...reach([adminKey])].filter((k) => !publicKeys.has(k)).map((k) => manifest[k].file) : [];

  it('precaches the public entry chunk', () => {
    expect(precached.length).toBeGreaterThan(0);
    for (const k of entryKeys) expect(precached).toContain(manifest[k].file);
  });

  it('does not precache the admin chunk or any chunk only the admin loads', () => {
    expect(adminKey, 'no AdminRoute chunk in the build manifest').toBeDefined();
    expect(adminOnly.length).toBeGreaterThan(0);
    for (const file of adminOnly) expect(precached, `${file} is precached`).not.toContain(file);
    expect(precached.some((u) => /AdminRoute-/.test(u))).toBe(false);
  });
});

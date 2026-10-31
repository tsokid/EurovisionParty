// @vitest-environment node
// Guards the split content loading: the content snapshot (~1.7 MB) must never
// ship in the client JS. Runs against the last `npm run build`; skipped when
// dist/ is missing.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');
const ASSETS = resolve(DIST, 'assets');
const built = existsSync(ASSETS);

// Strings that exist only in content/contests/1956.json and 1957.json (not in
// src/ or the CMS page docs: "Lys Assia" is also in content/pages/winners.json,
// so it cannot be the marker).
const SNAPSHOT_MARKERS = ['Fud Leclerc', 'Messieurs les noyés de la Seine', 'Bobbejaan Schoepen'];

if (!built) {
  console.warn('bundleSize.test: dist/assets not found — run `npm run build` first; skipping.');
}

describe.skipIf(!built)('client bundle (dist/)', () => {
  const jsFiles = built
    ? readdirSync(ASSETS).filter((f) => f.endsWith('.js')).map((f) => ({ f, size: statSync(resolve(ASSETS, f)).size }))
    : [];
  const read = (f: string) => readFileSync(resolve(ASSETS, f), 'utf8');

  // CMS 3b: the admin is a lazy chunk. Public chunks = the entry plus every
  // chunk reachable from it through *static* imports (dynamic imports, i.e.
  // the admin, are excluded). Walked via the Vite manifest.
  type Entry = { file: string; isEntry?: boolean; imports?: string[]; dynamicImports?: string[] };
  const manifestPath = resolve(DIST, '.vite/manifest.json');
  const manifest: Record<string, Entry> = built && existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const entry = Object.values(manifest).find((e) => e.isEntry && e.file.endsWith('.js'));
  const publicFiles = new Set<string>();
  const walk = (key: string) => {
    const e = manifest[key];
    if (!e || publicFiles.has(e.file)) return;
    publicFiles.add(e.file);
    (e.imports ?? []).forEach(walk);
  };
  const entryKey = Object.keys(manifest).find((k) => manifest[k] === entry);
  if (entryKey) walk(entryKey);
  const publicNames = [...publicFiles].map((f) => f.replace(/^assets\//, ''));
  // Only the admin UI contains this (src/admin/AdminLogin.tsx).
  const ADMIN_MARKER = 'Admin access';
  // The page preview (src/admin/modules/pages/PreviewPane.tsx) is admin-only too.
  const PREVIEW_MARKER = 'Preview — links are disabled';
  const mainFile = entry ? entry.file.replace(/^assets\//, '') : '';
  const mainSize = jsFiles.find((j) => j.f === mainFile)?.size ?? 0;

  it('the build manifest identifies an entry chunk', () => {
    expect(entry, 'no entry in dist/.vite/manifest.json').toBeDefined();
    console.log(`bundleSize.test: main chunk ${mainFile} = ${mainSize} bytes`);
  });

  it('no JS asset contains the content snapshot', () => {
    for (const { f } of jsFiles) {
      const src = read(f);
      for (const marker of SNAPSHOT_MARKERS) expect(src.includes(marker), `${marker} in ${f}`).toBe(false);
    }
  });

  // CMS 3a: schemas are imported by components as types only (z.infer); zod
  // itself must never reach the client. "ZodError" is a class-name string zod
  // keeps even when minified. 3b: the admin chunk may legitimately load zod,
  // so this is enforced on the public chunks only.
  it('no public chunk contains zod or admin UI', () => {
    expect(publicNames.length).toBeGreaterThan(0);
    for (const f of publicNames) {
      const src = read(f);
      expect(src.includes('ZodError'), `ZodError in public chunk ${f}`).toBe(false);
      expect(src.includes(ADMIN_MARKER), `admin UI in public chunk ${f}`).toBe(false);
      expect(src.includes(PREVIEW_MARKER), `admin preview in public chunk ${f}`).toBe(false);
    }
  });

  it('the admin ships as its own lazy chunk, not loaded by public routes', () => {
    const adminChunks = jsFiles.filter(({ f }) => read(f).includes(ADMIN_MARKER));
    expect(adminChunks.length, 'no chunk contains the admin UI').toBeGreaterThan(0);
    for (const { f } of adminChunks) {
      expect(publicNames.includes(f), `${f} is statically imported by the entry`).toBe(false);
      console.log(`bundleSize.test: admin chunk ${f} = ${statSync(resolve(ASSETS, f)).size} bytes`);
    }
  });

  // Regression guard (final review M4): the main chunk was 1,731,226 bytes
  // raw after sub-project 2b. Raise the budget deliberately, never silently.
  const MAIN_CHUNK_BUDGET = 1_760_000;

  it(`the main chunk stays within ${MAIN_CHUNK_BUDGET} bytes raw`, () => {
    expect(mainSize, `${mainFile} is ${mainSize} bytes`).toBeGreaterThan(0);
    expect(mainSize, `${mainFile} is ${mainSize} bytes`).toBeLessThanOrEqual(MAIN_CHUNK_BUDGET);
  });

  it('the snapshot is published as static JSON under dist/content', () => {
    const site = JSON.parse(readFileSync(resolve(DIST, 'content/site.json'), 'utf8'));
    expect(site.current_year).toBeTypeOf('number');
    const contest = JSON.parse(readFileSync(resolve(DIST, `content/contests/${site.current_year}.json`), 'utf8'));
    expect(contest.year).toBe(site.current_year);
    expect(readFileSync(resolve(DIST, 'content/contests/1956.json'), 'utf8')).toContain('Fud Leclerc');
    expect(existsSync(resolve(DIST, 'content/countries/GR.json'))).toBe(true);
  });
});

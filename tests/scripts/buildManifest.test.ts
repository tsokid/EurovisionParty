// @vitest-environment node
// Minor 3: Vite's build manifest (dist/.vite/manifest.json) lists every
// chunk, the admin's included. dist/ is what Vercel serves, so the build
// moves the manifest to dist-meta/ (not deployed) once check-prerender has
// passed; the bundle and service-worker tests read it from there.
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { moveBuildManifest } from '../../scripts/move-build-manifest';

const ROOT = resolve(__dirname, '../..');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };

describe('moveBuildManifest', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('moves dist/.vite/manifest.json to dist-meta/manifest.json and removes dist/.vite', () => {
    dir = mkdtempSync(resolve(tmpdir(), 'manifest-'));
    const dist = resolve(dir, 'dist');
    const meta = resolve(dir, 'dist-meta');
    mkdirSync(resolve(dist, '.vite'), { recursive: true });
    writeFileSync(resolve(dist, '.vite/manifest.json'), '{"a":1}');
    writeFileSync(resolve(dist, 'index.html'), '<html>');
    moveBuildManifest(dist, meta);
    expect(existsSync(resolve(dist, '.vite'))).toBe(false);
    expect(readFileSync(resolve(meta, 'manifest.json'), 'utf8')).toBe('{"a":1}');
    expect(existsSync(resolve(dist, 'index.html'))).toBe(true);
  });

  it('replaces a manifest left by an earlier build, and fails loudly when the build wrote none', () => {
    dir = mkdtempSync(resolve(tmpdir(), 'manifest-'));
    const dist = resolve(dir, 'dist');
    const meta = resolve(dir, 'dist-meta');
    mkdirSync(meta, { recursive: true });
    writeFileSync(resolve(meta, 'manifest.json'), 'old');
    mkdirSync(resolve(dist, '.vite'), { recursive: true });
    writeFileSync(resolve(dist, '.vite/manifest.json'), 'new');
    moveBuildManifest(dist, meta);
    expect(readFileSync(resolve(meta, 'manifest.json'), 'utf8')).toBe('new');
    expect(() => moveBuildManifest(dist, meta)).toThrow(/manifest/);
  });

  it('runs as the last step of npm run build, after check-prerender', () => {
    const steps = pkg.scripts.build.split('&&').map((s) => s.trim());
    expect(steps.at(-1)).toBe('tsx scripts/move-build-manifest.ts');
    expect(steps.at(-2)).toBe('tsx scripts/seo/check-prerender.ts');
  });

  it('dist-meta is git-ignored like dist', () => {
    expect(readFileSync(resolve(ROOT, '.gitignore'), 'utf8')).toMatch(/^dist-meta$/m);
  });
});

const built = existsSync(resolve(ROOT, 'dist/assets'));
describe.skipIf(!built)('after npm run build', () => {
  it('dist/.vite does not exist (nothing serves the manifest) and dist-meta/manifest.json does', () => {
    expect(existsSync(resolve(ROOT, 'dist/.vite'))).toBe(false);
    expect(existsSync(resolve(ROOT, 'dist-meta/manifest.json'))).toBe(true);
  });
});

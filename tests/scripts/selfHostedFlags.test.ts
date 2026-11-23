// Flags are served from /flags (23 Nov 2026): flagcdn.com, one request per
// flag on a cold third-party connection and lazy-loaded, left them late or
// missing on phones.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CSS_ONLY_FLAGS, FLAG_CODES, flagSrc } from '../../src/components/stage/Flag';

const root = join(__dirname, '../..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('self-hosted flags', () => {
  it('every known code has a w40 and a w80 PNG in public/flags', () => {
    for (const code of FLAG_CODES) {
      if (CSS_ONLY_FLAGS.has(code)) continue;
      for (const w of [40, 80] as const) {
        const src = flagSrc(code, w)!;
        expect(src.startsWith('/flags/')).toBe(true);
        const file = join(root, 'public', src);
        expect(existsSync(file), src).toBe(true);
        expect(readFileSync(file).subarray(1, 4).toString()).toBe('PNG');
      }
    }
  });

  it('no source file loads flags from flagcdn.com', () => {
    const hits = walk(join(root, 'src'))
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .filter((f) => /https:\/\/flagcdn\.com/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('the service worker precaches the flags', () => {
    expect(readFileSync(join(root, 'vite.config.ts'), 'utf8')).toMatch(/flags\/\*\.png/);
  });

  it('vercel answers a missing flag with a 404, not the SPA shell', () => {
    const cfg = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
    const spa = cfg.rewrites.find((r: { destination: string }) => r.destination === '/index.html' || r.destination === '/');
    expect(spa.source).toContain('flags/');
  });
});

describe('avatar thumbs', () => {
  it('are precached and not lazy', () => {
    expect(readFileSync(join(root, 'vite.config.ts'), 'utf8')).toMatch(/avatars\/\*-96\.webp/);
    const src = readFileSync(join(root, 'src/components/stage/avatars/AvatarVisual.tsx'), 'utf8');
    expect(src).toMatch(/loading=\{variant === 'full' \? 'lazy' : undefined\}/);
  });
});

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
// src/: "Lys Assia" is also in winnersCopy.ts, so it cannot be the marker).
const SNAPSHOT_MARKERS = ['Fud Leclerc', 'Messieurs les noyés de la Seine', 'Bobbejaan Schoepen'];

if (!built) {
  console.warn('bundleSize.test: dist/assets not found — run `npm run build` first; skipping.');
}

describe.skipIf(!built)('client bundle (dist/)', () => {
  const jsFiles = built
    ? readdirSync(ASSETS).filter((f) => f.endsWith('.js')).map((f) => ({ f, size: statSync(resolve(ASSETS, f)).size }))
    : [];

  it('no JS asset contains the content snapshot', () => {
    const main = [...jsFiles].sort((a, b) => b.size - a.size)[0];
    console.log(`bundleSize.test: main chunk ${main.f} = ${main.size} bytes`);
    for (const { f } of jsFiles) {
      const src = readFileSync(resolve(ASSETS, f), 'utf8');
      for (const marker of SNAPSHOT_MARKERS) expect(src.includes(marker), `${marker} in ${f}`).toBe(false);
    }
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

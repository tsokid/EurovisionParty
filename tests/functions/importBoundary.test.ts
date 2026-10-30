// @vitest-environment node
// Edge functions are bundled from supabase/functions/** only (CLI --use-api
// and the Dashboard editor see nothing else), so no function module may
// import from src/ or any other path outside that folder.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const FUNCTIONS = path.join(root, 'supabase/functions');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : walk(p);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [p] : [];
  });
}

/** Module specifiers of static imports/exports and dynamic import() calls. */
function specifiers(source: string): string[] {
  const out: string[] = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
  for (let m = re.exec(source); m; m = re.exec(source)) out.push(m[1]);
  return out;
}

describe('supabase/functions import boundary', () => {
  const files = walk(FUNCTIONS);

  it('finds the function sources', () => {
    expect(files.some((f) => f.includes(`publish-content${path.sep}snapshot.ts`))).toBe(true);
  });

  it('no module imports from src/', () => {
    const bad = files.flatMap((f) =>
      specifiers(readFileSync(f, 'utf8'))
        .filter((s) => s.includes('../src/') || s.includes('/src/'))
        .map((s) => `${path.relative(root, f)}: ${s}`),
    );
    expect(bad).toEqual([]);
  });

  it('every relative import resolves inside supabase/functions', () => {
    const bad = files.flatMap((f) =>
      specifiers(readFileSync(f, 'utf8'))
        .filter((s) => s.startsWith('.'))
        .filter((s) => !path.resolve(path.dirname(f), s).startsWith(FUNCTIONS + path.sep))
        .map((s) => `${path.relative(root, f)}: ${s}`),
    );
    expect(bad).toEqual([]);
  });
});

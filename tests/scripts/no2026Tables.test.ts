// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIRS = ['src', 'supabase/functions', 'scripts'];
const SKIP = new Set(['node_modules', '.git', 'dist']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|cjs|sql|json|md)$/.test(name)) out.push(p);
  }
  return out;
}

describe('no code references the old 2026 tables', () => {
  it('src, supabase/functions and scripts are clean', () => {
    const hits: string[] = [];
    for (const d of DIRS) {
      for (const f of walk(path.join(root, d))) {
        if (f === fileURLToPath(import.meta.url)) continue;
        readFileSync(f, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (line.includes('eurovision_2026_') || line.includes('eurovision_${'))
              hits.push(`${path.relative(root, f)}:${i + 1}`);
          });
      }
    }
    expect(hits).toEqual([]);
  });
});

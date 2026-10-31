// @vitest-environment node
// Edge functions that import _shared/cms resolve the bare 'zod' specifier
// through their deno.json import map; Node/Vite use node_modules. Both must
// be the same zod, or a schema could validate differently in the publish
// than in the admin and validate-content.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const FUNCTIONS = path.join(root, 'supabase/functions');

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};

/** Function folders (not _shared). */
const functionDirs = readdirSync(FUNCTIONS)
  .filter((n) => !n.startsWith('_') && statSync(path.join(FUNCTIONS, n)).isDirectory());

const importMap = (dir: string): Record<string, string> | null => {
  const p = path.join(FUNCTIONS, dir, 'deno.json');
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')).imports ?? {}) : null;
};

const sources = (dir: string): string[] =>
  readdirSync(path.join(FUNCTIONS, dir))
    .filter((n) => n.endsWith('.ts'))
    .map((n) => readFileSync(path.join(FUNCTIONS, dir, n), 'utf8'));

describe('zod pin', () => {
  it('package.json pins an exact zod version', () => {
    expect(pkg.dependencies.zod).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('every deno.json zod mapping equals the package.json version', () => {
    const maps = functionDirs.map((d) => [d, importMap(d)?.zod] as const).filter(([, z]) => z !== undefined);
    expect(maps.map(([d]) => d)).toContain('publish-content');
    for (const [dir, spec] of maps) expect(`${dir}: ${spec}`).toBe(`${dir}: npm:zod@${pkg.dependencies.zod}`);
  });

  it('every function importing _shared/cms maps zod', () => {
    const users = functionDirs.filter((d) => sources(d).some((s) => /from\s+['"]\.\.\/_shared\/cms\//.test(s)));
    expect(users).toContain('publish-content');
    for (const d of users) expect(`${d}: ${importMap(d)?.zod ?? 'missing'}`).toMatch(/: npm:zod@/);
  });
});

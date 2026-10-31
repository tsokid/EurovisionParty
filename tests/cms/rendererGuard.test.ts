// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const DIR = join(__dirname, '../../src/components/cms');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('src/components/cms', () => {
  const all = files(DIR);

  it('has renderer files to guard', () => {
    expect(all.length).toBeGreaterThan(0);
  });

  it('never uses dangerouslySetInnerHTML (CMS text reaches the DOM through React escaping only)', () => {
    for (const f of all) expect(readFileSync(f, 'utf8'), f).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
  });

  it('never imports zod or the field constructors (they would join the public bundle)', () => {
    for (const f of all) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/from ['"]zod['"]/);
      expect(src, f).not.toMatch(/_shared\/cms\/(fields|validate|walk|registry)/);
    }
  });

  it('keeps zod out of every _shared/cms module RichText.tsx imports, transitively', () => {
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/from ['"]zod['"]/);
      for (const m of src.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
        const target = resolve(dirname(file), m[1].replace(/\.ts$/, ''));
        for (const ext of ['.ts', '.tsx']) if (existsSync(target + ext)) visit(target + ext);
      }
    };
    visit(join(DIR, 'RichText.tsx'));
    const names = [...seen].filter((f) => f.replaceAll('\\', '/').includes('_shared/cms/')).map((f) => f.replaceAll('\\', '/').split('/').pop());
    expect(names.sort()).toEqual(['html.ts', 'richText.ts']);
  });
});

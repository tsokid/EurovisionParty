// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
});

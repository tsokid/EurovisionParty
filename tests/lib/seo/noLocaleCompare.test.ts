// @vitest-environment node
// Collation differs between Node, browsers and ICU builds, so a prerendered
// sort that uses it can disagree with the hydrated one. Use compareText.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : /\.(ts|tsx)$/.test(d.name) ? [join(dir, d.name)] : []);
}

describe('src/', () => {
  it('has no localeCompare', () => {
    const hits = files(resolve(__dirname, '../../../src')).filter((f) => readFileSync(f, 'utf8').includes('localeCompare'));
    expect(hits).toEqual([]);
  });
});

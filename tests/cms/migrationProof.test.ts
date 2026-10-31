// @vitest-environment node
// The 3a migration (copy modules → content/pages) was proven by two suites that
// pin the CURRENT copy: pagesUnchanged (rendered head/main vs fixtures) and the
// hash/literal pins in extractCopy. The first owner edit would redden them, so
// they only run with CMS_MIGRATION_PROOF=1 (still runnable on demand). This
// guard keeps every content pin behind that switch, so a copy edit cannot turn
// the default `npm test` red.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');
const GATE = 'describe.skipIf(!process.env.CMS_MIGRATION_PROOF)';

describe('3a migration proof suites are opt-in (CMS_MIGRATION_PROOF=1)', () => {
  it('pagesUnchanged: its only suite is gated', () => {
    const src = read('pagesUnchanged.test.ts');
    expect(src.match(/^describe/gm)).toEqual(['describe']);
    expect(src).toContain(`\n${GATE}(`);
  });

  it('extractCopy: every copy pin (hash or literal) sits in the gated block at the end', () => {
    const src = read('extractCopy.test.ts');
    const at = src.indexOf(`\n${GATE}(`);
    expect(at).toBeGreaterThan(0);
    const ungated = src.slice(0, at);
    const gated = src.slice(at);
    // Nothing after the gated block: it closes the file.
    expect(gated.match(/^describe/gm)).toEqual(['describe']);
    // The pins: sha256 of rendered copy, and expected copy compared by value.
    for (const pin of ['sha(', 'createHash(', 'FORMER', 'stableJson(']) expect(ungated).not.toContain(pin);
    // Ungated tests read a committed doc only to validate it, or on a line that
    // says why it pins nothing.
    const unexplained = ungated.split('\n').filter((line) =>
      line.includes('readDoc(')
      && !line.includes('validateDocument(docTypeFor(docId), readDoc(docId))')
      && !line.includes('// not a pin:'));
    expect(unexplained).toEqual([]);
    expect(gated).toContain('sha(');
  });

  it('is skipped by default: the switch is off unless set explicitly', () => {
    // `npm test` (and CI) never set it; this documents the contract.
    expect(['1', undefined]).toContain(process.env.CMS_MIGRATION_PROOF);
  });
});

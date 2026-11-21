/**
 * Compare two SEO snapshots. Exit 1 on removed routes or hard SEO-field changes;
 * internal-link and H2-count changes are warnings only.
 *
 *   npx tsx scripts/seo/snapshot-diff.ts before.json after.json
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Snapshot } from './snapshot';

const HARD = ['title', 'description', 'robots', 'canonical', 'h1', 'hreflang', 'jsonLd'] as const;
const SOFT = ['ogTitle', 'ogDescription'] as const;

export interface DiffResult {
  added: string[];
  removed: string[];
  errors: string[];
  warnings: string[];
  exitCode: 0 | 1;
}

const j = (v: unknown): string => JSON.stringify(v);
const minus = (a: string[], b: string[]): string[] => a.filter((x) => !b.includes(x));

export function diffSnapshots(before: Snapshot, after: Snapshot): DiffResult {
  const bk = Object.keys(before);
  const ak = Object.keys(after);
  const added = ak.filter((k) => !(k in before)).sort();
  const removed = bk.filter((k) => !(k in after)).sort();
  const errors: string[] = removed.map((r) => `removed route: ${r}`);
  const warnings: string[] = added.map((r) => `added route: ${r}`);

  for (const route of bk.filter((k) => k in after).sort()) {
    const b = before[route];
    const a = after[route];
    for (const f of HARD) {
      if (j(b[f]) === j(a[f])) continue;
      if (f === 'hreflang' || f === 'jsonLd') {
        const rem = minus(b[f], a[f]).map((x) => `\n      - ${x}`).join('');
        const add = minus(a[f], b[f]).map((x) => `\n      + ${x}`).join('');
        errors.push(`${route} ${f} changed:${rem}${add}`);
      } else {
        errors.push(`${route} ${f}: ${j(b[f])} -> ${j(a[f])}`);
      }
    }
    for (const f of SOFT) {
      if (j(b[f]) !== j(a[f])) warnings.push(`${route} ${f}: ${j(b[f])} -> ${j(a[f])}`);
    }
    if (b.h2Count !== a.h2Count) warnings.push(`${route} h2Count: ${b.h2Count} -> ${a.h2Count}`);
    const added2 = minus(a.internalLinks, b.internalLinks);
    const removed2 = minus(b.internalLinks, a.internalLinks);
    if (added2.length || removed2.length) {
      const parts = [];
      if (removed2.length) parts.push(`removed [${removed2.join(', ')}]`);
      if (added2.length) parts.push(`added [${added2.join(', ')}]`);
      warnings.push(`${route} internal links: ${parts.join(' ')}`);
    }
  }
  return { added, removed, errors, warnings, exitCode: errors.length ? 1 : 0 };
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [bp, ap] = process.argv.slice(2);
  if (!bp || !ap) {
    console.error('usage: snapshot-diff.ts <before.json> <after.json>');
    process.exit(2);
  }
  const r = diffSnapshots(JSON.parse(readFileSync(bp, 'utf8')), JSON.parse(readFileSync(ap, 'utf8')));
  console.log(`routes added: ${r.added.length}, removed: ${r.removed.length}`);
  if (r.errors.length) console.log(`\nERRORS (${r.errors.length}):\n  ${r.errors.join('\n  ')}`);
  if (r.warnings.length) console.log(`\nWARNINGS (${r.warnings.length}):\n  ${r.warnings.join('\n  ')}`);
  console.log(r.exitCode ? '\nFAIL: SEO regression detected' : '\nOK: no blocking SEO changes');
  process.exit(r.exitCode);
}

/**
 * Build gate: validates every content/pages/*.json against its CMS doc type
 * (supabase/functions/_shared/cms). Prints each error and exits 1 on failure.
 * A missing or empty content/pages/ passes with "0 documents".
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const PAGES_DIR = resolve(ROOT, 'content/pages');

export function validateContentDir(dir: string): { count: number; errors: string[] } {
  if (!existsSync(dir)) return { count: 0, errors: [] };
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const errors: string[] = [];
  for (const file of files) {
    const docId = file.slice(0, -'.json'.length);
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (e) {
      errors.push(`${file}: invalid JSON: ${(e as Error).message}`);
      continue;
    }
    const r = validateDocument(docTypeFor(docId), data);
    if (!r.ok) {
      for (const e of r.errors) errors.push(`${file}: [${e.locale ?? 'doc'}] ${e.path || '(root)'}: ${e.message}`);
    }
  }
  return { count: files.length, errors };
}

function main(): void {
  const { count, errors } = validateContentDir(PAGES_DIR);
  if (errors.length) {
    for (const e of errors) console.error(`validate-content: ${e}`);
    console.error(`validate-content: ${errors.length} error(s) in ${count} documents`);
    process.exit(1);
  }
  console.log(`validate-content: ${count} documents OK`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

/**
 * Data migration of the committed page docs to the P6 list layout (owner
 * decision Q4 = B): every content/pages/{doc}.json of a section-based page
 * that still holds `extraBlocks` gets them folded into `layout`, after the
 * page's sections in their default order (layoutUpgrade.ts), which renders
 * the same page. A doc without extraBlocks keeps no layout: no layout means
 * the default order, so its file (and the #__content__ the prerender inlines
 * from it) stays byte-identical.
 *
 *   npx tsx scripts/cms/migrate-layout.ts          write the changed files
 *   npx tsx scripts/cms/migrate-layout.ts --check  exit 1 if a file would change
 *
 * Idempotent. Drafts in the database are upgraded the same way when they are
 * loaded (admin) or published (publish-content).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { upgradeDocument } from '../../supabase/functions/_shared/cms/layoutUpgrade';

export function migrateLayouts(dir: string, write: boolean): string[] {
  const changed: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort()) {
    const path = resolve(dir, file);
    const text = readFileSync(path, 'utf8');
    const doc = JSON.parse(text) as unknown;
    const next = upgradeDocument(file.replace(/\.json$/, ''), doc);
    if (next === doc) continue;
    changed.push(file);
    if (write) writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  }
  return changed;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename ?? '');
if (isMain) {
  const check = process.argv.includes('--check');
  const changed = migrateLayouts(resolve(process.cwd(), 'content/pages'), !check);
  if (!changed.length) console.log('migrate-layout: every page doc is already on the list layout (nothing to change)');
  else console.log(`migrate-layout: ${check ? 'would change' : 'migrated'} ${changed.join(', ')}`);
  if (check && changed.length) process.exit(1);
}

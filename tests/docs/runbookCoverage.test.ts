// @vitest-environment node
// The cutover runbook must not silently drop an item. Every line of the SDD
// ledgers that contains "CUTOVER CHECKLIST" (or "cutover checklist") maps to
// key tokens that the runbook must mention; the Task 10 brief adds its own.
//
// The ledgers live in .superpowers/ (gitignored, local only). The token checks
// always run; the "every ledger line is mapped" check runs when the ledgers
// are present, so a new checklist line without a mapping fails locally.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const RUNBOOK = path.join(root, 'docs/superpowers/runbooks/2026-cutover.md');
const LEDGERS = [
  '.superpowers/sdd/2026-10-30-foundation-prerender/progress.md',
  '.superpowers/sdd/2026-10-30-contests-data-layer/progress.md',
  '.superpowers/sdd/2026-10-31-archive-pages-publish/progress.md',
].map((p) => path.join(root, p));

/** Ledger checklist line (identified by a distinctive substring) -> tokens the runbook must contain. */
const LEDGER_ITEMS: { line: string; tokens: string[] }[] = [
  {
    line: 'select iso, running_order from eurovision_2026_participants',
    tokens: ['select iso, running_order from eurovision_2026_participants', '25–26', 'null_running_order'],
  },
  { line: 'every parse_jobs row has source_url', tokens: ['source_url', 'parse_jobs', 'Vienna fallback'] },
  {
    line: 'confirm count(*) of eurovision_2026_participants',
    tokens: ['count(*)', 'eurovision_2026_participants', 'stray row', 'in_final'],
  },
  { line: 'do not edit 2026 entries between applying 070 and 072', tokens: ['do not edit 2026 entries', '072'] },
  { line: 'measure CLS with PageSpeed', tokens: ['CLS', 'PageSpeed'] },
];

/** Items from the Task 10 brief that have no ledger line. */
const BRIEF_TOKENS = [
  'version()',
  'cron.job',
  'parser-tick',
  'pg_dump',
  'in_final',
  'final_place',
  'has_function_privilege',
  'has_table_privilege',
  'anon',
  'authenticated',
  'service_role',
  '070_contests_core.sql',
  '071_rpcs_on_contest_entries.sql',
  '072_drop_2026_tables.sql',
  '073_history_import.sql',
  '074_publish_runs.sql',
  'eurovision-parse',
  'publish-content',
  'deploy-functions.mjs',
  'GITHUB_TOKEN',
  'GITHUB_REPO',
  'GITHUB_BRANCH',
  'Contents: Read and write',
  'feat/foundation-prerender',
  'historical-urls.txt',
  'Publish',
  'PredictionsResultsScreen',
  'current_participants',
  'Magic Link',
  'magic-link.html',
  'Email OTP Length = 6',
  'Email OTP Expiration = 600',
  'Confirm email',
  'AdminLogin.tsx',
  '60 minutes',
  'sitemap.xml',
  'URL Inspection',
  '3 weeks',
  'indexable',
  '047_results_auto_done.sql',
  'parser_cron_secret',
  'Burgas',
  'Archive',
  'Instant Rollback',
];

const runbook = readFileSync(RUNBOOK, 'utf8');
const ledgersPresent = LEDGERS.every((p) => existsSync(p));
if (!ledgersPresent) {
  console.warn('[runbookCoverage] SDD ledgers not found (.superpowers/ is local only); skipping the ledger-line mapping check.');
}

function checklistLines(): string[] {
  return LEDGERS.flatMap((p) => readFileSync(p, 'utf8').split(/\r?\n/)).filter((l) => /cutover checklist/i.test(l));
}

describe('cutover runbook coverage', () => {
  it.each(LEDGER_ITEMS)('ledger item "$line" is covered', ({ tokens }) => {
    for (const t of tokens) expect(runbook, `runbook is missing "${t}"`).toContain(t);
  });

  it.each(BRIEF_TOKENS)('brief item "%s" is covered', (t) => {
    expect(runbook).toContain(t);
  });

  it('runbook has a checklist table and numbered steps in order', () => {
    expect(runbook).toMatch(/^## Checklist/m);
    const order = ['## 0.', '## 1.', '## 2.', '## 3.', '## 4.', '## 5.', '## 6.', '## 7.', '## 8.', '## 9.', '## 10.', '## 11.', '## 12.'];
    const at = order.map((h) => runbook.indexOf(h));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('072 comes after the merge and the first Publish', () => {
    expect(runbook.indexOf('## 10. Apply 072')).toBeGreaterThan(runbook.indexOf('### 8.3 First Publish'));
    expect(runbook.indexOf('### 8.3 First Publish')).toBeGreaterThan(runbook.indexOf('### 7.1 Merge'));
  });

  it('contains no real secrets', () => {
    expect(runbook).not.toMatch(/github_pat_[A-Za-z0-9_]{20,}/);
    expect(runbook).not.toMatch(/\bsbp_[a-f0-9]{20,}/);
    expect(runbook).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
    expect(runbook).not.toMatch(/postgres(ql)?:\/\/[^<'"\s]*:[^<'"\s@]+@/);
  });

  it.skipIf(!ledgersPresent)('every CUTOVER CHECKLIST ledger line has a mapping', () => {
    const lines = checklistLines();
    expect(lines.length).toBeGreaterThan(0);
    const unmapped = lines.filter((l) => !LEDGER_ITEMS.some((i) => l.includes(i.line)));
    expect(unmapped).toEqual([]);
  });
});

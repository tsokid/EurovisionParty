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
  // Fix round 1: rollback after Publish, backups keep grants, pinned CLI, shell hygiene.
  'Promote to Production',
  '<OLD_MAIN_SHA>',
  'git checkout <OLD_MAIN_SHA> -- .',
  '--no-owner',
  'read -r -s -p',
  'PostgreSQL/17/bin',
  'URL-encode',
  'supabase@2.122.0',
  'config.toml',
  'deptype',
  'importBoundary.test.ts',
  '_shared/contestTypes.ts',
  // Final fix wave (2b final review).
  '075_backfill_2026_semis.sql',
  'semi_set',
  '**30**',
  'Excluded by noindex',
  '144',
  'git switch -C rollback-main origin/main',
  'supabase/.gitignore',
  ':[YOUR-PASSWORD]',
  'overrides `PGPASSWORD`',
  'REVOKE',
  'build-local.ts',
  '1970-01-01T00:00:00Z',
  'Redeploy',
  'commit author',
  'npm run build',
  'bundleSize.test.ts',
  'historicalUrls.test.ts',
  'eurovision-2026-vienna | grep -c',
  // CMS 3b (Task 8): 076 with 074, zod through deno.json, the CMS smoke test.
  '076_cms_documents.sql',
  'cms_documents',
  'public.cms_save(text,text,jsonb,timestamptz)',
  'deno.json',
  'npm:zod@4.3.6',
  'BOOT_ERROR',
  'Save draft',
  'Discard draft',
  '(CMS check)',
  // CMS 3c (Task 7): 077 after 076, the private cms-media bucket and its policies, the media smoke test.
  '077_cms_media.sql',
  'cms-media',
  'storage.buckets',
  'pg_policies',
  'cms_media_admin_select',
  'cms_media_admin_insert',
  'cms_media_admin_update',
  'cms_media_admin_delete',
  'must be owner of table objects',
  'public.media_register(uuid,text,text,text,int,int,int,text,uuid)',
  'Add editorial for',
  'eurovision-2005-kyiv',
  'public, max-age=31536000, immutable',
  '-800.webp',
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

  it('game reads come before the first Publish, and 072 after both', () => {
    const merge = runbook.indexOf('### 7.1 Merge');
    const game = runbook.indexOf('### 8.3 Game reads');
    const publish = runbook.indexOf('## 9. First Publish');
    const drop = runbook.indexOf('## 10. Apply 072');
    expect(Math.min(merge, game, publish, drop)).toBeGreaterThanOrEqual(0);
    expect(merge).toBeLessThan(game);
    expect(game).toBeLessThan(publish);
    expect(publish).toBeLessThan(drop);
  });

  it('075 runs after the game reads and before the first Publish; the freeze rule names the right steps', () => {
    const game = runbook.indexOf('### 8.3 Game reads');
    const apply075 = runbook.indexOf('### 8.4 Apply 075');
    const publish = runbook.indexOf('## 9. First Publish');
    expect(game).toBeGreaterThanOrEqual(0);
    expect(apply075).toBeGreaterThan(game);
    expect(publish).toBeGreaterThan(apply075);
    const freeze = runbook.split(/\r?\n/).find((l) => l.includes('Freeze rule'))!;
    expect(freeze).toContain('first Publish in step 9');
    expect(freeze).not.toContain('step 8,');
    expect(runbook).not.toContain('until rollback or 072');
    expect(runbook).not.toMatch(/\b5 finalists\b/);
    expect(runbook).not.toContain('git switch -c rollback-main');
  });

  it('076 is applied in the same step as 074 (5.2), before the edge functions; every order line says so', () => {
    const step5 = runbook.indexOf('## 5.');
    const s52 = runbook.indexOf('### 5.2 Apply 074 and 076 together');
    const step6 = runbook.indexOf('## 6.');
    expect(step5).toBeGreaterThanOrEqual(0);
    expect(s52).toBeGreaterThan(step5);
    expect(step6).toBeGreaterThan(s52);
    const section = runbook.slice(s52, step6);
    expect(section).toContain('074_publish_runs.sql');
    expect(section).toContain('076_cms_documents.sql');
    for (const fn of ['public.cms_list()', 'public.cms_get(text)', 'public.cms_save(text,text,jsonb,timestamptz)', 'public.cms_discard(text)', 'public.publish_input()']) {
      expect(section, `5.2 privilege list is missing ${fn}`).toContain(fn);
    }
    const lines = runbook.split(/\r?\n/);
    expect(lines.find((l) => l.startsWith('Order:'))).toContain('074 + 076 (same step)');
    expect(lines.find((l) => l.includes('**Apply at cutover**'))).toContain('074 + 076');
    expect(lines.find((l) => l.startsWith('| 5 |'))).toContain('**076**');
  });

  it('077 is applied right after 076 (5.3), still before the edge functions, and its checks cover the private bucket and four policies', () => {
    const s52 = runbook.indexOf('### 5.2 Apply 074 and 076 together');
    const s53 = runbook.indexOf('### 5.3 Apply 077');
    const step6 = runbook.indexOf('## 6.');
    expect(s52).toBeGreaterThanOrEqual(0);
    expect(s53).toBeGreaterThan(s52);
    expect(step6).toBeGreaterThan(s53);
    // 077 comes after 076 in 5.2 and in every order line.
    expect(runbook.indexOf('076_cms_documents.sql')).toBeLessThan(runbook.indexOf('077_cms_media.sql'));
    const lines = runbook.split(/\r?\n/);
    const order = lines.find((l) => l.startsWith('Order:'))!;
    expect(order.indexOf('076')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('077')).toBeGreaterThan(order.indexOf('076'));
    expect(order.indexOf('077')).toBeLessThan(order.indexOf('edge functions'));
    expect(lines.find((l) => l.includes('**Apply at cutover**'))).toContain('077');
    expect(lines.find((l) => l.startsWith('| 5 |'))).toContain('**077**');
    const section = runbook.slice(s53, step6);
    for (const t of [
      "select id, public, file_size_limit from storage.buckets where id = 'cms-media'",
      'from pg_policies',
      "schemaname = 'storage' and tablename = 'objects' and policyname ilike '%cms%'",
      '`public` must be `false`',
      'cms_media_admin_select | SELECT', 'cms_media_admin_insert | INSERT',
      'cms_media_admin_update | UPDATE', 'cms_media_admin_delete | DELETE',
      'rolled back', 'SQL Editor', 'public.media_mark_published(uuid,text)',
    ]) expect(section, `5.3 is missing "${t}"`).toContain(t);
  });

  it('every policy name the runbook expects exists in migration 077', () => {
    const sql = readFileSync(path.join(root, 'supabase/migrations/077_cms_media.sql'), 'utf8');
    for (const n of ['select', 'insert', 'update', 'delete']) expect(sql).toContain(`create policy cms_media_admin_${n} on storage.objects`);
    expect(sql).toContain("values ('cms-media', 'cms-media', false)");
  });

  it('a media smoke test follows the CMS smoke test, before 072, with a revert', () => {
    const s92 = runbook.indexOf('### 9.2 CMS smoke test');
    const s93 = runbook.indexOf('### 9.3 Media smoke test');
    const step10 = runbook.indexOf('## 10. Apply 072');
    expect(s93).toBeGreaterThan(s92);
    expect(step10).toBeGreaterThan(s93);
    const section = runbook.slice(s93, step10);
    for (const t of [
      'Add editorial for', '2005', 'alt text', 'EN and EL', 'Publish',
      '/el/past-contests/eurovision-2005-kyiv', '/media/<sha12>.webp', '/media/<sha12>-800.webp',
      '`width` and `height`', 'Cache-Control: public, max-age=31536000, immutable',
      'Revert', 'revert the Publish commit on GitHub', 'edit the editorial back to empty',
    ]) expect(section, `9.3 is missing "${t}"`).toContain(t);
    expect(runbook.split(/\r?\n/).find((l) => l.startsWith('| 9 |'))).toContain('media smoke test');
  });

  it('the deploy rehearsal checks that publish-content resolves zod through its deno.json', () => {
    const s62 = runbook.indexOf('### 6.2 Deploy both functions');
    const s63 = runbook.indexOf('### 6.3');
    expect(s62).toBeGreaterThanOrEqual(0);
    const section = runbook.slice(s62, s63);
    expect(section).toContain('supabase/functions/publish-content/deno.json');
    expect(section).toContain('npm:zod@4.3.6');
    expect(section).toContain('rehearsal');
    expect(section).toContain('--import-map');
  });

  it('a CMS smoke test follows the first Publish, with a revert that works after Publish', () => {
    const s91 = runbook.indexOf('### 9.1 Publish');
    const s92 = runbook.indexOf('### 9.2 CMS smoke test');
    const step10 = runbook.indexOf('## 10. Apply 072');
    expect(s91).toBeGreaterThanOrEqual(0);
    expect(s92).toBeGreaterThan(s91);
    expect(step10).toBeGreaterThan(s92);
    const section = runbook.slice(s92, step10);
    for (const t of ['Pages', 'FAQ', 'Save draft', 'Publish', '/en/faq', 'Discard draft', 'original answer']) {
      expect(section, `9.2 is missing "${t}"`).toContain(t);
    }
  });

  it('I3: 9.2 says the site takes ~2 min after a page Publish, the draft stays as the editor base, and auto-publish ships contests only', () => {
    const section = runbook.slice(runbook.indexOf('### 9.2 CMS smoke test'), runbook.indexOf('## 10. Apply 072'));
    for (const t of ['about 2 minutes', "editor's base", 'contests only']) {
      expect(section, `9.2 is missing "${t}"`).toContain(t);
    }
  });

  it('I3: the 5.2 privilege check names begin_publish with its p_cms argument', () => {
    expect(runbook).toContain("('public.begin_publish(boolean)',");
    expect(runbook).not.toContain("('public.begin_publish()',");
  });

  it('the backup note lists 076 among the migrations that lock objects down (restore must keep their REVOKEs)', () => {
    const note = runbook.split(/\r?\n/).find((l) => l.includes('lock tables and functions down'));
    expect(note).toBeDefined();
    for (const m of ['069', '070', '071', '074', '076']) expect(note, m).toContain(m);
  });

  it('backup and restore commands keep privileges (no --no-privileges in any code block)', () => {
    const code = [...runbook.matchAll(/```[a-z]*\r?\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
    expect(code).toContain('pg_dump');
    expect(code).not.toContain('--no-privileges');
  });

  it('pins the Supabase CLI version', () => {
    expect(runbook).not.toMatch(/supabase@latest/);
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

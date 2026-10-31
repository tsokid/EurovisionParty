// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text, group, list } from '../../supabase/functions/_shared/cms/fields';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import { liveContestFacts, validateContentDir } from '../../scripts/cms/validate-content';

describe('validateContentDir', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cms-validate-'));
    CMS_DOC_TYPES['__vc-ok'] = { schema: group({ title: text() }), label: 'T', group: 'site' };
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    delete CMS_DOC_TYPES['__vc-ok'];
  });

  it('passes with 0 documents when the folder is missing', () => {
    expect(validateContentDir(join(dir, 'nope'))).toEqual({ count: 0, errors: [], warnings: [] });
  });

  it('passes with 0 documents when the folder is empty', () => {
    const empty = join(dir, 'empty');
    mkdirSync(empty);
    expect(validateContentDir(empty)).toEqual({ count: 0, errors: [], warnings: [] });
  });

  it('validates each file against its doc type and reports failures by file', () => {
    const pages = join(dir, 'pages');
    mkdirSync(pages);
    writeFileSync(join(pages, '__vc-ok.json'), JSON.stringify({ en: { title: 'A' }, el: { title: 'Α' } }));
    const r1 = validateContentDir(pages);
    expect(r1).toEqual({ count: 1, errors: [], warnings: [] });

    writeFileSync(join(pages, '__vc-ok.json'), JSON.stringify({ en: { title: 'A' }, el: { title: '' } }));
    writeFileSync(join(pages, 'orphan.json'), '{}');
    writeFileSync(join(pages, 'broken.json'), '{not json');
    const r2 = validateContentDir(pages);
    expect(r2.count).toBe(3);
    const lines = r2.errors.join('\n');
    expect(lines).toMatch(/__vc-ok\.json.*el.*title/);
    expect(lines).toMatch(/orphan\.json.*unknown doc type/i);
    // Document-level errors carry no locale: printed as [doc], never [en].
    expect(r2.errors).toContain('orphan.json: [doc] (root): Unknown doc type "orphan"');
    expect(lines).toMatch(/__vc-ok\.json: \[el\] title: /);
    expect(lines).toMatch(/broken\.json.*JSON/);
  });
});

describe('hardcoded live-contest year/city (warning, never an error)', () => {
  let dir: string;
  const FACTS = { year: 2031, cities: ['Turin', 'Τορίνο'] };
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cms-facts-'));
    CMS_DOC_TYPES['__vc-facts'] = {
      schema: group({ title: text(), steps: list(group({ body: text() })), note: text({ placeholders: ['year'] }) }),
      label: 'T',
      group: 'site',
    };
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    delete CMS_DOC_TYPES['__vc-facts'];
  });

  it('warns at doc:locale:path for each string naming the live year or city', () => {
    writeFileSync(join(dir, '__vc-facts.json'), JSON.stringify({
      en: { title: 'Eurovision 2031', steps: [{ body: 'Plan ahead' }, { body: 'Off to Turin' }], note: 'In {year}' },
      el: { title: 'Eurovision', steps: [{ body: 'Σχέδιο' }, { body: 'Στο Τορίνο το 20310' }], note: 'Το {year}' },
    }));
    const r = validateContentDir(dir, FACTS);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([
      'possible hardcoded year/city at __vc-facts:en:title',
      'possible hardcoded year/city at __vc-facts:en:steps.1.body',
      'possible hardcoded year/city at __vc-facts:el:steps.1.body',
    ]);
  });

  it('does not warn for other years, placeholders, or a year inside a longer number', () => {
    writeFileSync(join(dir, '__vc-facts.json'), JSON.stringify({
      en: { title: 'Since 1956, 2030 and 20311', steps: [], note: '{year} again' },
      el: { title: 'Από το 1956', steps: [], note: '{year}' },
    }));
    expect(validateContentDir(dir, FACTS).warnings).toEqual([]);
  });

  it('defaults to the live contest in content/site.json, not a pinned year', () => {
    const site = JSON.parse(readFileSync(join(__dirname, '../../content/site.json'), 'utf8')) as {
      current: { year: number; city: string };
    };
    const facts = liveContestFacts();
    expect(facts.year).toBe(site.current.year);
    expect(facts.cities).toContain(site.current.city);
    expect(facts.cities.length).toBe(2); // en and el names
  });
});

describe('npm run build', () => {
  // Invalid content must fail the build before any bundling or prerendering.
  it('runs validate-content right after typecheck:shared, before vite build', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { scripts: Record<string, string> };
    const steps = pkg.scripts.build.split('&&').map((s) => s.trim());
    const at = (step: string) => steps.findIndex((s) => s === step);
    const typecheck = at('npm run typecheck:shared');
    const validate = at('tsx scripts/cms/validate-content.ts');
    expect(typecheck).toBeGreaterThanOrEqual(0);
    expect(validate).toBe(typecheck + 1);
    expect(validate).toBeLessThan(steps.findIndex((s) => s.startsWith('vite build')));
    expect(steps.filter((s) => s.includes('validate-content'))).toHaveLength(1);
  });
});

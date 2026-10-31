// @vitest-environment node
// A CMS field rendered through dangerouslySetInnerHTML must carry
// `rawHtml: true`, so the 3b editor knows it holds markup (and can sanitise it).
// Static check: the raw-HTML fields of each page are listed here by hand, one
// per dangerouslySetInnerHTML in its component, and must match the schema.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fieldAt, fieldMeta, fieldPaths } from '../../supabase/functions/_shared/cms/fields';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';

const ROOT = resolve(__dirname, '../..');
const PAGES = resolve(ROOT, 'src/pages/seo');

/** docId → its page component and the fields that component renders raw. */
const RAW_HTML: Record<string, { component: string; fields: string[] }> = {
  faq: { component: 'FAQPage.tsx', fields: ['joinSection.bullets.*.rest', 'leaveSection.bullets.*.rest'] },
  rules: { component: 'RulesPage.tsx', fields: ['duels.items.*.rest'] },
  scoring: {
    component: 'ScoringPage.tsx',
    fields: [
      'quiz.note',
      'top5.note',
      'worst5.note',
      'duel.body',
      'stealDouble.stealBody',
      'stealDouble.doubleBody',
      'stealDouble.note',
      'penalties.items.*.rest',
      'example.items.*.rest',
    ],
  },
};

const rawUses = (file: string) => readFileSync(resolve(PAGES, file), 'utf8').split('dangerouslySetInnerHTML').length - 1;

describe('raw-HTML fields carry rawHtml', () => {
  it.each(Object.entries(RAW_HTML))('%s: every listed field is rawHtml', (docId, { fields }) => {
    const schema = CMS_DOC_TYPES[docId].schema;
    for (const path of fields) {
      const node = fieldAt(schema, path);
      expect(node, `${docId}.${path} exists`).toBeDefined();
      expect(fieldMeta(node!).rawHtml, `${docId}.${path}`).toBe(true);
    }
  });

  it.each(Object.entries(RAW_HTML))('%s: one listed field per dangerouslySetInnerHTML in the component', (_docId, { component, fields }) => {
    expect(rawUses(component)).toBe(fields.length);
  });

  it('no other field of any doc type is marked rawHtml', () => {
    for (const [docId, def] of Object.entries(CMS_DOC_TYPES)) {
      if (docId.startsWith('__')) continue; // fixture types registered by other tests
      expect(fieldPaths(def.schema, (m) => !!m.rawHtml), docId).toEqual(RAW_HTML[docId]?.fields ?? []);
    }
  });

  it('every page component that reads a CMS doc and renders raw HTML is listed', () => {
    const listed = new Set(Object.values(RAW_HTML).map((r) => r.component));
    for (const file of readdirSync(PAGES).filter((f) => f.endsWith('.tsx'))) {
      const src = readFileSync(resolve(PAGES, file), 'utf8');
      if (src.includes('usePageContent') && rawUses(file) > 0) expect(listed, file).toContain(file);
    }
  });
});

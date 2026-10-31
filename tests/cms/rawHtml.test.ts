// @vitest-environment node
// A CMS field rendered through dangerouslySetInnerHTML must carry
// `rawHtml: true`, so the 3b editor knows it holds markup (and can sanitise it).
// Static check: every `__html:` binding in the page and SEO component sources
// is listed here by hand, in source order, with the CMS field it renders, and
// the list must match both the source and the schemas.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fieldAt, fieldMeta, fieldPaths } from '../../supabase/functions/_shared/cms/fields';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';

const SRC = resolve(__dirname, '../../src');

/** A raw-HTML render: the CMS field and the expression bound to `__html`. */
type Raw = { field: string; binding: string };

/**
 * docId → its component (relative to src/) and every `__html:` binding in it,
 * in source order. A binding `c.<path>` renders the field at <path>; a binding
 * `<v>.<key>` renders `<key>` of the list items mapped as `c.<list>.map((<v>`.
 */
const RAW_HTML: Record<string, { component: string; raw: Raw[] }> = {
  faq: {
    component: 'pages/seo/FAQPage.tsx',
    raw: [
      { field: 'joinSection.bullets.*.rest', binding: 'b.rest' },
      { field: 'leaveSection.bullets.*.rest', binding: 'b.rest' },
    ],
  },
  rules: { component: 'pages/seo/RulesPage.tsx', raw: [{ field: 'duels.items.*.rest', binding: 'it.rest' }] },
  'how-to-play': {
    component: 'pages/seo/HowToPlayPage.tsx',
    raw: [
      { field: 'setup.items.*.rest', binding: 'it.rest' },
      { field: 'duels.cardBody', binding: 'c.duels.cardBody' },
    ],
  },
  scoring: {
    component: 'pages/seo/ScoringPage.tsx',
    raw: [
      { field: 'quiz.note', binding: 'c.quiz.note' },
      { field: 'top5.note', binding: 'c.top5.note' },
      { field: 'worst5.note', binding: 'c.worst5.note' },
      { field: 'duel.body', binding: 'c.duel.body' },
      { field: 'stealDouble.stealBody', binding: 'c.stealDouble.stealBody' },
      { field: 'stealDouble.doubleBody', binding: 'c.stealDouble.doubleBody' },
      { field: 'stealDouble.note', binding: 'c.stealDouble.note' },
      { field: 'penalties.items.*.rest', binding: 'it.rest' },
      { field: 'example.items.*.rest', binding: 'it.rest' },
    ],
  },
};

/** Files that render raw HTML but never CMS document content, with the reason. */
const NOT_CMS: Record<string, string> = {
  'components/seo/ContentRenderer.tsx': 'renders the legacy src/content PageContent type, not a CMS document',
};

/**
 * Directories scanned for raw-HTML renders (non-recursive; .tsx only).
 * src/pages/content held homeCopy/notFoundCopy and is gone since Task 6.
 */
const SCANNED = ['pages', 'pages/seo', 'components/seo'];

const read = (file: string) => readFileSync(resolve(SRC, file), 'utf8');

/** Every `__html:` binding in `src`, in source order, with its offset. */
function bindings(src: string): { expr: string; at: number }[] {
  return [...src.matchAll(/__html:\s*([^}]+?)\s*\}/g)].map((m) => ({ expr: m[1], at: m.index! }));
}

const scannedFiles = SCANNED.flatMap((dir) =>
  readdirSync(resolve(SRC, dir), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tsx'))
    .map((e) => `${dir}/${e.name}`),
);

describe('raw-HTML fields carry rawHtml', () => {
  it.each(Object.entries(RAW_HTML))('%s: every listed field is rawHtml', (docId, { raw }) => {
    const schema = CMS_DOC_TYPES[docId].schema;
    for (const { field } of raw) {
      const node = fieldAt(schema, field);
      expect(node, `${docId}.${field} exists`).toBeDefined();
      expect(fieldMeta(node!).rawHtml, `${docId}.${field}`).toBe(true);
    }
  });

  it.each(Object.entries(RAW_HTML))('%s: the component binds exactly the listed fields, in order', (_docId, { component, raw }) => {
    const src = read(component);
    const found = bindings(src);
    expect(src.split('dangerouslySetInnerHTML').length - 1, 'one __html binding per dangerouslySetInnerHTML').toBe(found.length);
    expect(found.map((b) => b.expr)).toEqual(raw.map((r) => r.binding));
    raw.forEach(({ field, binding }, i) => {
      if (binding.startsWith('c.')) {
        expect(binding.slice(2), `${component}: ${binding}`).toBe(field);
        return;
      }
      // An item binding: the nearest `.map((v` before it must map the field's list.
      const [v, key] = binding.split('.');
      const star = field.lastIndexOf('.*.');
      expect(star, `${field} is a list item field`).toBeGreaterThan(0);
      expect(field.slice(star + 3), `${component}: ${binding}`).toBe(key);
      const before = src.slice(0, found[i].at);
      const mapAt = before.lastIndexOf(`.map((${v}`);
      expect(mapAt, `${component}: .map((${v} before ${binding}`).toBeGreaterThan(0);
      expect(before.slice(0, mapAt).endsWith(`c.${field.slice(0, star)}`), `${component}: ${binding} maps c.${field.slice(0, star)}`).toBe(true);
    });
  });

  it('no other field of any doc type is marked rawHtml', () => {
    for (const [docId, def] of Object.entries(CMS_DOC_TYPES)) {
      if (docId.startsWith('__')) continue; // fixture types registered by other tests
      expect(fieldPaths(def.schema, (m) => !!m.rawHtml), docId).toEqual(RAW_HTML[docId]?.raw.map((r) => r.field) ?? []);
    }
  });

  it('scans the page and SEO component directories', () => {
    expect(scannedFiles).toEqual(expect.arrayContaining([
      'pages/HomePage.tsx', 'pages/NotFoundPage.tsx', 'pages/seo/FAQPage.tsx', 'components/seo/HomeSeoBlock.tsx',
    ]));
  });

  it('every scanned file that renders raw HTML is listed (as a CMS page or as not CMS)', () => {
    const listed = new Set([...Object.values(RAW_HTML).map((r) => r.component), ...Object.keys(NOT_CMS)]);
    for (const file of scannedFiles) {
      const src = read(file);
      if (src.includes('dangerouslySetInnerHTML') || src.includes('__html')) expect(listed, file).toContain(file);
    }
  });

  it('the not-CMS files really read no CMS document', () => {
    for (const file of Object.keys(NOT_CMS)) {
      const src = read(file);
      expect(src.includes('dangerouslySetInnerHTML'), `${file} still renders raw HTML`).toBe(true);
      expect(/usePageContent|_shared\/cms/.test(src), file).toBe(false);
    }
  });
});

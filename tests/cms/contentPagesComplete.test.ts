// @vitest-environment node
// content/pages and the doc-type registry must agree: every static page (and
// the 404) has a valid document, and every document belongs to a doc type.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';

const DIR = resolve(__dirname, '../../content/pages');
// index.json is the editorial index (pagesIndex.ts), not a document.
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
const docIds = files.map((f) => f.slice(0, -'.json'.length));
const staticIds = [...PAGE_REGISTRY.map((p) => p.id), 'not-found'];

describe('content/pages completeness', () => {
  it.each(staticIds)('%s has a document that validates', (id) => {
    expect(docIds, `content/pages/${id}.json`).toContain(id);
    expect(Object.keys(CMS_DOC_TYPES), `doc type ${id}`).toContain(docTypeFor(id));
    const r = validateDocument(docTypeFor(id), JSON.parse(readFileSync(resolve(DIR, `${id}.json`), 'utf8')));
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('every document maps to a registered doc type (no orphans)', () => {
    expect(docIds.filter((id) => !(docTypeFor(id) in CMS_DOC_TYPES))).toEqual([]);
  });

  it('every static document is a registry page or the 404 (no strays)', () => {
    expect(docIds.filter((id) => !staticIds.includes(id))).toEqual([]);
  });

  it('every registered static doc type has a document', () => {
    expect(Object.entries(CMS_DOC_TYPES).filter(([t, d]) => !t.startsWith('__') && d.group === 'site' && !docIds.includes(t))).toEqual([]);
  });
});

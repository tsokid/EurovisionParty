// @vitest-environment node
// publish-content: CMS drafts (cms_documents) become content/pages/{doc_id}.json
// in the same commit as the contest snapshot, or the whole publish is refused.
import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cmsFiles, CmsValidationError, MAX_LINE, MAX_MESSAGE_BYTES, pagesFromFiles } from '../../supabase/functions/publish-content/cmsFiles';
import { publishOptions, runPublish, type PublishDeps } from '../../supabase/functions/publish-content/run';
import type { FileTransforms } from '../../supabase/functions/publish-content/github';
import { buildSnapshotFiles, type CmsDocumentRow, type SnapshotInput } from '../../supabase/functions/publish-content/snapshot';
import { stableJson as scriptStableJson } from '../../scripts/history/import';
import { stableJson } from '../../supabase/functions/_shared/stableJson';
import type { ContestRow } from '../../src/content/contests/types';

const root = process.cwd();
// LF as in the repo blob, whatever core.autocrlf did to the working copy.
const read = (p: string) => readFileSync(resolve(root, p), 'utf8').replace(/\r\n/g, '\n');
const pageText = (docId: string) => read(`content/pages/${docId}.json`);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = { en: any; el: any };
const pageDoc = (docId: string) => JSON.parse(pageText(docId)) as Doc;
const row = (doc_id: string, data: unknown = pageDoc(doc_id), doc_type = doc_id): CmsDocumentRow =>
  ({ doc_id, doc_type, data: data as CmsDocumentRow['data'] });

/** A fresh copy of doc_id's committed document with `edit` applied. */
function edited(docId: string, edit: (d: Doc) => void): Doc {
  const d = pageDoc(docId);
  edit(d);
  return d;
}

/** Reverses object key order at every level: the serializer must not care. */
function shuffled(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shuffled);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).reverse().map((k) => [k, shuffled((v as Record<string, unknown>)[k])]));
  }
  return v;
}

function thrown(f: () => unknown): CmsValidationError {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(CmsValidationError);
    return e as CmsValidationError;
  }
  throw new Error('expected cmsFiles to throw');
}

describe('cmsFiles', () => {
  it('writes each valid draft to content/pages/{doc_id}.json in the 3a file format', () => {
    const { files, warnings } = cmsFiles([row('not-found', shuffled(pageDoc('not-found'))), row('faq')]);
    expect(Object.keys(files).sort()).toEqual(['content/pages/faq.json', 'content/pages/not-found.json']);
    // Byte-identical to the committed files: sorted keys, 2-space indent, trailing newline.
    expect(files['content/pages/not-found.json']).toBe(pageText('not-found'));
    expect(files['content/pages/faq.json']).toBe(pageText('faq'));
    expect(warnings.filter((w) => w.doc_id === 'not-found')).toEqual([]);
  });

  it('the serializer itself, against golden bytes: sorted keys at every depth, 2-space indent, raw Greek, trailing newline', () => {
    const value = { z: 'Ελλάδα', a: { y: [2, { d: null, c: true }], b: 'ö' }, m: [] };
    const golden = [
      '{',
      '  "a": {',
      '    "b": "ö",',
      '    "y": [',
      '      2,',
      '      {',
      '        "c": true,',
      '        "d": null',
      '      }',
      '    ]',
      '  },',
      '  "m": [],',
      '  "z": "Ελλάδα"',
      '}',
      '',
    ].join('\n');
    expect(stableJson(value)).toBe(golden);
    // The script copy is the same function (scripts/history/import.ts re-exports it).
    expect(scriptStableJson).toBe(stableJson);
  });

  it('every committed page, published unchanged as a draft, round-trips byte for byte', () => {
    const ids = readdirSync(resolve(root, 'content/pages')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
    expect(ids.length).toBeGreaterThan(10);
    const { files } = cmsFiles(ids.map((id) => row(id)));
    for (const id of ids) expect(files[`content/pages/${id}.json`]).toBe(pageText(id));
  });

  it('no drafts: no files (docs without drafts are never touched)', () => {
    expect(cmsFiles([])).toEqual({ files: {}, warnings: [] });
    expect(cmsFiles(undefined)).toEqual({ files: {}, warnings: [] });
  });

  it('a changed draft is written with its edit', () => {
    const data = edited('not-found', (d) => { d.en.hero.title = 'Lost in the arena'; });
    const { files } = cmsFiles([row('not-found', data)]);
    expect(JSON.parse(files['content/pages/not-found.json']).en.hero.title).toBe('Lost in the arena');
  });

  it('warnings do not block and carry their doc_id', () => {
    const data = edited('not-found', (d) => { d.en.meta.title = 'x'.repeat(75); });
    const { files, warnings } = cmsFiles([row('not-found', data)]);
    expect(files['content/pages/not-found.json']).toBeDefined();
    expect(warnings).toEqual([
      { doc_id: 'not-found', locale: 'en', path: 'meta.title', message: expect.stringMatching(/Longer than recommended/) },
    ]);
  });

  it('any error refuses every document, listing doc_id [locale] path: message', () => {
    const bad = edited('not-found', (d) => { delete d.el.hero.title; d.en.hero.extra = 'x'; });
    const e = thrown(() => cmsFiles([row('faq'), row('not-found', bad)]));
    expect(e.errors.map((x) => `${x.doc_id} ${x.locale} ${x.path}`).sort()).toEqual([
      'not-found el hero.title',
      'not-found en hero',
    ]);
    expect(e.message.split('\n')[0]).toBe('CMS validation failed: 2 errors in 1 document');
    expect(e.message).toMatch(/^not-found \[en\] hero: .+$/m);
    expect(e.message).toMatch(/^not-found \[el\] hero\.title: .+$/m);
  });

  it('a doc_id not registered in CMS_DOC_TYPES is an error', () => {
    expect(thrown(() => cmsFiles([row('archive-2025', { en: {}, el: {} }, 'archive')])).message).toMatch(
      /^archive-2025 \[doc\] \(root\): Unknown doc type "archive"$/m,
    );
    expect(thrown(() => cmsFiles([row('nope', { en: {}, el: {} })])).message).toMatch(
      /^nope \[doc\] \(root\): Unknown doc type "nope"$/m,
    );
  });

  it('a doc_type that does not match the doc_id is an error', () => {
    expect(thrown(() => cmsFiles([row('faq', pageDoc('not-found'), 'not-found')])).message).toMatch(
      /^faq \[doc\] \(root\): doc_type "not-found" does not match doc_id "faq" \(expected "faq"\)$/m,
    );
  });

  it('a doc_id that is not a safe file name is an error, never a path', () => {
    for (const id of ['../vercel', 'FAQ', 'faq/x', '']) {
      expect(thrown(() => cmsFiles([row(id, pageDoc('faq'), 'faq')])).message).toMatch(/invalid doc_id/);
    }
  });

  it('a duplicate doc_id is an error', () => {
    expect(thrown(() => cmsFiles([row('faq'), row('faq')])).message).toMatch(/^faq \[doc\] \(root\): duplicate doc_id$/m);
  });

  it('lists the first 20 errors in doc_id order, then "+N more"', () => {
    const docs = Array.from({ length: 25 }, (_, i) => row(`nope-${String(24 - i).padStart(2, '0')}`, {}));
    const lines = thrown(() => cmsFiles(docs)).message.split('\n');
    expect(lines[0]).toBe('CMS validation failed: 25 errors in 25 documents');
    expect(lines[1]).toMatch(/^nope-00 /);
    expect(lines[20]).toMatch(/^nope-19 /);
    expect(lines[21]).toBe('+5 more');
    expect(lines).toHaveLength(22);
  });

  it('keeps the warnings on the error: they survive the refusal', () => {
    const warned = edited('not-found', (d) => { d.en.meta.title = 'x'.repeat(75); });
    const bad = edited('faq', (d) => { d.en.hero = 42; });
    const e = thrown(() => cmsFiles([row('not-found', warned), row('faq', bad)]));
    expect(e.warnings).toContainEqual(
      { doc_id: 'not-found', locale: 'en', path: 'meta.title', message: expect.stringMatching(/Longer than recommended/) },
    );
  });

  it('clips each error line to 200 characters with "…"', () => {
    const e = new CmsValidationError([{ doc_id: 'faq', locale: 'en', path: 'hero.title', message: 'x'.repeat(500) }]);
    const line = e.message.split('\n')[1];
    expect(Array.from(line)).toHaveLength(MAX_LINE);
    expect(line.startsWith('faq [en] hero.title: xxx')).toBe(true);
    expect(line.endsWith('x…')).toBe(true);
    // A short line is untouched.
    expect(new CmsValidationError([{ doc_id: 'faq', locale: null, path: '', message: 'short' }]).message)
      .toBe('CMS validation failed: 1 error in 1 document\nfaq [doc] (root): short');
  });

  it('caps the whole message at 4 KB (UTF-8), ending "… +N more"', () => {
    // 30 errors whose clipped lines are ~400 bytes each (Greek is 2 bytes a character).
    const errors = Array.from({ length: 30 }, (_, i) => ({
      doc_id: `doc-${String(i).padStart(2, '0')}`, locale: 'el' as const, path: 'hero.lede', message: 'λ'.repeat(300),
    }));
    const msg = new CmsValidationError(errors).message;
    expect(new TextEncoder().encode(msg).length).toBeLessThanOrEqual(MAX_MESSAGE_BYTES);
    const lines = msg.split('\n');
    expect(lines[0]).toBe('CMS validation failed: 30 errors in 30 documents');
    const listed = lines.slice(1, -1);
    expect(listed.length).toBeGreaterThan(5);
    expect(listed.length).toBeLessThan(20);
    expect(listed.every((l, i) => l.startsWith(`doc-${String(i).padStart(2, '0')} [el] hero.lede: λ`) && l.endsWith('…'))).toBe(true);
    expect(lines.at(-1)).toBe(`… +${30 - listed.length} more`);
  });
});

describe('cmsFiles: titles and descriptions unique across pages (I2)', () => {
  const committedPages = () =>
    Object.fromEntries(readdirSync(resolve(root, 'content/pages')).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), pageDoc(f.slice(0, -5))]));

  it('a draft whose title duplicates a committed page is refused, naming both doc ids', () => {
    const data = edited('not-found', (d) => { d.en.meta.title = pageDoc('faq').en.meta.title; });
    const e = thrown(() => cmsFiles([row('not-found', data)], committedPages()));
    expect(e.errors).toEqual([
      { doc_id: 'not-found', locale: 'en', path: 'meta.title', message: expect.stringContaining('"faq"') },
    ]);
    expect(e.message).toMatch(/^not-found \[en\] meta\.title: Same SEO title as "faq"/m);
  });

  it('a duplicate description, el, is refused too', () => {
    const data = edited('not-found', (d) => { d.el.meta.description = pageDoc('about').el.meta.description; });
    const e = thrown(() => cmsFiles([row('not-found', data)], committedPages()));
    expect(e.errors).toEqual([
      { doc_id: 'not-found', locale: 'el', path: 'meta.description', message: expect.stringContaining('"about"') },
    ]);
  });

  it('the drafts being shipped override their committed copies: a swap of titles between two drafts is fine', () => {
    const faq = pageDoc('faq');
    const about = pageDoc('about');
    const a = edited('about', (d) => { d.en.meta.title = faq.en.meta.title; });
    const f = edited('faq', (d) => { d.en.meta.title = about.en.meta.title; });
    expect(Object.keys(cmsFiles([row('about', a), row('faq', f)], committedPages()).files).sort())
      .toEqual(['content/pages/about.json', 'content/pages/faq.json']);
  });

  it('two drafts with the same new title each get an error naming the other', () => {
    const a = edited('about', (d) => { d.en.meta.title = 'Brand new title'; });
    const f = edited('faq', (d) => { d.en.meta.title = 'Brand new title'; });
    const e = thrown(() => cmsFiles([row('about', a), row('faq', f)], committedPages()));
    expect(e.errors.map((x) => [x.doc_id, x.path, x.message.includes(x.doc_id === 'about' ? '"faq"' : '"about"')])).toEqual([
      ['about', 'meta.title', true],
      ['faq', 'meta.title', true],
    ]);
  });

  it('pagesFromFiles maps content/pages/{id}.json texts to { id: data }, ignoring other paths', () => {
    expect(pagesFromFiles({
      'content/pages/faq.json': '{"en":{"a":1},"el":{"a":2}}\n',
      'content/pages/sub/x.json': '{}',
      'content/site.json': '{}',
    })).toEqual({ faq: { en: { a: 1 }, el: { a: 2 } } });
  });
});

// ---------------------------------------------------------------------------

function contest(year: number, city_slug: string, stage: ContestRow['stage']): ContestRow {
  return {
    year, host_iso: null, city: city_slug, city_slug,
    semi1_date: null, semi2_date: null, final_date: null,
    stage, indexable: false, cancelled: false,
  };
}

const base: SnapshotInput = {
  contests: [contest(2026, 'vienna', 'archived'), contest(2027, 'burgas', 'current')],
  countries: [{ iso: 'AT', name_en: 'Austria', name_el: 'Αυστρία', slug: 'austria', related_iso: [] }],
  entries: [],
  generated_at: '2026-11-01T12:00:00Z',
};
const vercelJson = read('vercel.json');

function deps(input: SnapshotInput) {
  const endPublish = vi.fn(async () => {});
  const commitFiles = vi.fn(async (files: Record<string, string>, _m: (p: string[]) => string, t: FileTransforms) => {
    t['vercel.json'](vercelJson);
    return { sha: 'c1', changed: Object.keys(files).length, paths: Object.keys(files) };
  });
  const readCommittedPages = vi.fn(async () =>
    Object.fromEntries(readdirSync(resolve(root, 'content/pages')).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), pageDoc(f.slice(0, -5))])),
  );
  const beginPublish = vi.fn<(cms: boolean) => Promise<number>>(async () => 9);
  const d: PublishDeps = {
    rpc: { beginPublish, publishInput: async () => input, endPublish },
    commitFiles,
    readCommittedPages,
  };
  return { d, endPublish, commitFiles, readCommittedPages, beginPublish };
}

describe('runPublish with CMS drafts', () => {
  it('commits the drafts in the same single commit as the contest snapshot; site.json untouched', async () => {
    const data = edited('not-found', (d) => { d.en.hero.title = 'Lost in the arena'; });
    const { d, commitFiles } = deps({ ...base, cms_documents: [row('not-found', data)] });
    const out = await runPublish(d);
    expect(out).toMatchObject({ status: 'ok', run_id: 9, sha: 'c1' });
    expect(out).not.toHaveProperty('warnings');
    expect(commitFiles).toHaveBeenCalledTimes(1);
    const files = commitFiles.mock.calls[0][0];
    const snapshot = buildSnapshotFiles(base);
    expect(files).toEqual({ ...snapshot, 'content/pages/not-found.json': scriptStableJson(data) });
    expect(files['content/site.json']).toBe(snapshot['content/site.json']);
  });

  it('returns validation warnings with the result', async () => {
    const data = edited('not-found', (d) => { d.el.meta.title = 'y'.repeat(70); });
    const { d } = deps({ ...base, cms_documents: [row('not-found', data)] });
    const out = await runPublish(d);
    expect(out.status).toBe('ok');
    expect(out).toMatchObject({
      warnings: [{ doc_id: 'not-found', locale: 'el', path: 'meta.title', message: expect.any(String) }],
    });
  });

  it('an invalid draft refuses the whole publish: nothing committed, contests included', async () => {
    const bad = edited('faq', (d) => { d.en.hero = 42; });
    const { d, commitFiles, endPublish } = deps({ ...base, cms_documents: [row('not-found'), row('faq', bad)] });
    const out = await runPublish(d);
    expect(out.status).toBe('error');
    expect(commitFiles).not.toHaveBeenCalled();
    const error = (out as { error: string }).error;
    expect(error).toMatch(/^CMS validation failed: 1 error in 1 document\nfaq \[en\] hero: /);
    expect(endPublish).toHaveBeenCalledWith({ id: 9, status: 'error', sha: null, files: null, error });
  });

  it('a refused publish still returns the warnings', async () => {
    const warned = edited('not-found', (d) => { d.el.meta.title = 'y'.repeat(70); });
    const bad = edited('faq', (d) => { d.en.hero = 42; });
    const { d, commitFiles } = deps({ ...base, cms_documents: [row('not-found', warned), row('faq', bad)] });
    const out = await runPublish(d);
    expect(out.status).toBe('error');
    expect(commitFiles).not.toHaveBeenCalled();
    expect((out as { warnings?: unknown[] }).warnings).toContainEqual(
      { doc_id: 'not-found', locale: 'el', path: 'meta.title', message: expect.any(String) },
    );
  });

  it('a non-CMS error carries no warnings', async () => {
    const { d } = deps({ ...base, cms_documents: [row('not-found')] });
    d.commitFiles = async () => { throw new Error('GitHub 500'); };
    expect(await runPublish(d)).toEqual({ status: 'error', run_id: 9, sha: null, files_changed: 0, error: 'GitHub 500' });
  });

  it('checks title/description uniqueness against the committed pages: a duplicate refuses the publish (I2)', async () => {
    const data = edited('not-found', (d) => { d.en.meta.title = pageDoc('faq').en.meta.title; });
    const { d, commitFiles, readCommittedPages } = deps({ ...base, cms_documents: [row('not-found', data)] });
    const out = await runPublish(d);
    expect(readCommittedPages).toHaveBeenCalledTimes(1);
    expect(out.status).toBe('error');
    expect((out as { error: string }).error).toMatch(/not-found \[en\] meta\.title: Same SEO title as "faq"/);
    expect(commitFiles).not.toHaveBeenCalled();
  });

  it('does not read the committed pages when there are no drafts to ship', async () => {
    const { d, readCommittedPages } = deps({ ...base, cms_documents: [] });
    expect((await runPublish(d)).status).toBe('ok');
    expect(readCommittedPages).not.toHaveBeenCalled();
  });

  it('I3: a manual publish begins a CMS run and ships whatever drafts publish_input returns (only unpublished ones)', async () => {
    const data = edited('not-found', (d) => { d.en.hero.title = 'Lost in the arena'; });
    const { d, beginPublish, commitFiles } = deps({ ...base, cms_documents: [row('not-found', data)] });
    expect((await runPublish(d)).status).toBe('ok');
    expect(beginPublish).toHaveBeenCalledWith(true);
    expect(Object.keys(commitFiles.mock.calls[0][0])).toContain('content/pages/not-found.json');
  });

  it('I3: { cms: false } (contest lifecycle auto-publish) ships contests only: drafts skipped, not even validated', async () => {
    const bad = edited('faq', (d) => { d.en.hero = 42; });
    const { d, beginPublish, commitFiles, readCommittedPages } = deps({ ...base, cms_documents: [row('faq', bad)] });
    const out = await runPublish(d, { cms: false });
    expect(out).toEqual({ status: 'ok', run_id: 9, sha: 'c1', files_changed: Object.keys(buildSnapshotFiles(base)).length });
    expect(beginPublish).toHaveBeenCalledWith(false);
    expect(commitFiles.mock.calls[0][0]).toEqual(buildSnapshotFiles(base));
    expect(readCommittedPages).not.toHaveBeenCalled();
  });
});

describe('publishOptions (the request body)', () => {
  it('ships CMS drafts unless the body says cms: false', () => {
    expect(publishOptions({})).toEqual({ cms: true });
    expect(publishOptions(null)).toEqual({ cms: true });
    expect(publishOptions({ cms: true })).toEqual({ cms: true });
    expect(publishOptions({ cms: false })).toEqual({ cms: false });
    expect(publishOptions({ cms: 'no' })).toEqual({ cms: true });
    expect(publishOptions('garbage')).toEqual({ cms: true });
  });
});

// CMS drafts → content/pages/{doc_id}.json (CMS 3b).
//
// Drafts are overrides: each one is written over its page file; a doc
// without a draft is never touched (its committed file stays the source).
// Every draft is validated server-side first, and one invalid draft refuses
// the whole publish (CmsValidationError) so nothing half-checked reaches the
// site. Warnings never block; they are returned for the admin to show.
//
// Pure and Deno-free. The bare 'zod' import inside _shared/cms resolves via
// this function's deno.json import map (pinned to package.json's version,
// tests/functions/zodPin.test.ts).
import { docTypeFor } from '../_shared/cms/registry.ts';
import { validateDocument, type Locale } from '../_shared/cms/validate.ts';
import { stableJson, type CmsDocumentRow } from './snapshot.ts';

/** A validation issue with the document it belongs to. */
export type CmsIssue = { doc_id: string; locale: Locale | null; path: string; message: string };

/** Errors listed in the message; the rest are counted ("+N more"). */
const LISTED = 20;

/** Same rule as cms_documents.doc_id (migration 076): a safe file name. */
const DOC_ID = /^[a-z0-9-]+$/;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** `faq [en] hero.title: Required`; a document-level issue is `faq [doc] (root): ...`. */
export const formatIssue = (i: CmsIssue) => `${i.doc_id} [${i.locale ?? 'doc'}] ${i.path || '(root)'}: ${i.message}`;

export class CmsValidationError extends Error {
  readonly errors: CmsIssue[];

  constructor(errors: CmsIssue[]) {
    const docs = new Set(errors.map((e) => e.doc_id)).size;
    const lines = [
      `CMS validation failed: ${plural(errors.length, 'error')} in ${plural(docs, 'document')}`,
      ...errors.slice(0, LISTED).map(formatIssue),
      ...(errors.length > LISTED ? [`+${errors.length - LISTED} more`] : []),
    ];
    super(lines.join('\n'));
    this.name = 'CmsValidationError';
    this.errors = errors;
  }
}

const byDocId = (a: CmsDocumentRow, b: CmsDocumentRow) => (a.doc_id < b.doc_id ? -1 : a.doc_id > b.doc_id ? 1 : 0);

/**
 * Validates every draft and serializes each to content/pages/{doc_id}.json
 * (keys sorted, 2-space indent, trailing newline: the 3a file format).
 * Throws CmsValidationError listing every error when any draft is invalid.
 */
export function cmsFiles(docs: readonly CmsDocumentRow[] | undefined): { files: Record<string, string>; warnings: CmsIssue[] } {
  const files: Record<string, string> = {};
  const errors: CmsIssue[] = [];
  const warnings: CmsIssue[] = [];
  const seen = new Set<string>();

  for (const { doc_id, doc_type, data } of [...(docs ?? [])].sort(byDocId)) {
    const docError = (message: string) => errors.push({ doc_id, locale: null, path: '', message });
    if (!DOC_ID.test(doc_id)) {
      docError(`invalid doc_id ${JSON.stringify(doc_id)}`);
      continue;
    }
    if (seen.has(doc_id)) {
      docError('duplicate doc_id');
      continue;
    }
    seen.add(doc_id);
    const expected = docTypeFor(doc_id);
    if (doc_type !== expected) {
      docError(`doc_type "${doc_type}" does not match doc_id "${doc_id}" (expected "${expected}")`);
      continue;
    }
    // An unregistered type (a family not migrated yet, a stray id) is an error here.
    const result = validateDocument(doc_type, data);
    for (const w of result.warnings) warnings.push({ doc_id, ...w });
    if (!result.ok) {
      for (const e of result.errors) errors.push({ doc_id, ...e });
      continue;
    }
    // The draft as saved (schemas have no transforms, so it equals the parse).
    files[`content/pages/${doc_id}.json`] = stableJson(data);
  }

  if (errors.length) throw new CmsValidationError(errors);
  return { files, warnings };
}

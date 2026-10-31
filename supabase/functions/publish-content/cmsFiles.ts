// CMS drafts → content/pages/{doc_id}.json (CMS 3b).
//
// Drafts are overrides: each one is written over its page file; a doc
// without a draft is never touched (its committed file stays the source).
// Every draft is validated server-side first, and one invalid draft refuses
// the whole publish (CmsValidationError) so nothing half-checked reaches the
// site. Warnings never block; they are returned for the admin to show.
//
// Titles and meta descriptions must also be unique per locale across the
// site pages (the build's check-prerender fails otherwise): given the
// committed pages, the set after this publish (committed, overlaid with the
// drafts shipped) is checked, and a draft that collides is an error naming
// the other page (_shared/cms/seo.ts).
//
// Editorial docs (archive-{year}, country-{iso}, hub-{year}) are optional, so
// content/pages/index.json lists the ones that exist (pagesIndex.ts). It is
// rewritten whenever an editorial draft ships: the committed editorial ids
// plus the shipped ones. Only an editorial draft can add an id (nothing
// deletes a page doc), so other publishes leave it untouched.
//
// Pure and Deno-free. The bare 'zod' import inside _shared/cms resolves via
// this function's deno.json import map (pinned to package.json's version,
// tests/functions/zodPin.test.ts).
import { docTypeFor } from '../_shared/cms/registry.ts';
import { validateDocument, type Locale } from '../_shared/cms/validate.ts';
import { seoDuplicates } from '../_shared/cms/seo.ts';
import { isEditorialDocId, PAGES_INDEX_FILE, pagesIndex } from '../_shared/cms/pagesIndex.ts';
import { stableJson } from '../_shared/stableJson.ts';
import type { CmsDocumentRow } from './snapshot.ts';

/** A validation issue with the document it belongs to. */
export type CmsIssue = { doc_id: string; locale: Locale | null; path: string; message: string };

/** Errors listed in the message; the rest are counted ("+N more"). */
const LISTED = 20;
/** Max characters of one listed error line (longer ones end in "…"). */
export const MAX_LINE = 200;
/** Max UTF-8 bytes of the whole message (it is stored in publish_runs.error and shown in the admin). */
export const MAX_MESSAGE_BYTES = 4096;

/** Same rule as cms_documents.doc_id (migration 076): a safe file name. */
const DOC_ID = /^[a-z0-9-]+$/;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** At most `max` code points, the last being "…" when cut. */
function clip(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max - 1).join('') + '…';
}

/** `faq [en] hero.title: Required`; a document-level issue is `faq [doc] (root): ...`. */
export const formatIssue = (i: CmsIssue) => `${i.doc_id} [${i.locale ?? 'doc'}] ${i.path || '(root)'}: ${i.message}`;

/**
 * Header, then the first LISTED errors (each clipped to MAX_LINE), then
 * "+N more". If that exceeds MAX_MESSAGE_BYTES, trailing error lines are
 * dropped and the tail becomes "… +N more" counting every unlisted error.
 */
function errorMessage(errors: CmsIssue[]): string {
  const docs = new Set(errors.map((e) => e.doc_id)).size;
  const header = `CMS validation failed: ${plural(errors.length, 'error')} in ${plural(docs, 'document')}`;
  const lines = errors.slice(0, LISTED).map((e) => clip(formatIssue(e), MAX_LINE));
  const full = [header, ...lines, ...(errors.length > LISTED ? [`+${errors.length - LISTED} more`] : [])].join('\n');
  if (bytes(full) <= MAX_MESSAGE_BYTES) return full;
  for (let n = lines.length - 1; n >= 0; n--) {
    const msg = [header, ...lines.slice(0, n), `… +${errors.length - n} more`].join('\n');
    if (bytes(msg) <= MAX_MESSAGE_BYTES) return msg;
  }
  return clip(header, 200); // unreachable: the header alone is short
}

export class CmsValidationError extends Error {
  readonly errors: CmsIssue[];
  /** Warnings from the same run (they survive the refusal so the admin can show them). */
  readonly warnings: CmsIssue[];

  constructor(errors: CmsIssue[], warnings: CmsIssue[] = []) {
    super(errorMessage(errors));
    this.name = 'CmsValidationError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

const byDocId = (a: CmsDocumentRow, b: CmsDocumentRow) => (a.doc_id < b.doc_id ? -1 : a.doc_id > b.doc_id ? 1 : 0);

const PAGE_FILE = /^content\/pages\/([a-z0-9-]+)\.json$/;

/** content/pages/{doc_id}.json texts (other paths and the index ignored) as { doc_id: parsed document }. */
export function pagesFromFiles(files: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, text] of Object.entries(files)) {
    const m = PAGE_FILE.exec(path);
    if (m && path !== PAGES_INDEX_FILE) out[m[1]] = JSON.parse(text);
  }
  return out;
}

/**
 * Validates every draft and serializes each to content/pages/{doc_id}.json
 * (keys sorted, 2-space indent, trailing newline: the 3a file format), plus
 * content/pages/index.json when an editorial draft is among them.
 * `committed` (doc_id -> document, the pages in the commit's parent) is what
 * the drafts overlay for the cross-page title/description check and the
 * index.
 * Throws CmsValidationError listing every error when any draft is invalid.
 */
export function cmsFiles(
  docs: readonly CmsDocumentRow[] | undefined,
  committed: Record<string, unknown> = {},
): { files: Record<string, string>; warnings: CmsIssue[] } {
  const files: Record<string, string> = {};
  const valid: Record<string, unknown> = {};
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
    valid[doc_id] = data;
  }

  for (const issue of seoDuplicates({ ...committed, ...valid }, Object.keys(valid))) errors.push(issue);

  if (errors.length) throw new CmsValidationError(errors, warnings);
  if (Object.keys(valid).some(isEditorialDocId)) {
    files[PAGES_INDEX_FILE] = stableJson(pagesIndex([...Object.keys(committed), ...Object.keys(valid)]));
  }
  return { files, warnings };
}

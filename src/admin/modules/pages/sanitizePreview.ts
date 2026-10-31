// The admin preview renders the draft as edited, before it validates (I1).
// Two kinds of field reach the DOM in a way a bad value could abuse:
// - rawHtml strings go through dangerouslySetInnerHTML: one that breaks the
//   allowlist (htmlErrors) is shown as its HTML-escaped text instead;
// - href fields go into <a href> / <Link to>: one that fails isSafeHref
//   becomes "#".
// - mediaRef fields go into <img src> / <video src> (through the preview's
//   media resolver): one that is not a draft or published reference of its
//   kind becomes "";
// - richText is rendered through its AST (never raw HTML), so any string is
//   safe; a non-string becomes "".
// A value of the wrong type at either kind of path is treated the same way
// (an array would otherwise be joined into markup by innerHTML).
//
// Works on a copy; the editor's draft is never changed. A document the
// walker cannot follow (unknown doc type, not an object) is returned as is:
// the page then fails in its own error boundary, rendering nothing raw.
import type { z } from 'zod';
import { CMS_DOC_TYPES } from '../../../../supabase/functions/_shared/cms/registry';
import { mediaRefPattern } from '../../../../supabase/functions/_shared/cms/fields';
import { walkSchema, type Segment } from '../../../../supabase/functions/_shared/cms/walk';
import { htmlErrors, isSafeHref } from '../../../../supabase/functions/_shared/cms/html';

const LOCALES = ['en', 'el'] as const;

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** `s` as HTML text: rendered through innerHTML it shows exactly `s`, creating no markup. */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function setAt(root: unknown, segments: Segment[], value: unknown): void {
  let node = root as Record<string | number, unknown>;
  for (const seg of segments.slice(0, -1)) node = node[seg] as Record<string | number, unknown>;
  node[segments[segments.length - 1]] = value;
}

/** A copy of the draft `doc` of `docType` that is safe to render in the preview. */
export function sanitizePreviewDoc(docType: string, doc: unknown): unknown {
  const def = Object.prototype.hasOwnProperty.call(CMS_DOC_TYPES, docType) ? CMS_DOC_TYPES[docType] : undefined;
  if (!def) return doc;
  return sanitizeSchemaDoc(def.schema, doc);
}

/** sanitizePreviewDoc for a document of one locale's `schema`. */
export function sanitizeSchemaDoc(schema: z.ZodType, doc: unknown): unknown {
  if (!isRecord(doc)) return doc;
  const out = structuredClone(doc);
  for (const locale of LOCALES) {
    const root = out[locale];
    if (root === undefined) continue;
    walkSchema(schema, (n) => {
      if (n.type !== 'string' || !n.segments.length) return;
      const v = n.values[0];
      if (v === undefined) return;
      if (n.meta.rawHtml) {
        if (typeof v !== 'string') setAt(root, n.segments, escapeHtml(String(v)));
        else if (htmlErrors(v).length) setAt(root, n.segments, escapeHtml(v));
      } else if (n.meta.kind === 'href') {
        if (typeof v !== 'string' || !isSafeHref(v)) setAt(root, n.segments, '#');
      } else if (n.meta.kind === 'mediaRef') {
        if (typeof v !== 'string' || !mediaRefPattern(n.meta.mediaKind!).test(v)) setAt(root, n.segments, '');
      } else if (n.meta.kind === 'richText') {
        if (typeof v !== 'string') setAt(root, n.segments, '');
      }
    }, [root]);
  }
  return out;
}

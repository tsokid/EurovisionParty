// The history RPCs of migration 085. Every call throws on failure.
import { supabase } from '../../lib/supabase';
import { formatError } from '../lib/formatError';
import type { z } from 'zod';
import { schemaInfo, childLabel } from '../modules/pages/form/formModel';
import type { Path } from './fieldDiff';
import { describePath } from './fieldDiff';

export type RevisionKind = 'checkpoint' | 'published' | 'restored' | 'seed';

export type RevisionRow = {
  id: number;
  kind: RevisionKind;
  author: string | null;
  author_email: string | null;
  created_at: string;
  updated_at: string;
  run_id: number | null;
  commit_sha: string | null;
  restored_from: number | null;
};

export type Revision = { id: number; doc_id: string; doc_type: string; kind: RevisionKind; data: unknown; created_at: string; updated_at: string };

export async function cmsHistory(docId: string): Promise<RevisionRow[]> {
  const { data, error } = await supabase.rpc('cms_history', { p_doc_id: docId });
  if (error) throw error;
  return (data ?? []) as RevisionRow[];
}

export async function cmsRevision(revId: number): Promise<Revision | null> {
  const { data, error } = await supabase.rpc('cms_revision', { p_rev_id: revId });
  if (error) throw error;
  return (data ?? null) as Revision | null;
}

/** Writes revision `revId` into the draft (a new 'restored' revision); returns the new updated_at. */
export async function cmsRestore(docId: string, revId: number, expectedUpdatedAt: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('cms_restore', { p_doc_id: docId, p_rev_id: revId, p_expected_updated_at: expectedUpdatedAt });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('cms_restore returned no timestamp');
  return data;
}

/** True when the error says the 085 RPCs are not deployed yet. */
export const isMissingRpc = (e: unknown): boolean => /could not find the function|does not exist|PGRST202/i.test(formatError(e));

/**
 * A changed field's label from the doc type's schema ("EL · FAQ › Item 2 ›
 * Question"), following block types through the value; falls back to the
 * raw path for anything the schema does not describe.
 */
export function labelForPath(schema: z.ZodType | undefined, doc: unknown, path: Path): string {
  if (!schema || path.length === 0) return describePath(path);
  const [locale, ...rest] = path;
  const head = locale === 'en' || locale === 'el' ? String(locale).toUpperCase() : null;
  if (!head) return describePath(path);
  let node: z.ZodType | undefined = schema;
  let value: unknown = (doc as Record<string, unknown> | null)?.[locale as string];
  const parts: string[] = [];
  for (const seg of rest) {
    if (!node) { parts.push(String(seg)); continue; }
    let info = schemaInfo(node);
    while (info.inner) { node = info.inner; info = schemaInfo(node); }
    if (typeof seg === 'number') {
      parts.push(`#${seg + 1}`);
      const item = Array.isArray(value) ? value[seg] : undefined;
      if (info.variants && info.discriminator) {
        const type = (item as Record<string, unknown> | undefined)?.[info.discriminator];
        node = typeof type === 'string' ? info.variants[type] : undefined;
      } else {
        node = info.element ?? info.children.find((c) => c.key === seg)?.schema;
      }
      value = item;
      continue;
    }
    const child = info.children.find((c) => c.key === seg);
    parts.push(child ? childLabel(seg, child.schema) : seg);
    node = child?.schema;
    value = (value as Record<string, unknown> | undefined)?.[seg];
  }
  return parts.length ? `${head} · ${parts.join(' › ')}` : head;
}

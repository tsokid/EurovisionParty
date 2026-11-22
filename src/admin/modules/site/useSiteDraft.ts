// One site-wide doc (site-header, site-footer, site-settings) being edited:
// its draft (cms_documents, migration 076) or, without one, the published
// doc this build shipped with; Save keeps a draft (cms_save, with the usual
// optimistic concurrency), Discard drops it, Publish saves then runs the
// existing publish pipeline (publish-content). Validation runs on every edit.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cmsDiscard, cmsGet, cmsList, cmsSave, isConflict } from '../pages/cmsApi';
import { formatError } from '../../lib/formatError';
import { usePublisher, type PublishOutcome } from '../contests/publish';
import { useUnsavedGuard } from '../../unsavedGuard';
import { publishedSiteDoc } from '../../../lib/cms/siteChrome';
import { validateDocument, type ValidationError } from '../../../../supabase/functions/_shared/cms/validate';
import type { SiteWideDocId } from '../../../../supabase/functions/_shared/cms/siteLinks';
import type { DocValue } from '../pages/form/SchemaForm';

export type Locale = 'en' | 'el';
// The editors index into the doc freely; validateDocument is the type check.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LooseDoc = Record<Locale, any>;

/** Where the doc stands: matches the site, has an unpublished saved draft, or unsaved edits. */
export type DraftStatus = 'live' | 'draft' | 'unsaved';

export interface SiteDraft {
  docId: SiteWideDocId;
  loading: boolean;
  loadError: string | null;
  doc: LooseDoc;
  /** Replace the doc (every edit goes through here). */
  setDoc: (next: LooseDoc | ((prev: LooseDoc) => LooseDoc)) => void;
  status: DraftStatus;
  dirty: boolean;
  /** Errors by "locale:path" ("el:columns.0.links.2.label") and by path for shared fields. */
  errors: ValidationError[];
  errorAt: (path: string, locale?: Locale) => string | null;
  saving: boolean;
  saveError: string | null;
  save: () => Promise<boolean>;
  discard: () => Promise<void>;
  publishing: boolean;
  publish: () => Promise<PublishOutcome | null>;
  outcome: PublishOutcome | null;
  /** Other page drafts the publish will ship too. */
  otherDrafts: string[];
}

const clone = <T,>(v: T): T => structuredClone(v);

/** The schema's messages, in the owner's words. */
export function plainMessage(message: string): string {
  if (/^Required/.test(message)) return 'Γράψτε κάτι εδώ';
  if (/already in (this list|the header)/.test(message)) return 'Αυτή η σελίδα υπάρχει ήδη εδώ';
  if (/https/.test(message)) return 'Πρέπει να ξεκινά με https://';
  if (/email/.test(message)) return 'Δεν είναι διεύθυνση email';
  if (/already listed/.test(message)) return 'Υπάρχει ήδη';
  const long = /^Too long: \d+ characters, max (\d+)/.exec(message);
  if (long) return `Πολύ μεγάλο: μέχρι ${long[1]} χαρακτήρες`;
  if (/placeholder|escaped braces/.test(message)) return 'Μόνο το {year} μπαίνει σε αγκύλες';
  if (/Pick a page/.test(message)) return 'Διαλέξτε σελίδα';
  if (/no longer|Invalid option/.test(message)) return 'Η σελίδα δεν υπάρχει πια: διαλέξτε άλλη';
  return message;
}

export function useSiteDraft(docId: SiteWideDocId): SiteDraft {
  const published = useMemo(() => clone(publishedSiteDoc(docId)) as LooseDoc, [docId]);
  const [doc, setDocState] = useState<LooseDoc>(published);
  const [saved, setSaved] = useState<string>(() => JSON.stringify(published));
  const [hasDraft, setHasDraft] = useState(false);
  const [draftPublished, setDraftPublished] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const publisher = usePublisher();
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const [draft, rows] = await Promise.all([cmsGet(docId), cmsList()]);
        if (off) return;
        const row = rows.find((r) => r.doc_id === docId);
        if (draft) {
          setDocState(clone(draft.data as LooseDoc));
          setSaved(JSON.stringify(draft.data));
          setUpdatedAt(draft.updated_at);
          setHasDraft(true);
          setDraftPublished(!!row?.published);
        }
        setLoadError(null);
      } catch (e) {
        if (!off) setLoadError(formatError(e));
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => { off = true; };
  }, [docId]);

  const setDoc = useCallback((next: LooseDoc | ((prev: LooseDoc) => LooseDoc)) => {
    setDocState((prev) => (typeof next === 'function' ? (next as (p: LooseDoc) => LooseDoc)(prev) : next));
  }, []);

  const dirty = JSON.stringify(doc) !== saved;
  useUnsavedGuard(dirty);

  const result = useMemo(() => validateDocument(docId, doc), [docId, doc]);
  const errors = result.ok ? [] : result.errors;
  const errorAt = useCallback((path: string, locale?: Locale) => {
    const hit = errors.find((e) => e.path === path && (locale === undefined || e.locale === locale || e.locale === null));
    return hit ? plainMessage(hit.message) : null;
  }, [errors]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const at = await cmsSave(docId, docId, doc as DocValue, updatedAt);
      if (!alive.current) return true;
      setUpdatedAt(at);
      setSaved(JSON.stringify(doc));
      setHasDraft(true);
      setDraftPublished(false);
      return true;
    } catch (e) {
      if (alive.current) {
        setSaveError(isConflict(e)
          ? 'Κάποιος άλλος άλλαξε αυτό το κείμενο στο μεταξύ. Φορτώστε ξανά τη σελίδα για να δείτε την τελευταία εκδοχή.'
          : formatError(e));
      }
      return false;
    } finally {
      if (alive.current) setSaving(false);
    }
  }, [docId, doc, updatedAt]);

  const discard = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (hasDraft) await cmsDiscard(docId);
      const fresh = clone(published);
      setDocState(fresh);
      setSaved(JSON.stringify(fresh));
      setHasDraft(false);
      setUpdatedAt(null);
    } catch (e) {
      setSaveError(formatError(e));
    } finally {
      setSaving(false);
    }
  }, [docId, hasDraft, published]);

  const publish = useCallback(async () => {
    if (dirty && !(await save())) return null;
    const o = await publisher.publish();
    if (o.status === 'ok' || o.status === 'noop') setDraftPublished(true);
    return o;
  }, [dirty, save, publisher]);

  const status: DraftStatus = dirty ? 'unsaved' : hasDraft && !draftPublished ? 'draft' : 'live';
  const otherDrafts = (publisher.summary?.changed_docs ?? []).filter((d) => d !== docId);

  return {
    docId, loading, loadError, doc, setDoc, status, dirty, errors, errorAt,
    saving, saveError, save, discard,
    publishing: publisher.publishing, publish, outcome: publisher.outcome, otherDrafts,
  };
}

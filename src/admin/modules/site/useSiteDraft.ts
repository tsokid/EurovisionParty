// One site-wide doc (site-header, site-footer, site-settings) being edited:
// its draft (cms_documents, migration 076) or, without one, the published
// doc this build shipped with. Every edit autosaves (CMS P3, src/admin/cms:
// buffered locally, saved ~1.5 s after the last change, merged with the
// other editor's saves); Discard drops the draft, Publish saves what waits
// then runs the existing publish pipeline (publish-content). Validation
// runs on every edit, and an invalid doc is kept locally, not sent.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cmsDiscard, cmsGet, cmsList, cmsSave, isConflict } from '../pages/cmsApi';
import { usePublisher, type PublishOutcome } from '../contests/publish';
import { useCmsDoc, type CmsDoc } from '../../cms/useCmsDoc';
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
  /** Sends what waits now; true when the server has it. */
  save: () => Promise<boolean>;
  /** The autosave session: status pill, presence, conflicts. */
  cms: CmsDoc;
  discard: () => Promise<void>;
  publishing: boolean;
  outcome: PublishOutcome | null;
  /** Other page drafts the publish will ship too. */
  otherDrafts: string[];
}

const clone = <T,>(v: T): T => structuredClone(v);

/** The schema's messages, in the owner's words. */
export function plainMessage(message: string): string {
  if (/^Required/.test(message)) return 'Γράψε κάτι εδώ';
  if (/already in (this list|the header)/.test(message)) return 'Αυτή η σελίδα υπάρχει ήδη εδώ';
  if (/https/.test(message)) return 'Πρέπει να ξεκινά με https://';
  if (/email/.test(message)) return 'Δεν είναι διεύθυνση email';
  if (/already listed/.test(message)) return 'Υπάρχει ήδη';
  const long = /^Too long: \d+ characters, max (\d+)/.exec(message);
  if (long) return `Πολύ μεγάλο: μέχρι ${long[1]} χαρακτήρες`;
  if (/placeholder|escaped braces/.test(message)) return 'Μόνο το {year} μπαίνει σε αγκύλες';
  if (/Pick a page/.test(message)) return 'Διάλεξε σελίδα';
  if (/no longer|Invalid option/.test(message)) return 'Η σελίδα δεν υπάρχει πια: διάλεξε άλλη';
  return message;
}

export function useSiteDraft(docId: SiteWideDocId): SiteDraft {
  const published = useMemo(() => clone(publishedSiteDoc(docId)) as LooseDoc, [docId]);
  const [draftPublished, setDraftPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const publisher = usePublisher();
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    let off = false;
    cmsList().then((rows) => {
      if (!off) setDraftPublished(!!rows.find((r) => r.doc_id === docId)?.published);
    }, () => {});
    return () => { off = true; };
  }, [docId]);

  const loadRemote = useCallback(async () => {
    const draft = await cmsGet(docId);
    return draft ? { value: clone(draft.data), updatedAt: draft.updated_at } : { value: clone(published), updatedAt: null };
  }, [docId, published]);

  const cms = useCmsDoc({
    docId,
    loadRemote,
    save: async (v, exp) => {
      const at = await cmsSave(docId, docId, v as DocValue, exp);
      if (alive.current) setDraftPublished(false);
      return at;
    },
    isConflictError: isConflict,
    validate: (v) => validateDocument(docId, v).ok,
  });

  const doc = (cms.value ?? published) as LooseDoc;
  const latest = useRef(doc);
  latest.current = doc;
  const setDoc = useCallback((next: LooseDoc | ((prev: LooseDoc) => LooseDoc)) => {
    const value = typeof next === 'function' ? (next as (p: LooseDoc) => LooseDoc)(latest.current) : next;
    latest.current = value;
    cms.edit(value);
  }, [cms]);

  const dirty = cms.ready && cms.status !== 'saved';
  const result = useMemo(() => validateDocument(docId, doc), [docId, doc]);
  const errors = result.ok ? [] : result.errors;
  const errorAt = useCallback((path: string, locale?: Locale) => {
    const hit = errors.find((e) => e.path === path && (locale === undefined || e.locale === locale || e.locale === null));
    return hit ? plainMessage(hit.message) : null;
  }, [errors]);

  const save = useCallback(async () => {
    await cms.flush();
    return cms.ready;
  }, [cms]);

  const discard = useCallback(async () => {
    setSaving(true);
    try {
      if (cms.baseUpdatedAt !== null) await cmsDiscard(docId);
      cms.reset({ value: clone(published), updatedAt: null });
    } catch {
      /* the pill keeps showing the draft; Discard can be tried again */
    } finally {
      if (alive.current) setSaving(false);
    }
  }, [docId, published, cms]);

  const status: DraftStatus = dirty ? 'unsaved' : cms.baseUpdatedAt !== null && !draftPublished ? 'draft' : 'live';
  const otherDrafts = (publisher.summary?.changed_docs ?? []).filter((d) => d !== docId);

  return {
    docId, loading: !cms.ready && !cms.loadError, loadError: cms.loadError, doc, setDoc, status, dirty, errors, errorAt,
    saving: saving || cms.status === 'saving', saveError: cms.status === 'error' ? cms.error : null, save, discard, cms,
    publishing: publisher.publishing, outcome: publisher.outcome, otherDrafts,
  };
}

// The editor of one CMS page: the schema form and the live preview of the
// draft, side by side from 1280px (Edit / Preview tabs below that).
//
// - Load: the saved draft (cms_get), else the published file as the base
//   (expected_updated_at null: the first save creates the draft). An
//   editorial doc that is neither saved nor published (content/pages/
//   index.json) starts from the schema's empty value.
// - Validate: live, 300 ms after the last edit, with the live contest as
//   context, plus the cross-page check: the SEO title and meta description
//   must differ from every other published page's, the editorial docs'
//   metaDescription overrides included (seo.ts; the build fails on a
//   duplicate). Errors block Save; warnings never do. Save re-validates what it
//   sends: inside the 300 ms window an invalid draft shows SAVE_BLOCKED_TEXT.
// - Save: cms_save against the updated_at of what was loaded or last saved.
//   A save over someone else's newer save is refused: the banner offers a
//   reload, and the user's edits stay in the form until they take it.
// - Discard draft: cms_discard, then back to the published version.
// - Unsaved edits arm the admin's leave guard (unsavedGuard.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CMS_DOC_TYPES, docTypeFor } from '../../../../supabase/functions/_shared/cms/registry';
import { validateDocument, type ValidationError, type ValidationWarning } from '../../../../supabase/functions/_shared/cms/validate';
import { seoDuplicates } from '../../../../supabase/functions/_shared/cms/seo';
import { formatError } from '../../lib/formatError';
import { useUnsavedGuard } from '../../unsavedGuard';
import { formatRunTime } from '../contests/publish';
import { cmsDiscard, cmsGet, cmsSave, fetchPublished, fetchPublishedEditorialIds, fetchPublishedPages, isConflict } from './cmsApi';
import { isEditorialDocId } from '../../../../supabase/functions/_shared/cms/pagesIndex';
import { emptyEditorialDoc } from './editorialPages';
import { SITE_PAGES } from './sitePages';
import { useContestContext } from './contestContext';
import { SchemaForm, type DocValue } from './form/SchemaForm';
import PreviewPane from './PreviewPane';
import { useDebounced } from './useDebounced';

export const VALIDATE_DELAY_MS = 300;
export const CONFLICT_TEXT = 'Someone else changed this page — Reload';
export const RELOAD_CONFIRM = 'Discard your edits and load the latest?';
/** Save clicked before the debounced errors show, on an invalid draft. */
export const SAVE_BLOCKED_TEXT = 'Fix the errors below before saving';

/** Where the editor's base came from: a saved draft, the published file, or nothing yet (a new editorial doc). */
type Base = { source: 'draft' | 'published' | 'new'; updatedAt: string | null };

/** The edited document; `fromLoad` (not a keystroke) skips the debounce. */
type Draft = { value: DocValue; fromLoad: boolean };

type Tab = 'edit' | 'preview';

const NO_ERRORS: readonly ValidationError[] = [];
const NO_WARNINGS: readonly ValidationWarning[] = [];

/** Title/description collisions of `value` (as doc `docId`) with the other published pages. */
function seoErrors(docId: string, value: unknown, others: Record<string, unknown> | null): ValidationError[] {
  if (!others) return [];
  return seoDuplicates({ ...others, [docId]: value }, [docId]).map(({ locale, path, message }) => ({ locale, path, message }));
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const BUTTON = 'px-3 py-1.5 rounded font-bold text-sm disabled:opacity-40 cursor-pointer';

interface Props {
  docId: string;
  label: string;
  /** Editorial docs: the unprefixed public path of the page the preview shows. */
  previewPath?: string;
  /** A draft was saved or discarded: refresh the list and the publish count. */
  onChanged: () => void;
}

/** The published editorial ids; [] when the index cannot be read (the SEO check then skips them; Publish checks again). */
const editorialIdsOrNone = () => fetchPublishedEditorialIds().catch(() => [] as string[]);

export function PageEditor({ docId, label, previewPath, onChanged }: Props) {
  const docType = docTypeFor(docId);
  const schema = CMS_DOC_TYPES[docType]?.schema;
  const { vars, context } = useContestContext();

  const [base, setBase] = useState<Base | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  // The value last loaded or saved: the draft is dirty when it differs.
  const [saved, setSaved] = useState<DocValue | null>(null);
  const [busy, setBusy] = useState<'load' | 'save' | 'discard' | null>('load');
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('edit');
  // The other site pages as published, for the cross-page SEO check.
  const [others, setOthers] = useState<Record<string, unknown> | null>(null);
  const loadSeq = useRef(0);

  useEffect(() => {
    let live = true;
    setOthers(null);
    editorialIdsOrNone()
      .then((editorial) => fetchPublishedPages([...SITE_PAGES.map((p) => p.docId), ...editorial].filter((id) => id !== docId)))
      .then((pages) => {
        if (live) setOthers(pages);
      });
    return () => { live = false; };
  }, [docId]);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setBusy('load');
    setErr(null);
    try {
      const row = await cmsGet(docId);
      const fresh = !row && isEditorialDocId(docId) && !(await fetchPublishedEditorialIds()).includes(docId);
      const value = row ? row.data : fresh ? emptyEditorialDoc() : await fetchPublished(docId);
      if (seq !== loadSeq.current) return;
      setBase(row ? { source: 'draft', updatedAt: row.updated_at } : { source: fresh ? 'new' : 'published', updatedAt: null });
      setDraft({ value, fromLoad: true });
      setBlocked(false);
      setSaved(value);
      setConflict(false);
    } catch (e) {
      if (seq === loadSeq.current) setErr(formatError(e));
    } finally {
      if (seq === loadSeq.current) setBusy(null);
    }
  }, [docId]);

  useEffect(() => { load(); }, [load]);

  const dirty = !!draft && draft.value !== saved;
  useUnsavedGuard(dirty);

  const shown = useDebounced(draft?.value ?? null, VALIDATE_DELAY_MS, draft?.fromLoad ?? true);
  const validation = useMemo(
    () => (shown ? validateDocument(docType, shown, context) : null),
    [docType, shown, context],
  );
  const duplicates = useMemo(() => (shown ? seoErrors(docId, shown, others) : []), [docId, shown, others]);
  const errors = useMemo(
    () => (validation && (validation.errors.length || duplicates.length) ? [...validation.errors, ...duplicates] : NO_ERRORS),
    [validation, duplicates],
  );
  const warnings = validation?.warnings ?? NO_WARNINGS;

  const onChange = useCallback((next: DocValue) => {
    setDraft({ value: next, fromLoad: false });
    setNotice(null);
    setBlocked(false);
  }, []);

  const save = async () => {
    if (!draft || !base) return;
    const value = draft.value;
    // The debounced result may be up to 300 ms old: check what is being saved.
    if (!validateDocument(docType, value, context).ok || seoErrors(docId, value, others).length) {
      setNotice(null);
      setBlocked(true);
      return;
    }
    setBlocked(false);
    setBusy('save');
    setErr(null);
    setNotice(null);
    try {
      const updatedAt = await cmsSave(docId, docType, value, base.updatedAt);
      setBase({ source: 'draft', updatedAt });
      setSaved(value);
      setNotice('Saved');
      onChanged();
    } catch (e) {
      if (isConflict(e)) setConflict(true);
      else setErr(formatError(e));
    } finally {
      setBusy(null);
    }
  };

  const reloadLatest = () => {
    if (dirty && !window.confirm(RELOAD_CONFIRM)) return;
    setNotice(null);
    load();
  };

  const discard = async () => {
    const lost = dirty ? ' Your unsaved edits are lost too.' : '';
    if (!window.confirm(`Discard the saved draft of "${label}"? The editor goes back to the published version.${lost}`)) return;
    setBusy('discard');
    setErr(null);
    setNotice(null);
    try {
      await cmsDiscard(docId);
      onChanged();
      await load();
      setNotice('Draft discarded');
    } catch (e) {
      setErr(formatError(e));
      setBusy(null);
    }
  };

  if (!schema) return <p className="text-sm text-red-300">No schema for {docId}.</p>;

  if (!draft || !base) {
    return (
      <section className="space-y-2">
        <h3 className="text-lg font-bold text-white">{label}</h3>
        {err ? (
          <>
            <p className="text-sm text-red-300">{err}</p>
            <button type="button" onClick={() => load()} className={`${BUTTON} bg-white/15 text-white`}>
              Retry
            </button>
          </>
        ) : (
          <p className="text-sm text-white/50">Loading…</p>
        )}
      </section>
    );
  }

  const hasErrors = errors.length > 0;
  const saveDisabled = !dirty || hasErrors || conflict || busy !== null;
  const source = base.source === 'draft' && base.updatedAt
    ? `Draft saved ${formatRunTime(base.updatedAt)}`
    : base.source === 'new' ? 'New: not saved yet' : 'Published version';

  return (
    <section className="space-y-3">
      <div className="sticky top-0 z-10 -mx-1 space-y-2 rounded-xl border border-white/10 bg-[rgb(10,5,25)]/95 px-3 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-bold text-white">{label}</h3>
          <span className="text-xs text-white/60">{source}</span>
          {dirty && <span className="rounded-full border border-amber-400/30 bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">Unsaved edits</span>}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {base.source === 'draft' && (
              <button type="button" onClick={discard} disabled={busy !== null} className={`${BUTTON} bg-white/15 text-white`}>
                Discard draft
              </button>
            )}
            <button type="button" onClick={save} disabled={saveDisabled} className={`${BUTTON} bg-emerald-500 text-black`}>
              {busy === 'save' ? 'Saving…' : 'Save draft'}
            </button>
          </div>
        </div>
        {blocked && !hasErrors && <p role="alert" className="text-xs text-red-300">{SAVE_BLOCKED_TEXT}</p>}
        {hasErrors && <p className="text-xs text-red-300">{plural(errors.length, 'error')}. Fix the errors to save.</p>}
        {!hasErrors && warnings.length > 0 && (
          <p className="text-xs text-amber-300">{plural(warnings.length, 'warning')}: saving is allowed.</p>
        )}
        {notice && <p className="text-xs text-emerald-300">{notice}</p>}
        {err && <p className="text-xs text-red-300 break-words">{err}</p>}
        {conflict && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <span>{CONFLICT_TEXT}</span>
            <button type="button" onClick={reloadLatest} disabled={busy !== null} className={`${BUTTON} bg-red-400 text-black`}>
              Reload
            </button>
          </div>
        )}
      </div>

      <div role="tablist" aria-label="Editor view" className="flex gap-1 xl:hidden">
        {(['edit', 'preview'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 text-sm font-semibold ${tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
          >
            {t === 'edit' ? 'Edit' : 'Preview'}
          </button>
        ))}
      </div>

      <div className="xl:grid xl:grid-cols-2 xl:items-start xl:gap-4">
        <div data-testid="form-panel" className={`${tab === 'edit' ? 'block' : 'hidden'} xl:block min-w-0`}>
          <SchemaForm schema={schema} value={draft.value} onChange={onChange} errors={errors} warnings={warnings} vars={vars} />
        </div>
        <div
          data-testid="preview-panel"
          className={`${tab === 'preview' ? 'block' : 'hidden'} xl:block min-w-0 xl:sticky xl:top-28 xl:max-h-[calc(100dvh-8rem)] xl:overflow-auto`}
        >
          <PreviewPane docId={docId} doc={shown} path={previewPath} />
        </div>
      </div>
    </section>
  );
}

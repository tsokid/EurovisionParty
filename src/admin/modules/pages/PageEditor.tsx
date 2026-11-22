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
//   duplicate). Warnings never block anything.
// - Autosave (CMS P3, src/admin/cms): every edit is buffered locally and
//   saved ~1.5 s after typing stops, or when a field loses focus. A draft
//   with errors is kept locally and not sent until it validates. The status
//   pill says where things stand; the other editor's presence and saves
//   show live (disjoint changes merge, the same field opens a dialog).
// - Discard draft: cms_discard, then back to the published version (the
//   draft stays in the history).

import FactTokensHelp from './FactTokensHelp';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { CMS_DOC_TYPES, docTypeFor } from '../../../../supabase/functions/_shared/cms/registry';
import { validateDocument, type ValidationError, type ValidationWarning } from '../../../../supabase/functions/_shared/cms/validate';
import { seoDuplicates } from '../../../../supabase/functions/_shared/cms/seo';
import { formatError } from '../../lib/formatError';
import { formatRunTime } from '../contests/publish';
import { cmsDiscard, cmsGet, cmsSave, fetchPublished, fetchPublishedEditorialIds, fetchPublishedPages, isConflict } from './cmsApi';
import { isEditorialDocId } from '../../../../supabase/functions/_shared/cms/pagesIndex';
import { emptyEditorialDoc } from './editorialPages';
import { SITE_PAGES } from './sitePages';
import { useContestContext } from './contestContext';
import { SchemaForm, type DocValue } from './form/SchemaForm';
import PreviewPane from './PreviewPane';
import { useDebounced } from './useDebounced';
import { useCmsDoc } from '../../cms/useCmsDoc';
import { CmsDocStatus } from '../../cms/CmsDocUi';
import type { RemoteDoc } from '../../cms/docSession';
import { AdminLink, ConfirmDialog, useToast } from '../../ui/kit';
import { adminPaths } from '../../paths';
import { t } from '../../i18n';

export const VALIDATE_DELAY_MS = 300;

type Tab = 'edit' | 'preview';

const NO_ERRORS: readonly ValidationError[] = [];
const NO_WARNINGS: readonly ValidationWarning[] = [];

/** Title/description collisions of `value` (as doc `docId`) with the other published pages. */
function seoErrors(docId: string, value: unknown, others: Record<string, unknown> | null): ValidationError[] {
  if (!others) return [];
  return seoDuplicates({ ...others, [docId]: value }, [docId]).map(({ locale, path, message }) => ({ locale, path, message }));
}

interface Props {
  docId: string;
  label: string;
  /** Editorial docs: the unprefixed public path of the page the preview shows; null while it is being looked up. */
  previewPath?: string | null;
  /** A draft was saved or discarded: refresh the list and the publish count. */
  onChanged: () => void;
  /** Test hook: the autosave debounce. */
  autosaveMs?: number;
}

/** The published editorial ids; [] when the index cannot be read (the SEO check then skips them; Publish checks again). */
const editorialIdsOrNone = () => fetchPublishedEditorialIds().catch(() => [] as string[]);

/** The base of a doc without a saved draft: the published file, or (an editorial doc never published) the empty doc. */
export async function pageBase(docId: string): Promise<{ value: DocValue; fresh: boolean }> {
  const fresh = isEditorialDocId(docId) && !(await fetchPublishedEditorialIds()).includes(docId);
  return { value: fresh ? emptyEditorialDoc() : await fetchPublished(docId), fresh };
}

/** The server's version of a page: the saved draft, else its base. */
export async function pageRemote(docId: string): Promise<RemoteDoc & { fresh: boolean }> {
  const row = await cmsGet(docId);
  if (row) return { value: row.data, updatedAt: row.updated_at, fresh: false };
  const base = await pageBase(docId);
  return { value: base.value, updatedAt: null, fresh: base.fresh };
}

export function PageEditor({ docId, label, previewPath, onChanged, autosaveMs }: Props) {
  const docType = docTypeFor(docId);
  const schema = CMS_DOC_TYPES[docType]?.schema;
  const { vars, context } = useContestContext();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('edit');
  const [fresh, setFresh] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardErr, setDiscardErr] = useState<string | null>(null);
  // The other site pages as published, for the cross-page SEO check.
  const [others, setOthers] = useState<Record<string, unknown> | null>(null);

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

  const checks = useRef({ context, others });
  checks.current = { context, others };

  const loadRemote = useCallback(async () => {
    const r = await pageRemote(docId);
    setFresh(r.fresh);
    return { value: r.value, updatedAt: r.updatedAt };
  }, [docId]);

  const doc = useCmsDoc({
    docId,
    loadRemote,
    save: (v, exp) => cmsSave(docId, docType, v as DocValue, exp),
    isConflictError: isConflict,
    validate: (v) => validateDocument(docType, v, checks.current.context).ok && seoErrors(docId, v, checks.current.others).length === 0,
    onSaved: onChanged,
    delayMs: autosaveMs,
  });

  const value = doc.value as DocValue | null;
  const shown = useDebounced(value, VALIDATE_DELAY_MS, doc.origin !== 'local');
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

  const onChange = useCallback((next: DocValue) => doc.edit(next), [doc]);

  const discard = async () => {
    setDiscarding(false);
    setDiscardErr(null);
    try {
      await cmsDiscard(docId);
      const base = await pageBase(docId);
      doc.reset({ value: base.value, updatedAt: null });
      setFresh(base.fresh);
      onChanged();
      toast.show(t.editor.discarded);
    } catch (e) {
      setDiscardErr(formatError(e));
    }
  };

  if (!schema) return <p className="text-sm text-stage-bad">{t.editor.noSchema(docId)}</p>;

  if (!doc.ready || !value) {
    return (
      <section className="space-y-2">
        <h3 className="text-lg font-bold text-stage-text">{label}</h3>
        {doc.loadError ? (
          <>
            <p className="text-sm text-stage-bad">{t.editor.loadError}: {doc.loadError}</p>
            <button type="button" onClick={doc.reload} className="btn btn-ghost btn-sm">{t.common.retry}</button>
          </>
        ) : (
          <p className="t-small">{t.common.loading}</p>
        )}
      </section>
    );
  }

  const hasErrors = errors.length > 0;
  const hasDraft = doc.baseUpdatedAt !== null;
  const source = hasDraft
    ? t.editor.sourceDraft(formatRunTime(doc.baseUpdatedAt!))
    : fresh ? t.editor.sourceNew : t.editor.sourcePublished;

  return (
    <section className="space-y-3" {...doc.rootProps}>
      <div className="sticky top-14 z-10 -mx-1 space-y-2 rounded-stage border border-stage-line bg-stage-bg/95 px-3 py-2.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="text-lg font-bold text-stage-text m-0">{label}</h3>
          <span className="t-meta">{source}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <AdminLink to={adminPaths.history(docId)} className="btn btn-ghost btn-sm">
              <History size={15} aria-hidden />{t.history.open}
            </AdminLink>
            {hasDraft && (
              <button type="button" onClick={() => setDiscarding(true)} className="btn btn-ghost btn-sm">
                {t.editor.discard}
              </button>
            )}
          </div>
        </div>
        <CmsDocStatus doc={doc} />
        {hasErrors && <p className="text-xs text-stage-bad m-0">{t.editor.errors(errors.length)}</p>}
        {!hasErrors && warnings.length > 0 && <p className="text-xs text-stage-gold m-0">{t.editor.warnings(warnings.length)}</p>}
        {discardErr && <p role="alert" className="text-xs text-stage-bad break-words m-0">{discardErr}</p>}
      </div>

      <FactTokensHelp />

      <div role="tablist" aria-label={t.editor.tabsLabel} className="flex gap-1 xl:hidden">
        {(['edit', 'preview'] as const).map((tb) => (
          <button
            key={tb}
            type="button"
            role="tab"
            aria-selected={tab === tb}
            onClick={() => setTab(tb)}
            className={`rounded-stage-sm px-3 py-1 text-sm font-semibold cursor-pointer ${tab === tb ? 'bg-stage-surface-2 text-stage-text' : 'text-stage-text-3 hover:text-stage-text'}`}
          >
            {tb === 'edit' ? t.common.edit : t.common.preview}
          </button>
        ))}
      </div>

      <div className="xl:grid xl:grid-cols-2 xl:items-start xl:gap-4">
        <div data-testid="form-panel" className={`${tab === 'edit' ? 'block' : 'hidden'} xl:block min-w-0`}>
          <SchemaForm schema={schema} value={value} onChange={onChange} errors={errors} warnings={warnings} vars={vars} />
        </div>
        <div
          data-testid="preview-panel"
          className={`${tab === 'preview' ? 'block' : 'hidden'} xl:block min-w-0 xl:sticky xl:top-44 xl:max-h-[calc(100dvh-12rem)] xl:overflow-auto`}
        >
          <PreviewPane docId={docId} doc={shown} path={previewPath} />
        </div>
      </div>

      <ConfirmDialog
        open={discarding}
        title={t.editor.discardTitle}
        confirmLabel={t.editor.discard}
        danger
        onCancel={() => setDiscarding(false)}
        onConfirm={() => { void discard(); }}
      >
        <p>{t.editor.discardText(label)}</p>
      </ConfirmDialog>
    </section>
  );
}

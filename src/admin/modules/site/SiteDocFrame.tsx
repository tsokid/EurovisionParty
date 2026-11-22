// The frame of a site-wide doc editor (header, footer, settings): title, where
// the doc stands, the editor, and a sticky bar with Discard and Publish.
// Publish saves what waits and opens the doc's publish screen (CMS P5): the
// diff, then the Vercel preview, then «Βγάλ' το live» (owner Q3 = C).
import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { History } from 'lucide-react';
import { AdminLink, ConfirmDialog, StatusChip } from '../../ui/kit';
import { CmsDocStatus } from '../../cms/CmsDocUi';
import { adminPaths } from '../../paths';
import { t } from '../../i18n';
import { outcomeText } from '../contests/publish';
import type { SiteDraft } from './useSiteDraft';
import PreviewPane from '../pages/PreviewPane';
import { useClickToEdit } from '../../preview/useClickToEdit';

const STATUS: Record<SiteDraft['status'], { tone: 'ok' | 'gold' | 'pink'; text: string }> = {
  live: { tone: 'ok', text: 'Ίδιο με το site' },
  draft: { tone: 'gold', text: 'Πρόχειρο, χωρίς δημοσίευση' },
  unsaved: { tone: 'pink', text: 'Μη αποθηκευμένες αλλαγές' },
};

/** The live preview beside a site-wide doc's form (P4): the home page with this doc's draft. */
export type SitePreview = {
  /** Scroll the preview to this doc once (the footer sits at the bottom of the page). */
  reveal?: boolean;
  /** A clicked field this screen does not show (another footer column): the URL of the screen that does. */
  screenFor?: (field: string) => string | null;
};

export function SiteDocFrame({ draft, title, lede, preview, children }: {
  draft: SiteDraft;
  title: string;
  lede: ReactNode;
  preview?: SitePreview;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const formRef = useRef<HTMLDivElement>(null);
  const click = useClickToEdit({
    docId: draft.docId,
    formRef,
    ready: !draft.loading,
    beforeFocus: () => setTab('edit'),
    screenFor: preview?.screenFor,
  });
  const navigate = useNavigate();
  const [discarding, setDiscarding] = useState(false);
  const status = STATUS[draft.status];
  const blocked = draft.errors.length > 0;
  const busy = draft.saving || draft.publishing;
  const canPublish = !busy && !blocked && draft.status !== 'live';

  return (
    <div className={`${preview ? 'max-w-[1600px]' : 'max-w-4xl'} pb-28`}>
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-bold text-stage-text m-0">{title}</h1>
          {!draft.loading && <StatusChip tone={status.tone}>{status.text}</StatusChip>}
          <AdminLink to={adminPaths.history(draft.docId)} className="btn btn-ghost btn-sm ml-auto">
            <History size={15} aria-hidden />{t.history.open}
          </AdminLink>
        </div>
        <p className="t-small mt-1.5 max-w-2xl">{lede}</p>
        {!draft.loading && <div className="mt-3"><CmsDocStatus doc={draft.cms} /></div>}
      </header>

      {draft.loadError && (
        <p className="card card-pad mb-4 text-sm text-stage-bad">
          Δεν φορτώθηκε το αποθηκευμένο πρόχειρο ({draft.loadError}). Βλέπεις την εκδοχή που είναι στο site.
        </p>
      )}

      {draft.loading ? (
        <p className="t-small">{t.common.loading}</p>
      ) : preview ? (
        <>
          <div role="tablist" aria-label={t.editor.tabsLabel} className="flex gap-1 mb-3 xl:hidden">
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
          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start xl:gap-4">
            <div ref={formRef} data-testid="form-panel" className={`${tab === 'edit' ? 'block' : 'hidden'} xl:block min-w-0`} {...draft.cms.rootProps}>
              {children}
            </div>
            <div data-testid="preview-panel" className={`${tab === 'preview' ? 'block' : 'hidden'} xl:block min-w-0 xl:sticky xl:top-20`}>
              <PreviewPane
                docId={draft.docId}
                doc={draft.doc}
                getLabels={click.getLabels}
                highlight={click.highlight}
                onFocusTarget={click.onFocusTarget}
                reveal={preview.reveal ? draft.docId : null}
              />
            </div>
          </div>
        </>
      ) : (
        <div {...draft.cms.rootProps}>{children}</div>
      )}

      <div className="fixed bottom-0 inset-x-0 lg:left-64 z-40 border-t border-stage-line bg-stage-bg/95 backdrop-blur">
        <div className="max-w-4xl px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2">
          <p className={`t-meta flex-1 basis-full sm:basis-auto min-w-[12rem] m-0 ${blocked || draft.saveError || draft.outcome ? '' : 'hidden sm:block'}`}>
            {blocked
              ? `Διόρθωσε ${draft.errors.length === 1 ? 'το σημείο' : `τα ${draft.errors.length} σημεία`} με κόκκινο για να γίνει δημοσίευση.`
              : draft.saveError ?? (draft.outcome ? outcomeText(draft.outcome) : 'Οι αλλαγές αποθηκεύονται μόνες τους ως πρόχειρο· το site αλλάζει μόνο με «Δημοσίευση».')}
          </p>
          {draft.status !== 'live' && (
            <button type="button" className="btn btn-ghost btn-sm max-sm:flex-1 max-sm:!px-2" disabled={busy} onClick={() => setDiscarding(true)}>
              Απόρριψη
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm max-sm:flex-1"
            disabled={!canPublish}
            onClick={() => { void draft.save().then((ok) => { if (ok) navigate(adminPaths.docPublish(draft.docId)); }); }}
          >
            {t.publishFlow.publishOne}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={discarding}
        title="Απόρριψη των αλλαγών;"
        confirmLabel="Απόρριψη"
        danger
        onCancel={() => setDiscarding(false)}
        onConfirm={() => { setDiscarding(false); void draft.discard(); }}
      >
        <p>Επιστρέφει στην εκδοχή που είναι τώρα στο site. Οι αλλαγές που δεν έχουν δημοσιευτεί χάνονται.</p>
      </ConfirmDialog>
    </div>
  );
}

/** A titled card section. */
export function Section({ title, hint, children, id }: { title: string; hint?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="card p-4 sm:p-5 mb-4 scroll-mt-20">
      <h2 className="t-h3 text-stage-text">{title}</h2>
      {hint && <p className="t-meta mt-1">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

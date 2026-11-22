// The frame of a site-wide doc editor (header, footer, settings): title, where
// the doc stands, the editor, and a sticky bar with Save and Publish. Publish
// first says plainly that the change reaches every page of the site.
import { useState, type ReactNode } from 'react';
import { Globe2 } from 'lucide-react';
import { ConfirmDialog, StatusChip } from '../../ui/kit';
import { outcomeText } from '../contests/publish';
import type { SiteDraft } from './useSiteDraft';
import { docLabel } from '../../siteStructure';

const STATUS: Record<SiteDraft['status'], { tone: 'ok' | 'gold' | 'pink'; text: string }> = {
  live: { tone: 'ok', text: 'Ίδιο με το site' },
  draft: { tone: 'gold', text: 'Πρόχειρο, χωρίς δημοσίευση' },
  unsaved: { tone: 'pink', text: 'Μη αποθηκευμένες αλλαγές' },
};

export function SiteDocFrame({ draft, title, lede, children }: { draft: SiteDraft; title: string; lede: ReactNode; children: ReactNode }) {
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const status = STATUS[draft.status];
  const blocked = draft.errors.length > 0;
  const busy = draft.saving || draft.publishing;
  const canPublish = !busy && !blocked && draft.status !== 'live';

  return (
    <div className="max-w-4xl pb-28">
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-bold text-stage-text m-0">{title}</h1>
          {!draft.loading && <StatusChip tone={status.tone}>{status.text}</StatusChip>}
        </div>
        <p className="t-small mt-1.5 max-w-2xl">{lede}</p>
      </header>

      {draft.loadError && (
        <p className="card card-pad mb-4 text-sm text-stage-bad">
          Δεν φορτώθηκε το αποθηκευμένο πρόχειρο ({draft.loadError}). Βλέπετε την εκδοχή που είναι στο site.
        </p>
      )}

      {draft.loading ? <p className="t-small">Φόρτωση…</p> : children}

      <div className="fixed bottom-0 inset-x-0 lg:left-64 z-40 border-t border-stage-line bg-stage-bg/95 backdrop-blur">
        <div className="max-w-4xl px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2">
          <p className={`t-meta flex-1 basis-full sm:basis-auto min-w-[12rem] m-0 ${blocked || draft.saveError || draft.outcome ? '' : 'hidden sm:block'}`}>
            {blocked
              ? `Διορθώστε ${draft.errors.length === 1 ? 'το σημείο' : `τα ${draft.errors.length} σημεία`} με κόκκινο για να γίνει δημοσίευση.`
              : draft.saveError ?? (draft.outcome ? outcomeText(draft.outcome) : 'Η αποθήκευση κρατά πρόχειρο· το site αλλάζει μόνο με «Δημοσίευση».')}
          </p>
          {draft.status !== 'live' && (
            <button type="button" className="btn btn-ghost btn-sm max-sm:flex-1 max-sm:!px-2" disabled={busy} onClick={() => setDiscarding(true)}>
              Απόρριψη
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm max-sm:flex-1" disabled={busy || !draft.dirty} onClick={() => { void draft.save(); }}>
            {draft.saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
          <button type="button" className="btn btn-primary btn-sm max-sm:flex-1" disabled={!canPublish} onClick={() => setConfirming(true)}>
            {draft.publishing ? 'Δημοσίευση…' : 'Δημοσίευση'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Δημοσίευση σε όλο το site;"
        confirmLabel="Δημοσίευση"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); void draft.publish(); }}
      >
        <p className="flex gap-2 items-start text-stage-text">
          <Globe2 size={18} aria-hidden className="shrink-0 mt-0.5 text-stage-gold" />
          <span>Επηρεάζει κάθε σελίδα του site, σε English και Ελληνικά.</span>
        </p>
        <p>Το site ενημερώνεται περίπου 2 λεπτά μετά.</p>
        {draft.otherDrafts.length > 0 && (
          <p>Μαζί δημοσιεύονται και οι αποθηκευμένες αλλαγές σε: {draft.otherDrafts.map(docLabel).join(', ')}.</p>
        )}
      </ConfirmDialog>

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

// The CMS documents with the state of each one's draft: never edited (no
// draft), a draft not yet published, or published. Site pages first, then the
// editorial docs of the data pages (Contest years, Countries, Live hub): the
// ones that exist, and "Add editorial for …" with the pages that have none.
import { useState, type ReactNode } from 'react';
import { formatRunTime } from '../contests/publish';
import type { CmsListRow } from './cmsApi';
import { pageState, SITE_PAGES, type PageState } from './sitePages';
import { EDITORIAL_GROUPS, type EditorialGroup, type EditorialTarget } from './editorialPages';
import { t } from '../../i18n';

const BADGE: Record<PageState, { text: string; className: string }> = {
  published: { text: t.pageList.state.published, className: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' },
  draft: { text: t.pageList.state.draft, className: 'bg-amber-500/20 text-amber-200 border-amber-400/30' },
  never: { text: t.pageList.state.never, className: 'bg-white/10 text-white/60 border-white/20' },
};

const BUTTON = 'px-2.5 py-1 rounded border border-white/15 text-white/80 text-xs cursor-pointer disabled:opacity-40';

/** The editorial docs and what can take one; null while loading. */
export type EditorialListing = {
  targets: EditorialTarget[];
  /** Editorial doc ids with a draft or a published file. */
  existing: ReadonlySet<string>;
};

interface Props {
  rows: CmsListRow[];
  onOpen: (docId: string) => void;
  editorial: EditorialListing | null;
  /** Why the editorial groups could not load (they are then not shown). */
  editorialError?: string | null;
  /** Creates the editorial draft of `docId` and opens it. */
  onAdd: (docId: string) => Promise<void>;
}

function Row({ docId, label, row, onOpen }: { docId: string; label: string; row: CmsListRow | undefined; onOpen: (docId: string) => void }) {
  const badge = BADGE[pageState(row)];
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="px-3 py-2 font-bold text-white">{label}</td>
      <td className="px-3 py-2 font-mono text-xs text-white/60">{docId}</td>
      <td className="px-3 py-2">
        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${badge.className}`}>{badge.text}</span>
      </td>
      <td className="px-3 py-2 text-white/60">{row ? formatRunTime(row.updated_at) : '—'}</td>
      <td className="px-3 py-2">
        <button type="button" onClick={() => onOpen(docId)} className={BUTTON}>
          {t.pageList.edit}
        </button>
      </td>
    </tr>
  );
}

function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
      <table className="w-full text-sm" aria-label={caption}>
        <thead>
          <tr className="text-left text-xs text-white/50 uppercase tracking-wide border-b border-white/10">
            <th className="px-3 py-2">{t.pageList.page}</th>
            <th className="px-3 py-2">{t.pageList.document}</th>
            <th className="px-3 py-2">{t.pageList.stateCol}</th>
            <th className="px-3 py-2">{t.pageList.savedCol}</th>
            <th className="px-3 py-2">{t.pageList.actions}</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function AddEditorial({ group, options, onAdd }: { group: EditorialGroup; options: EditorialTarget[]; onAdd: Props['onAdd'] }) {
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  if (!options.length) return null;
  const add = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      await onAdd(choice);
    } finally {
      setBusy(false);
    }
  };
  const label = t.pageList.addFor(group.noun);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={label}
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className="bg-[#1a0a2e] border border-white/15 text-white rounded px-2 py-1 text-sm"
      >
        <option value="" className="bg-[#1a0a2e]">{t.pageList.addPlaceholder}</option>
        {options.map((o) => (
          <option key={o.docId} value={o.docId} className="bg-[#1a0a2e]">{o.label}</option>
        ))}
      </select>
      <button type="button" onClick={add} disabled={!choice || busy} className={BUTTON}>
        {busy ? t.pageList.adding : t.pageList.add}
      </button>
    </div>
  );
}

export function PageList({ rows, onOpen, editorial, editorialError, onAdd }: Props) {
  const byId = new Map(rows.map((r) => [r.doc_id, r]));
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-white/60">{t.pageList.sitePages}</h3>
        <Table caption={t.pageList.sitePages}>
          {SITE_PAGES.map(({ docId, label }) => <Row key={docId} docId={docId} label={label} row={byId.get(docId)} onOpen={onOpen} />)}
        </Table>
      </section>

      {editorialError && <p className="text-sm text-red-300">{t.pageList.editorialError(editorialError)}</p>}
      {!editorial && !editorialError && <p className="text-sm text-white/50">{t.pageList.editorialLoading}</p>}

      {editorial && EDITORIAL_GROUPS.map((group) => {
        const targets = editorial.targets.filter((x) => x.family === group.family);
        const known = new Set(targets.map((x) => x.docId));
        // An existing doc whose year or country is no longer listed still shows (by its id).
        const strays = [...editorial.existing]
          .filter((id) => id.startsWith(`${group.family}-`) && !known.has(id))
          .sort()
          .map((docId) => ({ docId, family: group.family, label: docId, path: '' }));
        const shown = [...targets.filter((x) => editorial.existing.has(x.docId)), ...strays];
        const options = targets.filter((x) => !editorial.existing.has(x.docId));
        return (
          <section key={group.family} className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-white/60">{group.title}</h3>
            {shown.length > 0 ? (
              <Table caption={group.title}>
                {shown.map((x) => <Row key={x.docId} docId={x.docId} label={x.label} row={byId.get(x.docId)} onOpen={onOpen} />)}
              </Table>
            ) : (
              <p className="text-sm text-white/50">{t.pageList.noEditorial}</p>
            )}
            <AddEditorial group={group} options={options} onAdd={onAdd} />
          </section>
        );
      })}
    </div>
  );
}

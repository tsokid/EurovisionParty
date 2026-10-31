// The static site pages with the state of each one's draft: never edited
// (no draft), a draft not yet published, or published.
import { formatRunTime } from '../contests/publish';
import type { CmsListRow } from './cmsApi';
import { pageState, SITE_PAGES, type PageState } from './sitePages';

const BADGE: Record<PageState, { text: string; className: string }> = {
  published: { text: 'Published', className: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' },
  draft: { text: 'Draft (unpublished)', className: 'bg-amber-500/20 text-amber-200 border-amber-400/30' },
  never: { text: 'Never edited', className: 'bg-white/10 text-white/60 border-white/20' },
};

interface Props {
  rows: CmsListRow[];
  onOpen: (docId: string) => void;
}

export function PageList({ rows, onOpen }: Props) {
  const byId = new Map(rows.map((r) => [r.doc_id, r]));
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-white/50 uppercase tracking-wide border-b border-white/10">
            <th className="px-3 py-2">Page</th>
            <th className="px-3 py-2">Document</th>
            <th className="px-3 py-2">State</th>
            <th className="px-3 py-2">Draft saved</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {SITE_PAGES.map(({ docId, label }) => {
            const row = byId.get(docId);
            const badge = BADGE[pageState(row)];
            return (
              <tr key={docId} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-2 font-bold text-white">{label}</td>
                <td className="px-3 py-2 font-mono text-xs text-white/60">{docId}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${badge.className}`}>{badge.text}</span>
                </td>
                <td className="px-3 py-2 text-white/60">{row ? formatRunTime(row.updated_at) : '—'}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onOpen(docId)}
                    className="px-2.5 py-1 rounded border border-white/15 text-white/80 text-xs cursor-pointer"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

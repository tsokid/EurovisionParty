// "Editorial: none / text / text + image" for a contest year, next to the
// indexable switch (spec §5): what archive-{year} holds, from its draft when
// there is one, else from the published doc (content/pages/index.json says
// whether there is one). It only informs: `indexable` stays the owner's
// switch. The link opens the doc's editor in the Pages module.
import { useEffect, useState } from 'react';
import { formatError } from '../../lib/formatError';
import { useAdminNav } from '../../adminNav';
import { loadEditorialLevel, type EditorialLevel } from '../pages/editorialPages';
import { editorialDocId } from '../../../../supabase/functions/_shared/cms/pagesIndex';

/** The answer for one doc id (a year switch shows "…" until its own answer arrives). */
type Loaded = { docId: string; level: EditorialLevel | null; err: string | null };

export function EditorialIndicator({ year }: { year: number }) {
  const nav = useAdminNav();
  const docId = editorialDocId('archive', year);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let live = true;
    loadEditorialLevel(docId).then(
      (level) => { if (live) setLoaded({ docId, level, err: null }); },
      (e: unknown) => { if (live) setLoaded({ docId, level: null, err: formatError(e) }); },
    );
    return () => { live = false; };
  }, [docId]);

  const current = loaded?.docId === docId ? loaded : null;
  const level = current?.level ?? null;
  const err = current?.err ?? null;

  const text = err ? 'unknown' : level ?? '…';
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      <span
        data-testid="editorial-level"
        title={err ?? undefined}
        className={`rounded-full border px-2 py-0.5 ${level && level !== 'none' ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-200' : 'border-white/20 bg-white/10 text-white/70'}`}
      >
        Editorial: {text}
      </span>
      {nav && (
        <button type="button" onClick={() => nav.openDoc(docId)} className="text-sky-300 hover:underline cursor-pointer">
          {level === 'none' ? 'Add editorial' : 'Edit editorial'} →
        </button>
      )}
    </span>
  );
}

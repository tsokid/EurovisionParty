// The database size on the admin overview (28 Nov 2026, migration 110):
// read once when the overview opens, never polled. Free allows 500 MB,
// Pro 8 GB; the bar turns red from 70 % of the Free limit.
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { t } from '../../i18n';

const FREE_LIMIT = 500 * 1024 * 1024;

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export default function DbSize() {
  const [bytes, setBytes] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Any failure (no rights, offline) just hides the card.
    Promise.resolve()
      .then(() => supabase.rpc('admin_db_size'))
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || data == null) setFailed(true);
        else setBytes(Number(data));
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  if (failed) return null;
  const share = bytes === null ? 0 : Math.min(1, bytes / FREE_LIMIT);
  return (
    <section className="card card-pad" aria-labelledby="db-size-title">
      <h2 id="db-size-title" className="font-semibold text-stage-text m-0 text-base">{t.overview.dbSize.title}</h2>
      <p className="t-small mt-1">
        {bytes === null ? t.overview.dbSize.loading : t.overview.dbSize.value(formatMb(bytes))}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-stage-surface-2 overflow-hidden" aria-hidden="true">
        <div
          className={share >= 0.7 ? 'h-full bg-stage-bad' : 'h-full bg-stage-ok'}
          style={{ width: `${Math.max(2, Math.round(share * 100))}%` }}
        />
      </div>
      <p className="t-meta mt-1.5">{t.overview.dbSize.limits}</p>
    </section>
  );
}

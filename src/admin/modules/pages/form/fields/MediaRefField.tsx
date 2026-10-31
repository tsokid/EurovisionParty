// A media reference (mediaRef): the chosen file (an image's thumbnail through
// a signed URL; a video's or captions file's name and size) with "Choose…"
// (the media library: pick or upload) and "Clear". Locale-shared by default:
// one control writes both locales.
import { useState } from 'react';
import type { MediaKind } from '../../../../../../supabase/functions/_shared/cms/fields';
import { useFormApi, useIssues } from '../context';
import { editLocales, LOCALES, schemaInfo, setIn, type Issue, type Locale } from '../formModel';
import { draftId } from '../../media/mediaApi';
import { MediaPicker } from '../../media/MediaPicker';
import { formatBytes, KIND_LABEL } from '../../media/mediaFormat';
import { useMediaInfo } from '../../media/useMediaInfo';
import type { FieldProps } from './Field';
import { IssueList } from './IssueList';
import { FIELD_LABEL, HELP, SMALL_BUTTON } from './styles';

const PUBLISHED = /^\/media\/[0-9a-f]{12}\.(webp|mp4|vtt)$/;

export function MediaRefField({ schema, segments, path, name, label, en, el, hasEn, hasEl, shared, bare }: FieldProps) {
  const { edit } = useFormApi();
  const issues = useIssues(path);
  const { meta } = schemaInfo(schema);
  const kind = meta.mediaKind ?? 'image';
  const isShared = shared || !!meta.shared;
  const present = LOCALES.filter((l) => (l === 'en' ? hasEn : hasEl));
  const write = (locales: readonly Locale[], v: string) => edit((doc) => editLocales(doc, locales, (root) => setIn(root, segments, v)));

  return (
    <div className="space-y-1">
      {!bare && <div className={FIELD_LABEL}>{label}</div>}
      {meta.help && <p className={HELP}>{meta.help}</p>}
      {isShared ? (
        <MediaControl kind={kind} title={name} name={`${name} (EN + EL)`} tag="EN + EL" value={hasEn ? en : el} issues={issues} withLocale onValue={(v) => write(present, v)} />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {LOCALES.map((l) =>
            (l === 'en' ? hasEn : hasEl) ? (
              <MediaControl
                key={l}
                kind={kind}
                title={`${name} (${l.toUpperCase()})`}
                name={`${name} (${l.toUpperCase()})`}
                tag={l.toUpperCase()}
                value={l === 'en' ? en : el}
                issues={issues.filter((i) => i.locale === l)}
                onValue={(v) => write([l], v)}
              />
            ) : (
              <div key={l} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

type ControlProps = {
  kind: MediaKind;
  /** The thumbnail's accessible name (the field, without the locale tag). */
  title: string;
  /** Accessible name of the control, e.g. "Hero › Image (EN + EL)". */
  name: string;
  tag: string;
  value: unknown;
  issues: readonly Issue[];
  withLocale?: boolean;
  onValue: (v: string) => void;
};

function MediaControl({ kind, title, name, tag, value, issues, withLocale, onValue }: ControlProps) {
  const [picking, setPicking] = useState(false);
  const ref = typeof value === 'string' ? value : '';
  const id = draftId(ref);
  const info = useMediaInfo(id ? [id] : []);
  const row = id ? info.rows.get(id) : undefined;
  const variant = id ? info.variants.get(id) : undefined;
  const thumb = kind === 'image'
    ? (row ? info.urls[variant?.storage_path ?? ''] ?? info.urls[row.storage_path] : PUBLISHED.test(ref) ? ref : undefined)
    : undefined;
  const label = KIND_LABEL[kind];

  let body;
  if (!ref) {
    body = <span className="text-xs text-white/40">No {label} chosen</span>;
  } else if (id && row) {
    body = (
      <div className="flex min-w-0 items-center gap-3">
        {kind === 'image' && (thumb
          ? <img src={thumb} alt={title} width={row.width ?? undefined} height={row.height ?? undefined} className="h-16 w-28 shrink-0 rounded object-cover bg-black/40" />
          : <span className="h-16 w-28 shrink-0 rounded bg-black/40" />)}
        <div className="min-w-0 space-y-0.5">
          {kind !== 'image' && <div className="truncate font-mono text-xs text-white/80">{row.storage_path}</div>}
          <div className="text-[11px] text-white/40">
            {row.width && row.height ? `${row.width}×${row.height} · ` : ''}{formatBytes(row.bytes)}
          </div>
        </div>
      </div>
    );
  } else if (id) {
    body = info.ready
      ? <span className="text-xs text-red-300">{ref} is not in the media library (deleted?): choose another file</span>
      : <span className="text-xs text-white/40">Loading…</span>;
  } else if (PUBLISHED.test(ref)) {
    body = (
      <div className="flex min-w-0 items-center gap-3">
        {thumb && <img src={thumb} alt={title} className="h-16 w-28 shrink-0 rounded object-cover bg-black/40" />}
        <span className="truncate font-mono text-xs text-white/80">{ref} (published)</span>
      </div>
    );
  } else {
    body = <span className="truncate font-mono text-xs text-red-300">{ref} (not a media reference)</span>;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-[10px] font-bold text-white/40 w-10 shrink-0">{tag}</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded border border-white/15 bg-[#1a0a2e] px-2 py-1.5">
          <div className="min-w-0 flex-1">{body}</div>
          <div className="flex gap-1">
            <button type="button" aria-label={`Choose ${label} for ${name}`} onClick={() => setPicking(true)} className={SMALL_BUTTON}>Choose…</button>
            {ref && <button type="button" aria-label={`Clear ${name}`} onClick={() => onValue('')} className={`${SMALL_BUTTON} text-red-300`}>Clear</button>}
          </div>
        </div>
      </div>
      {info.error && <p className="text-xs text-red-300">Could not load the media library: {info.error}</p>}
      <IssueList issues={issues} withLocale={withLocale} />
      {picking && (
        <MediaPicker
          kind={kind}
          fieldName={name}
          onClose={() => setPicking(false)}
          onPick={(r) => {
            setPicking(false);
            onValue(r);
          }}
        />
      )}
    </div>
  );
}

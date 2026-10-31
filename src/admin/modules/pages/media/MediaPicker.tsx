// The media library dialog: pick an uploaded file of one kind (images as
// thumbnails through signed URLs) or upload a new one, which is then picked.
import { useEffect, useRef, useState } from 'react';
import type { MediaKind } from '../../../../../supabase/functions/_shared/cms/fields';
import { formatError } from '../../../lib/formatError';
import { draftRef, libraryRows, signedUrls, type MediaRow } from './mediaApi';
import { ACCEPT, uploadMedia } from './upload';
import { indexRows } from './useMediaInfo';
import { formatBytes, KIND_LABEL } from './mediaFormat';
import { SMALL_BUTTON } from '../form/fields/styles';

const UPLOAD_HELP: Record<MediaKind, string> = {
  image: 'Any image up to 15 MB: saved as WebP, 1600 and 800 px wide',
  video: 'MP4 (H.264) up to 20 MB; the poster image is chosen separately',
  captions: 'WebVTT (.vtt) up to 200 KB',
};

type Props = {
  kind: MediaKind;
  /** Accessible name of the field the file is for. */
  fieldName: string;
  onPick: (ref: string) => void;
  onClose: () => void;
};

type Library = { rows: MediaRow[]; thumbs: Record<string, string> };

export function MediaPicker({ kind, fieldName, onPick, onClose }: Props) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    let live = true;
    (async () => {
      const all = await libraryRows(true);
      const { variants } = indexRows(all);
      const rows = all.filter((r) => r.kind === kind && !r.variant_of);
      // Thumbnails: the 800 w copy of each image (the main file when it has none).
      const thumbPath = (r: MediaRow) => variants.get(r.id)?.storage_path ?? r.storage_path;
      const urls = kind === 'image' && rows.length ? await signedUrls(rows.map(thumbPath)) : {};
      const thumbs = Object.fromEntries(rows.map((r) => [r.id, urls[thumbPath(r)]]).filter(([, u]) => u));
      if (live) setLibrary({ rows, thumbs });
    })().catch((e) => {
      if (live) setLoadError(formatError(e));
    });
    return () => {
      live = false;
    };
  }, [kind]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      onPick(await uploadMedia(kind, file));
    } catch (e) {
      setUploadError(formatError(e));
      setUploading(false);
    }
  };

  const label = KIND_LABEL[kind];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`Choose ${label} for ${fieldName}`}
        tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-white/15 bg-[#1a0a2e] text-white shadow-xl outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold">Choose {label}</h2>
          <button type="button" onClick={onClose} className={SMALL_BUTTON}>Close</button>
        </div>
        <div className="space-y-2 border-b border-white/10 px-4 py-3">
          <label className={`${SMALL_BUTTON} inline-block ${uploading ? 'opacity-40 pointer-events-none' : ''}`}>
            {uploading ? 'Uploading…' : `Upload new ${label}`}
            <input
              type="file"
              accept={ACCEPT[kind]}
              disabled={uploading}
              aria-label={`Upload new ${label}`}
              className="sr-only"
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <p className="text-xs text-white/40">{UPLOAD_HELP[kind]}</p>
          {uploading && <p role="status" className="text-xs text-white/60">Uploading…</p>}
          {uploadError && <p role="alert" className="text-xs text-red-300">{uploadError}</p>}
        </div>
        <div className="overflow-auto p-4">
          {loadError && <p role="alert" className="text-sm text-red-300">Could not load the media library: {loadError}</p>}
          {!library && !loadError && <p className="text-sm text-white/50">Loading…</p>}
          {library && library.rows.length === 0 && <p className="text-sm text-white/50">No {label} uploaded yet.</p>}
          {library && library.rows.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {library.rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    aria-label={`Choose ${r.storage_path}`}
                    onClick={() => onPick(draftRef(r.id))}
                    className="flex w-full flex-col gap-1 rounded border border-white/10 p-2 text-left hover:border-white/40 hover:bg-white/5 cursor-pointer"
                  >
                    {kind === 'image' ? (
                      library.thumbs[r.id] ? (
                        <img src={library.thumbs[r.id]} alt="" width={r.width ?? undefined} height={r.height ?? undefined} loading="lazy" className="aspect-video w-full rounded object-cover bg-black/40" />
                      ) : (
                        <span className="flex aspect-video w-full items-center justify-center rounded bg-black/40 text-xs text-white/40">No preview</span>
                      )
                    ) : (
                      <span className="flex aspect-video w-full items-center justify-center rounded bg-black/40 font-mono text-xs text-white/60">
                        .{r.storage_path.split('.').pop()}
                      </span>
                    )}
                    <span className="truncate font-mono text-[11px] text-white/70">{r.storage_path}</span>
                    <span className="text-[11px] text-white/40">
                      {r.width && r.height ? `${r.width}×${r.height} · ` : ''}{formatBytes(r.bytes)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

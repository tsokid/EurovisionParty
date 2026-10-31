// The media library dialog: pick an uploaded file of one kind (images as
// thumbnails through signed URLs), upload a new one, which is then picked,
// or delete one (confirmed in its row; media_delete refuses while a draft
// uses it).
//
// While an upload runs the dialog cannot be closed (Escape, backdrop, Close);
// if it is unmounted anyway, the finished upload is not picked. Tab stays
// inside the dialog, and focus returns to the opener when it closes.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { MediaKind } from '../../../../../supabase/functions/_shared/cms/fields';
import { formatError } from '../../../lib/formatError';
import { draftRef, libraryRows, mediaDelete, signedUrls, type MediaRow } from './mediaApi';
import { ACCEPT, uploadMedia } from './upload';
import { indexRows } from './useMediaInfo';
import { formatBytes, KIND_LABEL } from './mediaFormat';
import { SMALL_BUTTON } from '../form/fields/styles';

const UPLOAD_HELP: Record<MediaKind, string> = {
  image: 'Any image up to 15 MB: saved as WebP, 1600 and 800 px wide',
  video: 'MP4 (H.264) up to 20 MB; the poster image is chosen separately',
  captions: 'WebVTT (.vtt) up to 200 KB',
};

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

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
  /** Bumped to reload the library (after a delete). */
  const [reload, setReload] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** The row whose delete awaits confirmation, and the row being deleted. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);

  // Focus the dialog on open; give focus back to the opener on close.
  useEffect(() => {
    mounted.current = true;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    return () => {
      mounted.current = false;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
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
  }, [kind, reload]);

  const close = () => {
    if (!uploading) onClose();
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const ref = await uploadMedia(kind, file);
      if (mounted.current) onPick(ref);
    } catch (e) {
      if (!mounted.current) return;
      setUploadError(formatError(e));
      setUploading(false);
    }
  };

  const remove = async (r: MediaRow) => {
    setConfirming(null);
    setDeleting(r.id);
    setDeleteError(null);
    try {
      await mediaDelete(r.id);
    } catch (e) {
      if (mounted.current) setDeleteError(`Could not delete ${r.storage_path}: ${formatError(e)}`);
    }
    if (!mounted.current) return;
    setDeleting(null);
    // Reload either way: a Storage failure comes after the rows are gone.
    setReload((n) => n + 1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const inside = !!active && items.includes(active);
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  };

  const label = KIND_LABEL[kind];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`Choose ${label} for ${fieldName}`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-white/15 bg-[#1a0a2e] text-white shadow-xl outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold">Choose {label}</h2>
          <button type="button" onClick={close} disabled={uploading} className={`${SMALL_BUTTON} disabled:opacity-40`}>Close</button>
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
          {uploading && <p role="status" className="text-xs text-white/60">Uploading… the dialog closes when it is done</p>}
          {uploadError && <p role="alert" className="text-xs text-red-300">{uploadError}</p>}
        </div>
        <div className="overflow-auto p-4">
          {loadError && <p role="alert" className="text-sm text-red-300">Could not load the media library: {loadError}</p>}
          {deleteError && <p role="alert" className="mb-3 text-sm text-red-300">{deleteError}</p>}
          {!library && !loadError && <p className="text-sm text-white/50">Loading…</p>}
          {library && library.rows.length === 0 && <p className="text-sm text-white/50">No {label} uploaded yet.</p>}
          {library && library.rows.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {library.rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-1">
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
                  {confirming === r.id ? (
                    <div className="space-y-1 rounded border border-red-400/40 p-2">
                      <p className="text-[11px] text-red-200">Delete this file? This cannot be undone.</p>
                      <div className="flex gap-1">
                        <button type="button" aria-label={`Confirm delete ${r.storage_path}`} onClick={() => void remove(r)} className={`${SMALL_BUTTON} text-red-300`}>Delete</button>
                        <button type="button" aria-label={`Cancel delete ${r.storage_path}`} onClick={() => setConfirming(null)} className={SMALL_BUTTON}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Delete ${r.storage_path}`}
                      disabled={deleting !== null || uploading}
                      onClick={() => {
                        setDeleteError(null);
                        setConfirming(r.id);
                      }}
                      className={`${SMALL_BUTTON} self-start text-red-300 disabled:opacity-40`}
                    >
                      {deleting === r.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

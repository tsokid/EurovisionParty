// Adding avatars: the dropped (or chosen) images, one card each. Every image
// is cropped square in the browser (drag to move, slider to zoom), previewed
// on the Stage circle at in-game and viewer size, titled (from the file name,
// editable) and then drawn to 96px and 512px WebP and uploaded.
import clsx from 'clsx';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Field, IconButton, Switch, TextInput } from '../../ui/kit';
import {
  ACCEPTED_TYPES, DEFAULT_CROP, MAX_SOURCE_BYTES, cropBackground, cropRect, isUpscale, panCrop, titleFromFilename,
  type Crop,
} from './avatarImage';

export interface PendingAvatar {
  key: string;
  file: File;
  url: string;
  width: number;
  height: number;
  image: HTMLImageElement;
  crop: Crop;
  title_en: string;
  title_el: string;
  error?: string;
}

let seq = 0;

/** Reads the files into pending avatars; refused files come back with their reason. */
export async function readFiles(files: Iterable<File>): Promise<{ ok: PendingAvatar[]; refused: string[] }> {
  const ok: PendingAvatar[] = [];
  const refused: string[] = [];
  for (const file of files) {
    if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) { refused.push(`${file.name}: δεν είναι εικόνα PNG, JPG, WebP, GIF ή AVIF`); continue; }
    if (file.size > MAX_SOURCE_BYTES) { refused.push(`${file.name}: πάνω από 15 MB`); continue; }
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('unreadable'));
        img.src = url;
      });
      const title = titleFromFilename(file.name);
      ok.push({ key: `p${++seq}`, file, url, image, width: image.naturalWidth, height: image.naturalHeight, crop: DEFAULT_CROP, title_en: title, title_el: '' });
    } catch {
      URL.revokeObjectURL(url);
      refused.push(`${file.name}: δεν διαβάζεται`);
    }
  }
  return { ok, refused };
}

/** A square crop of the image on the Stage circle. */
function CircleCrop({ p, size, className }: { p: PendingAvatar; size: number; className?: string }) {
  const bg = cropBackground(p.width, p.height, cropRect(p.width, p.height, p.crop));
  return (
    <span className={clsx('avatar-img block shrink-0', className)} style={{ width: size, height: size }} aria-hidden>
      <span
        className="block size-full rounded-full"
        style={{ backgroundImage: `url("${p.url}")`, backgroundSize: bg.size, backgroundPosition: bg.position, backgroundRepeat: 'no-repeat' }}
      />
    </span>
  );
}

const FRAME = 200;

function Cropper({ p, onCrop }: { p: PendingAvatar; onCrop: (c: Crop) => void }) {
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);
  const bg = cropBackground(p.width, p.height, cropRect(p.width, p.height, p.crop));
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, crop: p.crop };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    onCrop(panCrop(d.crop, p.width, p.height, e.clientX - d.x, e.clientY - d.y, FRAME));
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="img"
        aria-label="Περιοχή περικοπής: σύρε για μετακίνηση"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        className="relative rounded-stage border border-stage-line-2 cursor-move touch-none select-none overflow-hidden bg-stage-bg"
        style={{ width: FRAME, height: FRAME, backgroundImage: `url("${p.url}")`, backgroundSize: bg.size, backgroundPosition: bg.position, backgroundRepeat: 'no-repeat' }}
      >
        {/* The circle players see */}
        <span className="absolute inset-0 rounded-full ring-2 ring-white/70 pointer-events-none" style={{ boxShadow: '0 0 0 999px rgba(11,4,22,.55)' }} />
      </div>
      <label className="flex items-center gap-2 w-[200px] t-meta">
        Ζουμ
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={p.crop.zoom}
          onChange={(e) => onCrop({ ...p.crop, zoom: Number(e.target.value) })}
          className="flex-1 accent-[var(--color-stage-pink)]"
        />
      </label>
    </div>
  );
}

export function AddAvatarsDialog({
  items, onChange, onClose, onUpload, uploading, publishNow, setPublishNow, progress,
}: {
  items: PendingAvatar[];
  onChange: (items: PendingAvatar[]) => void;
  onClose: () => void;
  onUpload: () => void;
  uploading: boolean;
  publishNow: boolean;
  setPublishNow: (v: boolean) => void;
  progress: string | null;
}) {
  const [open, setOpen] = useState<string | null>(items[0]?.key ?? null);
  useEffect(() => {
    if (!items.some((i) => i.key === open)) setOpen(items[0]?.key ?? null);
  }, [items, open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !uploading) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, uploading]);

  const set = (key: string, patch: Partial<PendingAvatar>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const invalid = items.some((i) => !i.title_en.trim());
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={() => { if (!uploading) onClose(); }} />
      <div role="dialog" aria-modal="true" aria-label="Νέα avatars" className="card relative w-full sm:max-w-3xl max-h-[92vh] flex flex-col rounded-b-none sm:rounded-b-[var(--radius-stage-lg)]">
        <div className="flex items-center gap-2 p-4 border-b border-stage-line">
          <h2 className="t-h3 text-stage-text flex-1">
            {items.length === 1 ? 'Νέο avatar' : `${items.length} νέα avatars`}
          </h2>
          <IconButton label="Κλείσιμο" disabled={uploading} onClick={onClose}><X size={18} aria-hidden /></IconButton>
        </div>

        <ul className="overflow-y-auto p-3 sm:p-4 space-y-2 min-h-0">
          {items.map((p) => {
            const expanded = open === p.key;
            const small = isUpscale(p.width, p.height, p.crop);
            return (
              <li key={p.key} className="rounded-stage border border-stage-line bg-stage-bg-2">
                <div className="flex items-center gap-3 p-3">
                  <button type="button" onClick={() => setOpen(expanded ? null : p.key)} className="shrink-0 cursor-pointer" aria-expanded={expanded} aria-label={`Περικοπή: ${p.title_en}`}>
                    <CircleCrop p={p} size={56} />
                  </button>
                  <div className="min-w-0 flex-1 grid gap-2 sm:grid-cols-2">
                    <Field label="Τίτλος · English" error={p.title_en.trim() ? null : 'Γράψε έναν τίτλο'}>
                      <TextInput value={p.title_en} invalid={!p.title_en.trim()} onChange={(e) => set(p.key, { title_en: e.target.value })} maxLength={60} lang="en" />
                    </Field>
                    <Field label="Τίτλος · Ελληνικά" hint="Προαιρετικό· αλλιώς δείχνει τον αγγλικό">
                      <TextInput value={p.title_el} onChange={(e) => set(p.key, { title_el: e.target.value })} maxLength={60} lang="el" />
                    </Field>
                  </div>
                  <IconButton label="Αφαίρεση από τη λίστα" disabled={uploading} onClick={() => { URL.revokeObjectURL(p.url); onChange(items.filter((i) => i.key !== p.key)); }}>
                    <Trash2 size={16} aria-hidden />
                  </IconButton>
                </div>
                {expanded && (
                  <div className="border-t border-stage-line p-3 sm:p-4 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                    <Cropper p={p} onCrop={(crop) => set(p.key, { crop })} />
                    <div className="flex-1 min-w-0 space-y-3">
                      <p className="t-small m-0">Έτσι φαίνεται στο παιχνίδι:</p>
                      <div className="flex items-end gap-4 flex-wrap">
                        <figure className="m-0 flex flex-col items-center gap-1.5">
                          <CircleCrop p={p} size={160} />
                          <figcaption className="t-meta">Μεγάλη προβολή</figcaption>
                        </figure>
                        <figure className="m-0 flex flex-col items-center gap-1.5">
                          <CircleCrop p={p} size={48} />
                          <figcaption className="t-meta">Λίστα</figcaption>
                        </figure>
                        <figure className="m-0 flex flex-col items-center gap-1.5">
                          <CircleCrop p={p} size={28} />
                          <figcaption className="t-meta">Μικρό</figcaption>
                        </figure>
                      </div>
                      <p className="t-meta m-0">{p.width} × {p.height} px · {p.file.name}</p>
                      {small && (
                        <p className="flex items-start gap-1.5 text-[13px] text-stage-gold m-0">
                          <AlertTriangle size={15} aria-hidden className="shrink-0 mt-0.5" />
                          Η περιοχή είναι μικρότερη από 512 px· στη μεγάλη προβολή ίσως φαίνεται θολή.
                        </p>
                      )}
                      {p.error && <p className="text-[13px] text-stage-bad m-0">{p.error}</p>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="border-t border-stage-line p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-center gap-2.5 text-sm text-stage-text flex-1">
            <Switch checked={publishNow} onChange={setPublishNow} label="Δημοσίευση αμέσως" />
            Δημοσίευση αμέσως (εμφανίζονται στην επιλογή avatar)
          </label>
          {progress && <span className="t-meta" aria-live="polite">{progress}</span>}
          <button type="button" className="btn btn-primary btn-sm" disabled={uploading || invalid || items.length === 0} onClick={onUpload}>
            {uploading ? 'Ανέβασμα…' : items.length === 1 ? 'Προσθήκη' : `Προσθήκη ${items.length}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

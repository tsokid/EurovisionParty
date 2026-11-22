// /admin/game/avatars: the avatars players pick from (migration 089).
// A grid of cards (picture, title, status, how many players use it). Drop
// images anywhere on the screen to add them; the switch publishes or
// unpublishes at once (the picker reads the table live, no rebuild); drag to
// reorder; select several for Publish / Unpublish / Delete. Delete is soft,
// with an undo toast; deleted avatars wait under «Διαγραμμένα» and can be
// restored, or removed for good once nobody uses them (or after 30 days).
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, GripVertical, ImagePlus, RotateCcw, Trash2, Upload, Users } from 'lucide-react';
import { ConfirmDialog, IconButton, StatusChip, Switch, TextInput, moveItem, useDragReorder, useToast } from '../../ui/kit';
import { formatError } from '../../lib/formatError';
import {
  addAvatar, avatarUsage, canPurge, listAvatars, purgeAvatar, reorderAvatars, thumbUrl, updateAvatars,
  PURGE_AFTER_DAYS, type AdminAvatar, type AvatarStatus,
} from './avatarsApi';
import { AddAvatarsDialog, readFiles, type PendingAvatar } from './AddAvatars';
import { newAvatarId, renderAvatarFiles } from './avatarImage';

const people = (n: number) => (n === 1 ? '1 άτομο' : `${n} άτομα`);

type Confirm =
  | { kind: 'delete'; ids: string[] }
  | { kind: 'purge'; id: string }
  | null;

function TitleEditor({ a, onSave }: { a: AdminAvatar; onSave: (patch: { title_en: string; title_el: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [en, setEn] = useState(a.title_en);
  const [el, setEl] = useState(a.title_el);
  useEffect(() => { if (!editing) { setEn(a.title_en); setEl(a.title_el); } }, [a.title_en, a.title_el, editing]);
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="block w-full min-w-0 text-left rounded-stage-sm px-1 -mx-1 hover:bg-stage-surface-2 cursor-text" title="Αλλαγή τίτλου">
        <span className="block text-sm font-semibold text-stage-text truncate">{a.title_el || a.title_en}</span>
        {a.title_el && a.title_el !== a.title_en && <span className="block t-meta truncate">{a.title_en}</span>}
      </button>
    );
  }
  const done = () => {
    setEditing(false);
    if (en.trim() && (en !== a.title_en || el !== a.title_el)) onSave({ title_en: en.trim(), title_el: el.trim() });
  };
  return (
    <form className="space-y-1.5" onSubmit={(e) => { e.preventDefault(); done(); }}>
      <TextInput autoFocus value={en} onChange={(e) => setEn(e.target.value)} aria-label="Τίτλος · English" placeholder="English" invalid={!en.trim()} maxLength={60} className="!h-8 !text-sm" />
      <TextInput value={el} onChange={(e) => setEl(e.target.value)} aria-label="Τίτλος · Ελληνικά" placeholder="Ελληνικά (προαιρετικό)" maxLength={60} className="!h-8 !text-sm" />
      <div className="flex gap-1.5">
        <button type="submit" className="btn btn-secondary !min-h-8 !px-3 !text-[13px]" disabled={!en.trim()}>Αποθήκευση</button>
        <button type="button" className="btn btn-ghost !min-h-8 !px-3 !text-[13px]" onClick={() => setEditing(false)}>Ακύρωση</button>
      </div>
    </form>
  );
}

export default function AvatarsLibrary() {
  const toast = useToast();
  const [rows, setRows] = useState<AdminAvatar[] | null>(null);
  const [usage, setUsage] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [pending, setPending] = useState<PendingAvatar[]>([]);
  const [publishNow, setPublishNow] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [list, u] = await Promise.all([listAvatars(), avatarUsage()]);
      setRows(list);
      setUsage(u);
      setError(null);
    } catch (e) {
      setError(formatError(e));
      setRows((r) => r ?? []);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const live = useMemo(() => (rows ?? []).filter((r) => !r.deleted_at), [rows]);
  const deleted = useMemo(() => (rows ?? []).filter((r) => r.deleted_at), [rows]);
  const used = (id: string) => usage.get(id) ?? 0;
  const publishedCount = live.filter((r) => r.status === 'published').length;

  /** Applies a change locally, writes it, and puts it back if the write fails. */
  const write = async (next: (rs: AdminAvatar[]) => AdminAvatar[], op: () => Promise<void>, failText: string) => {
    const before = rows ?? [];
    setRows(next(before));
    try {
      await op();
    } catch (e) {
      setRows(before);
      toast.show(`${failText}: ${formatError(e)}`);
    }
  };

  const setStatus = (ids: string[], status: AvatarStatus) =>
    write((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, status } : r)), () => updateAvatars(ids, { status }), 'Δεν αποθηκεύτηκε');

  const setTitle = (id: string, patch: { title_en: string; title_el: string }) =>
    write((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)), () => updateAvatars([id], patch), 'Ο τίτλος δεν αποθηκεύτηκε');

  const softDelete = async (ids: string[]) => {
    const at = new Date().toISOString();
    await write((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, deleted_at: at } : r)), () => updateAvatars(ids, { deleted_at: at }), 'Δεν διαγράφηκε');
    setSelected(new Set());
    const name = ids.length === 1 ? `«${titleOf(ids[0])}»` : `${ids.length} avatars`;
    toast.show(`Διαγράφηκε: ${name}`, () => { void restore(ids); });
  };

  const restore = (ids: string[]) =>
    write((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, deleted_at: null } : r)), () => updateAvatars(ids, { deleted_at: null }), 'Δεν έγινε επαναφορά');

  const purge = (id: string) =>
    write((rs) => rs.filter((r) => r.id !== id), () => purgeAvatar(id), 'Δεν διαγράφηκε οριστικά');

  const titleOf = (id: string) => {
    const r = rows?.find((x) => x.id === id);
    return r ? r.title_el || r.title_en : id;
  };

  const onMove = (from: number, to: number) => {
    const order = moveItem(live, from, to);
    const ids = order.map((r) => r.id);
    void write(
      (rs) => [...order.map((r, i) => ({ ...r, sort: (i + 1) * 10 })), ...rs.filter((r) => r.deleted_at)],
      () => reorderAvatars(ids),
      'Η σειρά δεν αποθηκεύτηκε',
    );
  };
  const drag = useDragReorder(onMove);

  // ── Adding ──
  const take = async (files: FileList | File[] | null) => {
    if (!files || !files.length) return;
    const { ok, refused } = await readFiles(Array.from(files));
    if (refused.length) toast.show(refused.join(' · '));
    if (ok.length) setPending((p) => [...p, ...ok]);
  };

  const upload = async () => {
    setUploading(true);
    let sort = Math.max(0, ...(rows ?? []).map((r) => r.sort)) + 10;
    const done: AdminAvatar[] = [];
    const failed: PendingAvatar[] = [];
    for (const [i, p] of pending.entries()) {
      setProgress(`${i + 1} από ${pending.length}`);
      try {
        const files = await renderAvatarFiles(p.image, p.width, p.height, p.crop);
        done.push(await addAvatar({
          id: newAvatarId(), title_en: p.title_en.trim(), title_el: p.title_el.trim(),
          status: publishNow ? 'published' : 'unpublished', sort, ...files,
        }));
        sort += 10;
        URL.revokeObjectURL(p.url);
      } catch (e) {
        failed.push({ ...p, error: `Δεν ανέβηκε: ${formatError(e)}` });
      }
    }
    setRows((rs) => [...(rs ?? []), ...done]);
    setPending(failed);
    setUploading(false);
    setProgress(null);
    if (done.length) toast.show(done.length === 1 ? `Προστέθηκε: «${done[0].title_el || done[0].title_en}»` : `Προστέθηκαν ${done.length} avatars`);
  };

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const confirmIds = confirm?.kind === 'delete' ? confirm.ids : [];
  const confirmUsage = confirmIds.reduce((n, id) => n + used(id), 0);

  return (
    <div
      className="max-w-6xl pb-24 relative"
      onDragOver={(e) => { if (drag.dragging === null && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false); }}
      onDrop={(e) => {
        if (drag.dragging !== null || !e.dataTransfer.files.length) return;
        e.preventDefault();
        setDropping(false);
        void take(e.dataTransfer.files);
      }}
    >
      <header className="mb-5 flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[14rem]">
          <h1 className="text-2xl font-bold text-stage-text m-0">Avatars</h1>
          <p className="t-small mt-1.5 max-w-2xl">
            Οι εικόνες που διαλέγουν οι παίκτες. Οι αλλαγές φαίνονται αμέσως, χωρίς δημοσίευση του site.
            Σύρε εικόνες εδώ για προσθήκη, ή σύρε μια κάρτα για αλλαγή σειράς.
          </p>
          {rows && <p className="t-meta mt-1">{publishedCount} δημοσιευμένα από {live.length}</p>}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={16} aria-hidden />Προσθήκη avatars
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          hidden
          onChange={(e) => { void take(e.target.files); e.target.value = ''; }}
        />
      </header>

      {error && <p className="card card-pad mb-4 text-sm text-stage-bad">Δεν φορτώθηκαν τα avatars: {error}</p>}
      {!rows && <p className="t-small">Φόρτωση…</p>}

      {rows && live.length === 0 && !error && (
        <button type="button" onClick={() => fileRef.current?.click()} className="card w-full p-10 grid place-items-center gap-2 text-center border-dashed cursor-pointer">
          <Upload size={28} aria-hidden className="text-stage-text-3" />
          <span className="text-stage-text font-semibold">Σύρε εικόνες εδώ</span>
          <span className="t-meta">ή πάτα για επιλογή αρχείων</span>
        </button>
      )}

      <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {live.map((a, i) => {
          const on = selected.has(a.id);
          const pub = a.status === 'published';
          const n = used(a.id);
          return (
            <li
              key={a.id}
              {...drag.itemProps(i)}
              className={clsx(
                'card !rounded-stage p-3 flex flex-col gap-2 relative transition-colors',
                'data-[drop-target=true]:border-stage-pink data-[dragging=true]:opacity-40',
                on && '!border-stage-pink-2',
              )}
            >
              <div className="flex items-center justify-between -mt-1 -mx-1">
                <label className="inline-grid place-items-center size-9 cursor-pointer" title="Επιλογή">
                  <input type="checkbox" checked={on} onChange={() => toggle(a.id)} className="peer sr-only" aria-label={`Επιλογή: ${a.title_en}`} />
                  <span className={clsx('size-5 rounded-[6px] border grid place-items-center peer-focus-visible:outline-2 peer-focus-visible:outline-stage-pink-2', on ? 'bg-stage-pink border-stage-pink' : 'border-stage-line-2 bg-stage-bg')}>
                    {on && <Check size={14} aria-hidden className="text-white" />}
                  </span>
                </label>
                <span {...drag.handleProps(i)} className="hidden sm:grid place-items-center size-9 cursor-grab active:cursor-grabbing text-stage-text-3 hover:text-stage-text" title="Σύρε για αλλαγή σειράς" aria-hidden>
                  <GripVertical size={16} />
                </span>
              </div>
              <div className={clsx('mx-auto -mt-3', !pub && 'opacity-45 grayscale-[.6]')}>
                <img src={thumbUrl(a)} alt="" width={96} height={96} loading="lazy" className="avatar-img size-24" draggable={false} />
              </div>
              <TitleEditor a={a} onSave={(patch) => { void setTitle(a.id, patch); }} />
              <div className="flex items-center gap-2 flex-wrap">
                <StatusChip tone={pub ? 'ok' : 'muted'}>{pub ? 'Δημοσιευμένο' : 'Μη δημοσιευμένο'}</StatusChip>
              </div>
              <p className="t-meta m-0 flex items-center gap-1.5" title="Παίκτες σε δωμάτια που υπάρχουν">
                <Users size={13} aria-hidden />{n === 0 ? 'Δεν χρησιμοποιείται' : `Σε χρήση: ${people(n)}`}
              </p>
              <div className="mt-auto pt-1 flex items-center gap-1 border-t border-stage-line -mx-3 px-2 pt-2">
                <Switch checked={pub} onChange={(v) => { void setStatus([a.id], v ? 'published' : 'unpublished'); }} label={pub ? 'Απόσυρση από την επιλογή' : 'Δημοσίευση'} />
                <span className="flex-1" />
                <IconButton label="Μετακίνηση αριστερά" disabled={i === 0} onClick={() => onMove(i, i - 1)} className="sm:hidden"><ArrowLeft size={15} aria-hidden /></IconButton>
                <IconButton label="Μετακίνηση δεξιά" disabled={i === live.length - 1} onClick={() => onMove(i, i + 1)} className="sm:hidden"><ArrowRight size={15} aria-hidden /></IconButton>
                <IconButton label="Διαγραφή" className="hover:!text-stage-bad" onClick={() => setConfirm({ kind: 'delete', ids: [a.id] })}><Trash2 size={15} aria-hidden /></IconButton>
              </div>
            </li>
          );
        })}
      </ul>

      {deleted.length > 0 && (
        <section className="mt-8">
          <button type="button" onClick={() => setShowDeleted((v) => !v)} aria-expanded={showDeleted} className="flex items-center gap-2 text-sm font-semibold text-stage-text-2 hover:text-stage-text cursor-pointer">
            <ChevronRight size={16} aria-hidden className={clsx('transition-transform', showDeleted && 'rotate-90')} />
            Διαγραμμένα ({deleted.length})
          </button>
          {showDeleted && (
            <ul className="mt-3 space-y-2">
              {deleted.map((a) => {
                const n = used(a.id);
                const purgeable = canPurge(a, n);
                return (
                  <li key={a.id} className="card !rounded-stage p-2.5 flex items-center gap-3">
                    <img src={thumbUrl(a)} alt="" width={40} height={40} className="avatar-img size-10 opacity-50" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-stage-text truncate">{a.title_el || a.title_en}</span>
                      <span className="block t-meta">{n === 0 ? 'Δεν χρησιμοποιείται' : `Σε χρήση: ${people(n)}`}</span>
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void restore([a.id]); }}>
                      <RotateCcw size={15} aria-hidden />Επαναφορά
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!purgeable}
                      title={purgeable ? undefined : `Το χρησιμοποιούν ακόμα· οριστική διαγραφή ${PURGE_AFTER_DAYS} ημέρες μετά τη διαγραφή`}
                      onClick={() => setConfirm({ kind: 'purge', id: a.id })}
                    >
                      Οριστική διαγραφή
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 inset-x-4 lg:left-[calc(16rem+1rem)] z-40 flex justify-center pointer-events-none">
          <div className="pointer-events-auto card !rounded-stage-pill flex flex-wrap items-center gap-1.5 px-3 py-2 shadow-stage">
            <span className="text-sm font-semibold text-stage-text px-1">{selected.size} επιλεγμένα</span>
            <button type="button" className="btn btn-secondary !min-h-9 !px-3 !text-[13px]" onClick={() => { void setStatus([...selected], 'published'); setSelected(new Set()); }}>Δημοσίευση</button>
            <button type="button" className="btn btn-secondary !min-h-9 !px-3 !text-[13px]" onClick={() => { void setStatus([...selected], 'unpublished'); setSelected(new Set()); }}>Απόσυρση</button>
            <button type="button" className="btn btn-ghost !min-h-9 !px-3 !text-[13px] !text-stage-bad" onClick={() => setConfirm({ kind: 'delete', ids: [...selected] })}>Διαγραφή</button>
            <button type="button" className="btn btn-ghost !min-h-9 !px-3 !text-[13px]" onClick={() => setSelected(new Set())}>Ακύρωση</button>
          </div>
        </div>
      )}

      {dropping && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-stage-bg/80 backdrop-blur-sm pointer-events-none">
          <div className="card px-8 py-6 text-center border-dashed !border-stage-pink-2">
            <Upload size={28} aria-hidden className="mx-auto text-stage-pink-2" />
            <p className="text-stage-text font-semibold mt-2 mb-0">Άφησε τις εικόνες για προσθήκη</p>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <AddAvatarsDialog
          items={pending}
          onChange={setPending}
          onClose={() => { for (const p of pending) URL.revokeObjectURL(p.url); setPending([]); }}
          onUpload={() => { void upload(); }}
          uploading={uploading}
          publishNow={publishNow}
          setPublishNow={setPublishNow}
          progress={progress}
        />
      )}

      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title={confirmIds.length === 1 ? `Διαγραφή «${titleOf(confirmIds[0])}»;` : `Διαγραφή ${confirmIds.length} avatars;`}
        confirmLabel="Διαγραφή"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const ids = confirmIds; setConfirm(null); void softDelete(ids); }}
      >
        {confirmUsage > 0 ? (
          <p className="text-stage-text">
            {confirmIds.length === 1 ? 'Το έχουν' : 'Τα έχουν'} διαλέξει <b>{people(confirmUsage)}</b> σε δωμάτια που υπάρχουν.
            Στη θέση του θα βλέπουν τα αρχικά του ονόματός τους σε χρωματιστό κύκλο.
          </p>
        ) : (
          <p>Δεν {confirmIds.length === 1 ? 'το' : 'τα'} χρησιμοποιεί κανείς αυτή τη στιγμή.</p>
        )}
        <p>Βγαίνει αμέσως από την επιλογή avatar. Μπορείς να το επαναφέρεις από τα «Διαγραμμένα».</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === 'purge'}
        title="Οριστική διαγραφή;"
        confirmLabel="Οριστική διαγραφή"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const id = confirm?.kind === 'purge' ? confirm.id : ''; setConfirm(null); if (id) void purge(id); }}
      >
        <p>Το avatar και τα αρχεία του διαγράφονται για πάντα. Δεν γίνεται αναίρεση.</p>
      </ConfirmDialog>
    </div>
  );
}

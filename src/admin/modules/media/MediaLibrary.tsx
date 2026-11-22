// /admin/media and /admin/media/:id (CMS P6, spec §2 Media, §3, migration
// 088): the library of uploads and one file's page.
//
// - Library: every image, video and captions file (the 800 w copies are not
//   listed: they follow their image), filtered by kind or «Χωρίς alt»; an
//   image missing its alt text in a language says which. Upload from here.
// - A file: the alt text in English and Ελληνικά side by side with a counter
//   (about 125 characters is what screen readers handle well), a title for
//   the library, where it is used (saved drafts through media_usage, the
//   published pages by their /media/ path), and Save (media_set_meta).
//
// An image block whose own alt is empty uses this alt (the preview shows it,
// publish writes it), and the SEO panel blocks a publish with an image that
// has none in either place.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ImageIcon, Upload } from 'lucide-react';
import { formatError } from '../../lib/formatError';
import { libraryRows, mediaSetMeta, mediaUsage, signedUrls, type MediaRow } from '../pages/media/mediaApi';
import { indexRows } from '../pages/media/useMediaInfo';
import { formatBytes, KIND_LABEL } from '../pages/media/mediaFormat';
import { ACCEPT, uploadMedia } from '../pages/media/upload';
import { draftId } from '../pages/media/mediaApi';
import { fetchPublishedPages } from '../pages/cmsApi';
import { SITE_PAGES } from '../pages/sitePages';
import { docName, t } from '../../i18n';
import { adminPaths } from '../../paths';
import { StatusChip, useToast } from '../../ui/kit';

type Filter = 'all' | 'image' | 'video' | 'noAlt';

/** Recommended alt length: longer text is cut by some screen readers. */
export const ALT_SOFT_MAX = 125;

const LOCALES = ['en', 'el'] as const;

/** The languages an image's alt is missing in (none for other kinds). */
export function altMissing(r: Pick<MediaRow, 'kind' | 'alt'>): Array<'en' | 'el'> {
  if (r.kind !== 'image') return [];
  return LOCALES.filter((l) => !(r.alt?.[l] ?? '').trim());
}

type Library = { rows: MediaRow[]; thumbs: Record<string, string> };

async function loadLibrary(): Promise<Library> {
  const all = await libraryRows(true);
  const { variants } = indexRows(all);
  const rows = all.filter((r) => !r.variant_of);
  const thumbPath = (r: MediaRow) => variants.get(r.id)?.storage_path ?? r.storage_path;
  const images = rows.filter((r) => r.kind === 'image');
  const urls = images.length ? await signedUrls(images.map(thumbPath)) : {};
  return { rows, thumbs: Object.fromEntries(images.map((r) => [r.id, urls[thumbPath(r)]]).filter(([, u]) => u)) };
}

function Thumb({ row, src, className }: { row: MediaRow; src?: string; className: string }) {
  if (row.kind === 'image' && src) {
    return <img src={src} alt="" width={row.width ?? undefined} height={row.height ?? undefined} loading="lazy" className={`${className} object-cover bg-black/40`} />;
  }
  return (
    <span className={`${className} flex items-center justify-center bg-black/40 tabular-nums text-xs text-white/60`}>
      {row.kind === 'image' ? <ImageIcon size={20} aria-hidden /> : `.${row.storage_path.split('.').pop()}`}
    </span>
  );
}

const nameOf = (r: MediaRow) => r.title?.trim() || r.storage_path;

export function MediaLibrary() {
  const navigate = useNavigate();
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [uploading, setUploading] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    loadLibrary().then((l) => { if (live) setLib(l); }, (e) => { if (live) setError(formatError(e)); });
    return () => { live = false; };
  }, [reload]);

  const noAlt = lib?.rows.filter((r) => altMissing(r).length) ?? [];
  const shown = (lib?.rows ?? []).filter((r) => (filter === 'all' ? true : filter === 'noAlt' ? altMissing(r).length > 0 : r.kind === filter));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const ref = await uploadMedia('image', file);
      const id = draftId(ref);
      if (id) navigate(adminPaths.media(id));
      else setReload((n) => n + 1);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setUploading(false);
    }
  };

  const FILTERS: Array<[Filter, string]> = [['all', t.media.filterAll], ['image', t.media.filterImages], ['video', t.media.filterVideos], ['noAlt', t.media.filterNoAlt(noAlt.length)]];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-stage-text m-0">{t.media.title}</h1>
          <p className="t-small mt-1.5 max-w-2xl">{t.media.lede}</p>
        </div>
        <label className={`btn btn-primary btn-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload size={15} aria-hidden />{uploading ? t.media2.uploading : t.media.upload}
          <input type="file" accept={ACCEPT.image} className="sr-only" aria-label={t.media.upload} disabled={uploading}
            onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </header>

      {noAlt.length > 0 && (
        <p role="status" className="rounded-stage-sm border border-stage-bad/40 bg-stage-bad/10 px-3 py-2 text-sm text-stage-text m-0">
          {t.media.noAltBanner(noAlt.length)}
        </p>
      )}

      <div role="group" aria-label={t.media.filterLabel} className="flex flex-wrap gap-1">
        {FILTERS.map(([f, label]) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={`rounded-stage-pill border px-3 py-1 text-sm cursor-pointer ${filter === f ? 'border-stage-pink bg-stage-surface-2 text-stage-text' : 'border-stage-line text-stage-text-3 hover:text-stage-text'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-stage-bad">{t.media2.loadError(error)}</p>}
      {!lib && !error && <p className="t-small">{t.common.loading}</p>}
      {lib && shown.length === 0 && <p className="t-small">{filter === 'noAlt' ? t.media.allHaveAlt : t.media.empty}</p>}
      {lib && shown.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="media-grid">
          {shown.map((r) => {
            const missing = altMissing(r);
            return (
              <li key={r.id}>
                <Link to={adminPaths.media(r.id)} className="card block h-full overflow-hidden hover:border-stage-line-2 transition-colors">
                  <Thumb row={r} src={lib.thumbs[r.id]} className="aspect-video w-full" />
                  <span className="block space-y-1 p-2">
                    <span className="block truncate text-sm font-semibold text-stage-text">{nameOf(r)}</span>
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="t-meta">{KIND_LABEL[r.kind]} · {formatBytes(r.bytes)}</span>
                      {r.kind === 'image' && (missing.length
                        ? <StatusChip tone="bad">{t.media.altMissing(missing.map((l) => l.toUpperCase()).join(' · '))}</StatusChip>
                        : <StatusChip tone="ok">{t.media.altOk}</StatusChip>)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The docs that use a file: saved drafts (media_usage) and published pages (their /media/ path). */
async function usageOf(row: MediaRow): Promise<{ drafts: string[]; published: string[] }> {
  const [drafts, pages] = await Promise.all([
    mediaUsage(row.id).catch(() => [] as string[]),
    row.published_path ? fetchPublishedPages(SITE_PAGES.map((p) => p.docId)) : Promise.resolve({} as Record<string, unknown>),
  ]);
  const path = row.published_path;
  const published = path ? Object.entries(pages).filter(([, doc]) => JSON.stringify(doc).includes(`"${path}"`)).map(([id]) => id).sort() : [];
  return { drafts, published };
}

export function MediaAsset({ id }: { id: string }) {
  const toast = useToast();
  const [row, setRow] = useState<MediaRow | null | undefined>(undefined);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alt, setAlt] = useState<{ en: string; el: string }>({ en: '', el: '' });
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ drafts: string[]; published: string[] } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const all = await libraryRows(true);
      const r = all.find((x) => x.id === id && !x.variant_of) ?? null;
      if (!live) return;
      setRow(r);
      if (!r) return;
      setAlt({ en: r.alt?.en ?? '', el: r.alt?.el ?? '' });
      setTitle(r.title ?? '');
      const { variants } = indexRows(all);
      if (r.kind === 'image') {
        const path = variants.get(r.id)?.storage_path ?? r.storage_path;
        const urls = await signedUrls([path]);
        if (live) setSrc(urls[path] ?? null);
      }
      const u = await usageOf(r);
      if (live) setUsage(u);
    })().catch((e) => { if (live) setError(formatError(e)); });
    return () => { live = false; };
  }, [id]);

  const dirty = useMemo(() => !!row && ((row.alt?.en ?? '') !== alt.en || (row.alt?.el ?? '') !== alt.el || (row.title ?? '') !== title), [row, alt, title]);

  if (error) return <p role="alert" className="text-sm text-stage-bad">{t.media2.loadError(error)}</p>;
  if (row === undefined) return <p className="t-small">{t.common.loading}</p>;
  if (row === null) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-stage-text">{t.media.notFound}</p>
        <Link to={adminPaths.media()} className="text-stage-pink-2 hover:underline text-sm">{t.media.back}</Link>
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const next = await mediaSetMeta(row.id, alt, title);
      setRow(next);
      toast.show(t.media.saved);
    } catch (e) {
      setSaveError(formatError(e));
    } finally {
      setSaving(false);
    }
  };

  const missing = row.kind === 'image' ? LOCALES.filter((l) => !alt[l].trim()) : [];

  return (
    <div className="space-y-5 max-w-5xl">
      <header className="space-y-1">
        <Link to={adminPaths.media()} className="text-stage-pink-2 hover:underline text-sm">← {t.media.back}</Link>
        <h1 className="text-2xl font-bold text-stage-text m-0 break-all">{nameOf(row)}</h1>
        <p className="t-meta m-0">
          {KIND_LABEL[row.kind]} · {formatBytes(row.bytes)}{row.width && row.height ? ` · ${row.width}×${row.height}` : ''} · {row.published_path ?? t.media.notPublished}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          {row.kind === 'image' && src
            ? <img src={src} alt={alt.en || alt.el || ''} className="w-full rounded-stage border border-stage-line bg-black/40 object-contain" />
            : <Thumb row={row} className="aspect-video w-full rounded-stage" />}
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          {row.kind === 'image' && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-stage-text">{t.media.altTitle}</legend>
              <p className="t-small m-0">{t.media.altHelp}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {LOCALES.map((l) => {
                  const n = alt[l].length;
                  const tag = l.toUpperCase();
                  return (
                    <label key={l} className="block space-y-1">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-stage-text-3">
                        {l === 'en' ? 'English' : 'Ελληνικά'}
                        {!alt[l].trim() && (
                          <span className="inline-block size-2 rounded-full bg-stage-bad" title={t.translations.missingIn(tag)} data-testid="missing-dot">
                            <span className="sr-only">{t.translations.missingIn(tag)}</span>
                          </span>
                        )}
                      </span>
                      <textarea
                        aria-label={t.media.altFor(tag)}
                        lang={l}
                        rows={3}
                        maxLength={300}
                        value={alt[l]}
                        onChange={(e) => { const v = e.target.value; setAlt((a) => ({ ...a, [l]: v })); }}
                        className="w-full rounded-stage-sm border border-stage-line bg-stage-bg-2 px-2.5 py-2 text-sm text-stage-text"
                      />
                      <span className={`block text-[11px] ${n > ALT_SOFT_MAX ? 'text-stage-gold' : 'text-stage-text-3'}`}>
                        {n} / {ALT_SOFT_MAX}{n > ALT_SOFT_MAX ? ` · ${t.media.altLong}` : ''}
                      </span>
                    </label>
                  );
                })}
              </div>
              {missing.length > 0 && <p className="text-xs text-stage-bad m-0">{t.media.altMissingHelp(missing.map((l) => l.toUpperCase()).join(', '))}</p>}
            </fieldset>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-bold text-stage-text-3">{t.media.titleLabel}</span>
            <input
              type="text"
              aria-label={t.media.titleLabel}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-stage-sm border border-stage-line bg-stage-bg-2 px-2.5 py-2 text-sm text-stage-text"
            />
            <span className="block text-[11px] text-stage-text-3">{t.media.titleHelp}</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={!dirty || saving} className="btn btn-primary btn-sm">{saving ? t.media.saving : t.media.save}</button>
            {saveError && <p role="alert" className="text-xs text-stage-bad m-0">{saveError}</p>}
          </div>

          <section className="space-y-1">
            <h2 className="text-sm font-semibold text-stage-text m-0">{t.media.usage}</h2>
            {!usage && <p className="t-small m-0">{t.common.loading}</p>}
            {usage && !usage.drafts.length && !usage.published.length && <p className="t-small m-0">{t.media.unused}</p>}
            {usage && (usage.drafts.length > 0 || usage.published.length > 0) && (
              <ul className="space-y-1 text-sm" data-testid="media-usage">
                {[...new Set([...usage.drafts, ...usage.published])].sort().map((doc) => (
                  <li key={doc} className="flex flex-wrap items-center gap-2">
                    <Link to={adminPaths.pages(doc)} className="text-stage-pink-2 hover:underline">{docName(doc, doc)}</Link>
                    {usage.published.includes(doc) && <StatusChip tone="ok">{t.media.usedLive}</StatusChip>}
                    {usage.drafts.includes(doc) && <StatusChip tone="gold">{t.media.usedDraft}</StatusChip>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </form>
      </div>
    </div>
  );
}

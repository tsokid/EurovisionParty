// The library rows and signed URLs behind a set of draft media ids, for the
// form widgets (thumbnails, file names) and the preview resolver.
import { useEffect, useMemo, useState } from 'react';
import { formatError } from '../../../lib/formatError';
import { libraryRows, signedUrls, type MediaRow } from './mediaApi';

export type MediaInfo = {
  /** Every library row by id (variants included). */
  rows: ReadonlyMap<string, MediaRow>;
  /** The 800 w variant of an image, by its parent id. */
  variants: ReadonlyMap<string, MediaRow>;
  /** Signed URL by storage_path, for the requested ids and their variants. */
  urls: Readonly<Record<string, string>>;
  error: string | null;
  /** The library has loaded (or failed) for the requested ids. */
  ready: boolean;
};

const EMPTY: MediaInfo = { rows: new Map(), variants: new Map(), urls: {}, error: null, ready: false };

export function indexRows(list: readonly MediaRow[]): Pick<MediaInfo, 'rows' | 'variants'> {
  const rows = new Map<string, MediaRow>();
  const variants = new Map<string, MediaRow>();
  for (const r of list) {
    rows.set(r.id, r);
    if (r.variant_of) variants.set(r.variant_of, r);
  }
  return { rows, variants };
}

/** Rows and signed URLs of `ids` (draft media ids); refetches the library once if one is not in it yet. */
export function useMediaInfo(ids: readonly string[]): MediaInfo {
  const key = [...ids].sort().join(',');
  // The info and the ids it was loaded for: while new ids load, the old rows stay but are not ready.
  const [state, setState] = useState<{ key: string; info: MediaInfo }>({ key: '', info: EMPTY });

  useEffect(() => {
    if (!key) return;
    let live = true;
    const setInfo = (info: MediaInfo) => setState({ key, info });
    const want = key.split(',');
    (async () => {
      let list = await libraryRows();
      if (want.some((id) => !list.some((r) => r.id === id))) list = await libraryRows(true);
      const index = indexRows(list);
      const paths = want.flatMap((id) => [index.rows.get(id)?.storage_path, index.variants.get(id)?.storage_path])
        .filter((p): p is string => !!p);
      const urls = paths.length ? await signedUrls(paths) : {};
      if (live) setInfo({ ...index, urls, error: null, ready: true });
    })().catch((e) => {
      if (live) setInfo({ ...EMPTY, error: formatError(e), ready: true });
    });
    return () => {
      live = false;
    };
  }, [key]);

  return useMemo(() => {
    if (!key) return EMPTY;
    return state.key === key ? state.info : { ...state.info, ready: false };
  }, [key, state]);
}

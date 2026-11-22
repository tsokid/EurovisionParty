// The unsent-draft buffer: every edit to a CMS document is written to
// localStorage (one key per doc) before the debounced autosave sends it, and
// cleared once the server holds it. After a crash, a reload or a lost
// connection the editor finds it and restores the edits, so typing is never
// lost. Storage can be missing or full (private windows, quota): every
// access is guarded, and the editor works without it.

const PREFIX = 'cms:unsent:';

export type BufferedDraft = {
  /** The edited document. */
  value: unknown;
  /** The server value the edits started from, when it fit in storage. */
  base?: unknown;
  /** The draft's updated_at the edits started from (null: no saved draft yet). */
  baseUpdatedAt: string | null;
  /** When the buffer was written (ms). */
  at: number;
};

export interface DraftStore {
  read(docId: string): BufferedDraft | null;
  write(docId: string, draft: BufferedDraft): void;
  clear(docId: string): void;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const localDraftStore: DraftStore = {
  read(docId) {
    try {
      const raw = storage()?.getItem(PREFIX + docId);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as BufferedDraft;
      return parsed && typeof parsed === 'object' && 'value' in parsed ? parsed : null;
    } catch {
      return null;
    }
  },
  write(docId, draft) {
    const s = storage();
    if (!s) return;
    try {
      s.setItem(PREFIX + docId, JSON.stringify(draft));
    } catch {
      // Full: keep at least the edits, without the base.
      try {
        s.setItem(PREFIX + docId, JSON.stringify({ ...draft, base: undefined }));
      } catch {
        /* storage unavailable: the autosave still runs */
      }
    }
  },
  clear(docId) {
    try {
      storage()?.removeItem(PREFIX + docId);
    } catch {
      /* ignore */
    }
  },
};

/** An in-memory store (tests, and when the editor must not touch storage). */
export function memoryDraftStore(): DraftStore & { data: Map<string, BufferedDraft> } {
  const data = new Map<string, BufferedDraft>();
  return {
    data,
    read: (id) => (data.has(id) ? structuredClone(data.get(id)!) : null),
    write: (id, d) => { data.set(id, structuredClone(d)); },
    clear: (id) => { data.delete(id); },
  };
}

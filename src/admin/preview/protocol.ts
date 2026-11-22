// The click-to-edit bridge between an editor and its preview (Track 3 §5,
// Storyblok-style). The preview is a same-origin iframe at
// /admin/preview/:docId/:locale; the editor (host) and the iframe (frame)
// talk with window.postMessage. Every message carries the namespace and the
// protocol version, is posted to our own origin only, and is accepted only
// from our own origin and from the expected window.
//
// host → frame
//   state      the draft as edited (debounced), the locale, the editorial
//              page path, the form's field labels and the doc ids the frame
//              may outline; `docType` is checked against the frame's docId
//   highlight  outline the element of a data-cms-path value (a field got focus)
//   reveal     scroll to the first element of a doc (the footer editor)
//   (state, diff mode, CMS P5) `changed` tints the nodes of those
//              data-cms-path values (and their children) in `tone`; `overlays`
//              replaces the saved header/footer drafts the frame loaded (the
//              live side and a one-page publish show none)
// frame → host
//   ready      the frame mounted: send the state
//   focus      an element was clicked: focus its field (data-cms-path value)
//   tagged     how many elements carry a data-cms-path (diagnostics, tests)
//   tinted     how many elements the diff tinted
//
// The transport is a Port, so tests (and the inline preview) can run both
// ends in one document with memoryPorts().
import type { Locale } from '../../lib/seo/locale';
import type { DraftDoc } from '../../../supabase/functions/_shared/cms/overlay';

export const PREVIEW_NS = 'cms-preview';
export const PREVIEW_PROTOCOL = 1;

export type HostMessage =
  | {
      type: 'state';
      docId: string;
      docType: string;
      locale: Locale;
      /** The draft `{ en, el }` as edited (not necessarily valid). */
      doc: unknown;
      /** Editorial docs: the data page to show (unprefixed); null while it is looked up. */
      path?: string | null;
      /** `en.hero.title` -> "Hero › Title (EN)": the form's own labels. */
      labels: Record<string, string>;
      /** Doc ids whose elements are outlined and clickable. */
      editable: string[];
      /** Scroll once to the first element of this doc (the footer editor). */
      reveal?: string | null;
      /** Diff mode: tint the nodes of these data-cms-path values. */
      changed?: string[];
      /** The tint: the live page (old) or the draft (new). */
      tone?: 'live' | 'draft';
      /** The other docs' drafts to overlay instead of the saved ones ([] = the published header and footer). */
      overlays?: DraftDoc[];
    }
  | { type: 'highlight'; target: string | null };

export type FrameMessage =
  | { type: 'ready' }
  | { type: 'focus'; target: string }
  | { type: 'tagged'; count: number }
  | { type: 'tinted'; count: number };

type Envelope = { ns: typeof PREVIEW_NS; v: number };

export interface Port<In, Out> {
  post(msg: Out): void;
  /** Returns the unsubscribe. */
  listen(fn: (msg: In) => void): () => void;
}

export type HostPort = Port<FrameMessage, HostMessage>;
export type FramePort = Port<HostMessage, FrameMessage>;

function isEnvelope(data: unknown): data is Envelope & { type: string } {
  const d = data as Partial<Envelope> & { type?: unknown } | null;
  return !!d && typeof d === 'object' && d.ns === PREVIEW_NS && d.v === PREVIEW_PROTOCOL && typeof d.type === 'string';
}

/**
 * A port over window.postMessage. `self` receives; `peer()` is the window it
 * talks to (the iframe's contentWindow, or window.parent). Messages from any
 * other window or origin, or of another protocol version, are ignored.
 */
export function windowPort<In, Out>(self: Window, peer: () => Window | null): Port<In, Out> {
  const origin = self.location.origin;
  return {
    post(msg) {
      const target = peer();
      if (target && target !== self) target.postMessage({ ns: PREVIEW_NS, v: PREVIEW_PROTOCOL, ...msg }, origin);
    },
    listen(fn) {
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== origin || !e.source || e.source !== peer()) return;
        if (!isEnvelope(e.data)) return;
        const { ns: _ns, v: _v, ...msg } = e.data;
        void _ns;
        void _v;
        fn(msg as In);
      };
      self.addEventListener('message', onMessage);
      return () => self.removeEventListener('message', onMessage);
    },
  };
}

/** Two connected in-memory ports (host, frame): the inline preview and tests. Delivery is async, like postMessage. */
export function memoryPorts(): { host: HostPort; frame: FramePort } {
  const toHost = new Set<(m: FrameMessage) => void>();
  const toFrame = new Set<(m: HostMessage) => void>();
  const deliver = <M,>(subs: Set<(m: M) => void>, msg: M) => {
    const copy = structuredCloneSafe(msg);
    queueMicrotask(() => subs.forEach((fn) => fn(copy)));
  };
  return {
    host: { post: (m) => deliver(toFrame, m), listen: (fn) => { toHost.add(fn); return () => { toHost.delete(fn); }; } },
    frame: { post: (m) => deliver(toHost, m), listen: (fn) => { toFrame.add(fn); return () => { toFrame.delete(fn); }; } },
  };
}

/** A copy, as postMessage makes one (structuredClone where the runtime has it). */
function structuredCloneSafe<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);
}

/** `en.hero.title` (a form field) <-> `faq:en:hero.title` (a data-cms-path value). */
export const fieldOfTarget = (target: { locale: string; path: string }): string => `${target.locale}.${target.path}`;

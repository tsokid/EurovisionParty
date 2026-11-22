/**
 * The editor's preview (Track 3 §5): the real page in a same-origin iframe
 * (/admin/preview/:docId/:locale), fed the draft as it is typed.
 *
 * - Live: the draft goes to the frame over the bridge (protocol.ts), about
 *   120 ms after the last change; the frame renders it through the public
 *   components (PreviewDocument.tsx).
 * - EN / EL: the language of the preview. Focusing a field of the other
 *   language switches it, so the outlined element is the one being edited.
 * - Viewports: Κινητό 390, Tablet 768, Desktop 1440. The page is laid out at
 *   that width and scaled down to fit the pane. The choice is remembered per
 *   person, in this browser.
 * - Click-to-edit: a click on the page focuses its field (`onFocusTarget`);
 *   the field in focus is outlined on the page (`highlight`).
 */
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import type { Locale } from '../../../lib/seo/locale';
import { cmsPathValue, parseCmsPath } from '../../../lib/cms/cmsAttrs';
import { docTypeFor } from '../../../../supabase/functions/_shared/cms/registry';
import { windowPort, type FrameMessage, type HostMessage, type HostPort } from '../../preview/protocol';
import { InlinePreviewFrame, usePreviewTransport } from '../../preview/transport';
import { AdminUserContext } from '../../cms/docChannel';
import { useDebounced } from './useDebounced';
import type { DomAudit } from '../../seo/domAudit';
import { t } from '../../i18n';

const LOCALES: Locale[] = ['en', 'el'];

export const VIEWPORTS = [
  { id: 'mobile', width: 390, icon: Smartphone },
  { id: 'tablet', width: 768, icon: Tablet },
  { id: 'desktop', width: 1440, icon: Monitor },
] as const;
export type ViewportId = (typeof VIEWPORTS)[number]['id'];

/** How long the draft waits before it goes to the frame (typing stays smooth). */
export const PREVIEW_SEND_MS = 120;

export const viewportKey = (userId: string | null | undefined) => `cms:preview-viewport:${userId ?? 'anon'}`;

function readViewport(userId: string | null | undefined): ViewportId {
  try {
    const v = localStorage.getItem(viewportKey(userId));
    if (VIEWPORTS.some((p) => p.id === v)) return v as ViewportId;
  } catch {
    // storage blocked: the default below
  }
  return typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop';
}

function writeViewport(userId: string | null | undefined, v: ViewportId) {
  try {
    localStorage.setItem(viewportKey(userId), v);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}

export type FocusTarget = { docId: string; locale: string; path: string };

export interface PreviewPaneProps {
  docId: string;
  /** The draft document `{ en, el }`, as edited (not necessarily valid). */
  doc: unknown;
  /** Editorial docs: the unprefixed public path of the data page to show; null while it is being looked up. */
  path?: string | null;
  initialLocale?: Locale;
  /** The form's field labels (`en.hero.title` -> "Hero › Title (EN)"), read when the draft is sent. */
  getLabels?: () => Record<string, string>;
  /** The form field in focus (`en.hero.title`), outlined on the page; null for none. */
  highlight?: string | null;
  /** A click on the page: focus this field. */
  onFocusTarget?: (target: FocusTarget) => void;
  /** Doc ids whose elements are clickable (default: this doc, the header and the footer). */
  editable?: string[];
  /** Scroll to this doc's first element once (the footer editor). */
  reveal?: string | null;
  /** The rendered page's audit (CMS P6, the SEO panel), per locale shown. */
  onAudit?: (locale: Locale, audit: DomAudit) => void;
}

const NO_LABELS = () => ({});

export default function PreviewPane({
  docId, doc: typed, path, initialLocale = 'en', getLabels = NO_LABELS, highlight = null, onFocusTarget, editable, reveal = null, onAudit,
}: PreviewPaneProps) {
  // The page follows the typing shortly after each keystroke, not on every one.
  const doc = useDebounced(typed, PREVIEW_SEND_MS);
  const transport = usePreviewTransport();
  const me = useContext(AdminUserContext);
  const userId = me?.userId ?? null;
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [viewport, setViewportState] = useState<ViewportId>(() => readViewport(userId));
  const [port, setPort] = useState<HostPort | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState<number | null>(null);
  const [boxHeight, setBoxHeight] = useState<number | null>(null);

  // The person may change between renders (sign-in): reread their choice.
  useEffect(() => setViewportState(readViewport(userId)), [userId]);
  const setViewport = (v: ViewportId) => {
    setViewportState(v);
    writeViewport(userId, v);
  };

  // The field in focus decides the language of the preview.
  const highlightLocale = highlight?.split('.')[0];
  useEffect(() => {
    if (highlightLocale === 'en' || highlightLocale === 'el') setLocale(highlightLocale);
  }, [highlightLocale, highlight]);

  // The iframe loads once per doc; the language and the draft then travel over the bridge.
  const src = useMemo(() => (transport.kind === 'iframe' ? transport.src(docId, initialLocale) : ''), [transport, docId, initialLocale]);
  // The iframe's port (an inline frame hands its own over).
  useEffect(() => {
    if (transport.kind !== 'iframe') return;
    setPort(windowPort<FrameMessage, HostMessage>(window, () => iframeRef.current?.contentWindow ?? null));
    return () => setPort(null);
  }, [transport.kind, src]);

  const latest = useRef({ docId, doc, path, locale, getLabels, editable, reveal, onFocusTarget, onAudit });
  latest.current = { docId, doc, path, locale, getLabels, editable, reveal, onFocusTarget, onAudit };

  const sendState = useCallback(() => {
    if (!port) return;
    const s = latest.current;
    port.post({
      type: 'state',
      docId: s.docId,
      docType: docTypeFor(s.docId),
      locale: s.locale,
      doc: s.doc,
      path: s.path,
      labels: s.getLabels(),
      editable: s.editable ?? [s.docId, 'site-header', 'site-footer'],
      reveal: s.reveal,
    });
  }, [port]);

  const target = highlight ? highlightTarget(docId, highlight) : null;
  const latestTarget = useRef(target);
  latestTarget.current = target;

  // Messages from the frame.
  useEffect(() => {
    if (!port) return;
    const off = port.listen((msg) => {
      if (msg.type === 'ready') {
        sendState();
        port.post({ type: 'highlight', target: latestTarget.current });
      } else if (msg.type === 'focus') {
        const p = parseCmsPath(msg.target);
        if (p) latest.current.onFocusTarget?.(p);
      } else if (msg.type === 'audit') {
        latest.current.onAudit?.(msg.locale, msg.audit);
      }
    });
    sendState();
    return off;
  }, [port, sendState]);

  // The draft (debounced above), the language and the page path.
  useEffect(() => {
    sendState();
  }, [sendState, doc, path, locale, docId, reveal]);

  // The field in focus.
  useEffect(() => {
    port?.post({ type: 'highlight', target });
  }, [port, target]);

  // The pane's size, for the scale of the page.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      setBoxWidth(box.clientWidth || null);
      setBoxHeight(box.clientHeight || null);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const live = useMemo(() => ({ doc, locale, path }), [doc, locale, path]);
  const width = VIEWPORTS.find((v) => v.id === viewport)!.width;
  const scale = boxWidth ? Math.min(1, boxWidth / width) : 1;
  const frameStyle = useMemo(() => {
    const h = boxHeight ? boxHeight / scale : undefined;
    const left = boxWidth && boxWidth > width ? (boxWidth - width) / 2 : 0;
    return { width, height: h, transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: '0 0', left } as const;
  }, [width, scale, boxWidth, boxHeight]);

  return (
    <section className="flex flex-col rounded-stage border border-stage-line bg-stage-bg-2 overflow-hidden" data-testid="preview-host">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stage-line px-3 py-2 text-xs">
        <span className="t-meta">{t.media2.previewBar}</span>
        <div className="flex items-center gap-2">
          <div role="group" aria-label={t.preview.viewports} className="flex gap-0.5 rounded-stage-sm bg-stage-bg p-0.5">
            {VIEWPORTS.map((v) => {
              const Icon = v.icon;
              const on = v.id === viewport;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={on}
                  title={t.preview.viewportTitle(t.preview.viewport[v.id], v.width)}
                  onClick={() => setViewport(v.id)}
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 font-semibold cursor-pointer ${on ? 'bg-stage-surface-2 text-stage-text' : 'text-stage-text-3 hover:text-stage-text'}`}
                >
                  <Icon size={14} aria-hidden />
                  <span>{t.preview.viewport[v.id]}</span>
                  <span className="num font-normal text-stage-text-3 hidden sm:inline">{v.width}</span>
                </button>
              );
            })}
          </div>
          <div role="group" aria-label={t.media2.previewLang} className="flex gap-0.5 rounded-stage-sm bg-stage-bg p-0.5">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={l === locale}
                onClick={() => setLocale(l)}
                className={`rounded px-2 py-1 font-semibold cursor-pointer ${l === locale ? 'bg-stage-surface-2 text-stage-text' : 'text-stage-text-3 hover:text-stage-text'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        ref={boxRef}
        className="relative overflow-hidden bg-stage-bg h-[calc(100dvh-15rem)] min-h-[26rem]"
        data-testid="preview-viewport"
        data-viewport={viewport}
        data-width={width}
      >
        {transport.kind === 'iframe' ? (
          <iframe
            ref={iframeRef}
            key={src}
            src={src}
            title={t.preview.frameTitle}
            className="absolute top-0 border-0 bg-stage-bg"
            style={frameStyle}
            onLoad={sendState}
          />
        ) : (
          <div className="absolute inset-0 overflow-auto" style={{ maxWidth: width }}>
            <InlinePreviewFrame docId={docId} live={live} onPort={setPort} />
          </div>
        )}
      </div>
    </section>
  );
}

/** A form field (`en.hero.title`) as the data-cms-path value of this doc. */
function highlightTarget(docId: string, field: string): string | null {
  const dot = field.indexOf('.');
  if (dot < 0) return null;
  return cmsPathValue(docId, field.slice(0, dot), field.slice(dot + 1));
}

// The visual diff of a publish (spec §5 item 5, owner Q2 = A): the live page
// and the page after the publish, side by side, each in the real preview
// iframe (/admin/preview/:docId/:locale), with the nodes of the changed
// fields tinted: rose on the live side, green on the draft side. It is a DOM
// comparison (data-cms-path), with no screenshot infrastructure.
//
// Both frames show the published header and footer (overlays: []), so a
// one-page publish is shown exactly as it would ship. On phones the two
// sides are tabs.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import type { Locale } from '../../lib/seo/locale';
import { docTypeFor } from '../../../supabase/functions/_shared/cms/registry';
import { windowPort, type FrameMessage, type HostMessage, type HostPort } from '../preview/protocol';
import { InlinePreviewFrame, usePreviewTransport } from '../preview/transport';
import { changedTargets } from './diff';
import type { Path } from '../cms/fieldDiff';
import { t } from '../i18n';

const VIEWPORTS = [
  { id: 'mobile', width: 390, icon: Smartphone },
  { id: 'desktop', width: 1440, icon: Monitor },
] as const;
type ViewportId = (typeof VIEWPORTS)[number]['id'];

type Side = 'live' | 'draft';

function DiffFrame({ docId, doc, locale, path, changed, tone, width, onTinted }: {
  docId: string;
  doc: unknown;
  locale: Locale;
  path?: string | null;
  changed: string[];
  tone: Side;
  width: number;
  onTinted: (n: number) => void;
}) {
  const transport = usePreviewTransport();
  const [port, setPort] = useState<HostPort | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const src = useMemo(() => (transport.kind === 'iframe' ? transport.src(docId, locale) : ''), [transport, docId, locale]);

  useEffect(() => {
    if (transport.kind !== 'iframe') return;
    setPort(windowPort<FrameMessage, HostMessage>(window, () => iframeRef.current?.contentWindow ?? null));
    return () => setPort(null);
  }, [transport.kind, src]);

  const latest = useRef({ doc, locale, path, changed, onTinted });
  latest.current = { doc, locale, path, changed, onTinted };
  const send = useMemo(() => () => {
    const s = latest.current;
    port?.post({
      type: 'state', docId, docType: docTypeFor(docId), locale: s.locale, doc: s.doc, path: s.path,
      labels: {}, editable: [], changed: s.changed, tone, overlays: [],
    });
  }, [port, docId, tone]);

  useEffect(() => {
    if (!port) return;
    const off = port.listen((msg) => {
      if (msg.type === 'ready') send();
      else if (msg.type === 'tinted') latest.current.onTinted(msg.count);
    });
    send();
    return off;
  }, [port, send]);

  const changedKey = changed.join('|');
  useEffect(() => { send(); }, [send, doc, locale, path, changedKey]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = box?.w ? Math.min(1, box.w / width) : 1;
  const live = useMemo(() => ({ doc, locale, path }), [doc, locale, path]);

  return (
    <div ref={boxRef} className="relative overflow-hidden bg-stage-bg h-[calc(100dvh-19rem)] min-h-[22rem]" data-testid={`diff-frame-${tone}`}>
      {transport.kind === 'iframe' ? (
        <iframe
          ref={iframeRef}
          key={src}
          src={src}
          title={tone === 'live' ? t.publishFlow.live : t.publishFlow.draft}
          className="absolute top-0 left-0 border-0 bg-stage-bg"
          style={{ width, height: box?.h ? box.h / scale : undefined, transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: '0 0' }}
          onLoad={send}
        />
      ) : (
        <div className="absolute inset-0 overflow-auto" style={{ maxWidth: width }}>
          <InlinePreviewFrame docId={docId} live={live} onPort={setPort} />
        </div>
      )}
    </div>
  );
}

export function VisualDiff({ docId, live, draft, changes, path }: {
  docId: string;
  live: unknown;
  draft: unknown;
  /** fieldChanges(live, draft) */
  changes: readonly Path[];
  /** Editorial docs: the data page to show. */
  path?: string | null;
}) {
  const firstLocale: Locale = changes.some((p) => p[0] === 'en') || !changes.some((p) => p[0] === 'el') ? 'en' : 'el';
  const [locale, setLocale] = useState<Locale>(firstLocale);
  useEffect(() => setLocale(firstLocale), [docId, firstLocale]);
  const [viewport, setViewport] = useState<ViewportId>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop'));
  const [side, setSide] = useState<Side>('draft');
  const [tinted, setTinted] = useState<Record<Side, number | null>>({ live: null, draft: null });
  const targets = useMemo(() => changedTargets(docId, locale, changes), [docId, locale, changes]);
  useEffect(() => setTinted({ live: null, draft: null }), [docId, locale]);
  const width = VIEWPORTS.find((v) => v.id === viewport)!.width;
  const count = tinted.draft ?? tinted.live;
  const perLocale = (l: Locale) => changes.filter((p) => p[0] === l).length;

  const pane = (s: Side) => (
    <div className={`${side === s ? 'block' : 'hidden'} lg:block min-w-0 rounded-stage border border-stage-line overflow-hidden`}>
      <p className="flex items-center gap-2 border-b border-stage-line bg-stage-bg-2 px-3 py-1.5 t-meta m-0">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s === 'live' ? '#ff5c7a' : '#35d29a' }} />
        <span className="font-semibold text-stage-text">{s === 'live' ? t.publishFlow.live : t.publishFlow.draft}</span>
        <span>· {s === 'live' ? t.publishFlow.legendOld : t.publishFlow.legendNew}</span>
      </p>
      <DiffFrame
        docId={docId}
        doc={s === 'live' ? live : draft}
        locale={locale}
        path={path}
        changed={targets}
        tone={s}
        width={width}
        onTinted={(n) => setTinted((prev) => (prev[s] === n ? prev : { ...prev, [s]: n }))}
      />
    </div>
  );

  return (
    <section className="space-y-3" data-testid="visual-diff">
      <div className="flex flex-wrap items-center gap-2">
        <p className="t-small m-0 mr-auto" data-testid="tint-count">{count === null ? t.common.loading : t.publishFlow.tinted(count)}</p>
        <div role="group" aria-label={t.preview.viewports} className="flex gap-0.5 rounded-stage-sm bg-stage-bg p-0.5 text-xs">
          {VIEWPORTS.map((v) => {
            const Icon = v.icon;
            return (
              <button key={v.id} type="button" aria-pressed={viewport === v.id} onClick={() => setViewport(v.id)}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 font-semibold cursor-pointer ${viewport === v.id ? 'bg-stage-surface-2 text-stage-text' : 'text-stage-text-3 hover:text-stage-text'}`}>
                <Icon size={14} aria-hidden />{t.preview.viewport[v.id]}
              </button>
            );
          })}
        </div>
        <div role="group" aria-label={t.media2.previewLang} className="flex gap-0.5 rounded-stage-sm bg-stage-bg p-0.5 text-xs">
          {(['en', 'el'] as const).map((l) => (
            <button key={l} type="button" aria-pressed={locale === l} onClick={() => setLocale(l)}
              className={`rounded px-2 py-1 font-semibold cursor-pointer ${locale === l ? 'bg-stage-surface-2 text-stage-text' : 'text-stage-text-3 hover:text-stage-text'}`}>
              {l.toUpperCase()}{perLocale(l) > 0 && <span className="ml-1 text-stage-gold">●</span>}
            </button>
          ))}
        </div>
      </div>
      <div role="tablist" aria-label={t.publishFlow.sideBySide} className="flex gap-1 lg:hidden">
        {(['live', 'draft'] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={side === s} onClick={() => setSide(s)}
            className={`rounded-stage-sm px-3 py-1 text-sm font-semibold cursor-pointer ${side === s ? 'bg-stage-surface-2 text-stage-text' : 'text-stage-text-3 hover:text-stage-text'}`}>
            {s === 'live' ? t.publishFlow.live : t.publishFlow.draft}
          </button>
        ))}
      </div>
      <div className="lg:grid lg:grid-cols-2 lg:gap-3">
        {pane('live')}
        {pane('draft')}
      </div>
    </section>
  );
}

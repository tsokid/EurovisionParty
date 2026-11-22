// The per-page SEO panel (CMS P6, spec §4.1) and the gate Publish uses.
//
// - AuditFrames: one hidden preview of the draft per language (the same
//   frame as the visible preview, laid out off screen), each reporting what
//   the rendered page holds (domAudit.ts). The checks need both languages,
//   whichever the visible preview shows.
// - useSeoReport: the checks (seoChecks.ts) from the draft, its validation,
//   its missing translations, the cross-page duplicates and the audits.
// - SeoPanel: the panel: title and description with live counters against
//   their recommended ranges, then H1, slug, images, hreflang and links, per
//   language, each ✓ / ! / ✕ / … ; a failing check links to its field.
// - SeoGate: the same checks for the Publish screen, which holds Publish
//   while one blocks.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CircleDashed, Info, X } from 'lucide-react';
import clsx from 'clsx';
import type { Locale } from '../../lib/seo/locale';
import { docTypeFor } from '../../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../../supabase/functions/_shared/cms/validate';
import { missingTranslationsOf } from '../../../supabase/functions/_shared/cms/translations';
import { isEditorialDocId } from '../../../supabase/functions/_shared/cms/pagesIndex';
import { pageUrl, PAGE_REGISTRY, absoluteUrl } from '../../lib/seo/registry';
import type { PageId } from '../../lib/seo/registry';
import type { Vars } from '../../../supabase/functions/_shared/cms/interpolateDocument';
import { windowPort, type FrameMessage, type HostMessage, type HostPort } from '../preview/protocol';
import { InlinePreviewFrame, usePreviewTransport } from '../preview/transport';
import type { DomAudit } from './domAudit';
import { blockingChecks, seoChecks, TITLE_RANGE, DESCRIPTION_RANGE, type SeoCheck } from './seoChecks';
import { knownRoutesNow, loadKnownRoutes, type KnownRoutes } from './knownRoutes';
import { createPortal } from 'react-dom';
import { t } from '../i18n';

const LOCALES: Locale[] = ['en', 'el'];

// ── Known routes (the internal-link check) ──────────────────────────────
function useKnownRoutes(): KnownRoutes | null {
  const [routes, setRoutes] = useState<KnownRoutes | null>(knownRoutesNow);
  useEffect(() => {
    let live = true;
    loadKnownRoutes().then((r) => { if (live) setRoutes(r); }, () => {});
    return () => { live = false; };
  }, []);
  return routes;
}

// ── The hidden audit frames ──────────────────────────────────────────────
const OFFSCREEN = { position: 'fixed', left: -20000, top: 0, width: 1280, height: 900, visibility: 'hidden', pointerEvents: 'none' } as const;

function AuditFrame({ docId, doc, locale, path, onAudit }: {
  docId: string; doc: unknown; locale: Locale; path?: string | null; onAudit: (locale: Locale, audit: DomAudit) => void;
}) {
  const transport = usePreviewTransport();
  const [port, setPort] = useState<HostPort | null>(null);
  const ref = useRef<HTMLIFrameElement>(null);
  const src = useMemo(() => (transport.kind === 'iframe' ? transport.src(docId, locale) : ''), [transport, docId, locale]);
  const latest = useRef({ doc, path, onAudit });
  latest.current = { doc, path, onAudit };

  useEffect(() => {
    if (transport.kind !== 'iframe') return;
    setPort(windowPort<FrameMessage, HostMessage>(window, () => ref.current?.contentWindow ?? null));
    return () => setPort(null);
  }, [transport.kind, src]);

  const send = useCallback(() => {
    port?.post({
      type: 'state', docId, docType: docTypeFor(docId), locale, doc: latest.current.doc, path: latest.current.path,
      labels: {}, editable: [],
    });
  }, [port, docId, locale]);

  useEffect(() => {
    if (!port) return;
    const off = port.listen((msg) => {
      if (msg.type === 'ready') send();
      else if (msg.type === 'audit' && msg.locale === locale) latest.current.onAudit(locale, msg.audit);
    });
    send();
    return off;
  }, [port, send, locale]);

  useEffect(() => { send(); }, [send, doc, path]);

  const live = useMemo(() => ({ doc, locale, path }), [doc, locale, path]);
  // Inline (tests): the page renders into a detached node, so it never shows in the document.
  const [detached] = useState(() => (typeof document === 'undefined' ? null : document.createElement('div')));
  if (transport.kind !== 'iframe') {
    return detached ? createPortal(<InlinePreviewFrame docId={docId} live={live} onPort={setPort} />, detached) : null;
  }
  return (
    <div aria-hidden style={OFFSCREEN} data-testid={`seo-audit-${locale}`}>
      <iframe ref={ref} src={src} title={t.seo.auditFrame(locale.toUpperCase())} tabIndex={-1} style={{ width: 1280, height: 900, border: 0 }} onLoad={send} />
    </div>
  );
}

/** One hidden preview per language; `onAudit` gets each one's audit as it renders. */
export function AuditFrames({ docId, doc, path, onAudit }: { docId: string; doc: unknown; path?: string | null; onAudit: (locale: Locale, audit: DomAudit) => void }) {
  return <>{LOCALES.map((l) => <AuditFrame key={l} docId={docId} doc={doc} locale={l} path={path} onAudit={onAudit} />)}</>;
}

// ── The report ───────────────────────────────────────────────────────────
const COPY = {
  titleEmpty: t.seo.titleEmpty, titleShort: t.seo.titleShort, titleLong: t.seo.titleLong, titleOk: t.seo.titleOk,
  descEmpty: t.seo.descEmpty, descShort: t.seo.descShort, descLong: t.seo.descLong, descOk: t.seo.descOk, descDuplicate: t.seo.duplicate,
  noSeoFields: t.seo.noSeoFields, h1None: t.seo.h1None, h1Many: t.seo.h1Many, h1Ok: t.seo.h1Ok, pending: t.seo.pending,
  slug: t.seo.slug, slugNone: t.seo.slugNone, altMissing: t.seo.altMissing, altOk: t.seo.altOk,
  hreflangOk: t.seo.hreflangOk, hreflangMissing: t.seo.hreflangMissing,
  linksBroken: t.seo.linksBroken, linksWarn: t.seo.linksWarn, linksOk: t.seo.linksOk, routesLoading: t.seo.routesLoading,
};

function canonicalOf(docId: string, path?: string | null): Partial<Record<Locale, string>> {
  if (PAGE_REGISTRY.some((p) => p.id === docId)) return { en: pageUrl(docId as PageId, 'en'), el: pageUrl(docId as PageId, 'el') };
  if (isEditorialDocId(docId) && path) return { en: absoluteUrl('en', path), el: absoluteUrl('el', path) };
  return {};
}

export type SeoReportInput = {
  docId: string;
  doc: unknown;
  path?: string | null;
  vars?: Partial<Record<Locale, Vars>>;
  duplicates?: Array<{ locale: Locale | null; path: string; message: string }>;
};

/** The checks of a draft, live; mount `frames` (the hidden audit previews) somewhere in the tree. */
export function useSeoReport({ docId, doc, path, vars, duplicates = [] }: SeoReportInput) {
  const routes = useKnownRoutes();
  const [audits, setAudits] = useState<Partial<Record<Locale, DomAudit>>>({});
  const onAudit = useCallback((l: Locale, a: DomAudit) => setAudits((prev) => ({ ...prev, [l]: a })), []);
  useEffect(() => setAudits({}), [docId]);
  const docType = docTypeFor(docId);
  const checks = useMemo(() => {
    const v = validateDocument(docType, doc);
    const missing = missingTranslationsOf(docType, doc);
    const incomplete: Partial<Record<Locale, number>> = {};
    for (const l of LOCALES) {
      const n = v.errors.filter((e) => e.locale === l).length + missing[l].length;
      if (n) incomplete[l] = n;
    }
    return seoChecks({ docType, doc, vars, duplicates, incomplete, audits, routes, canonical: canonicalOf(docId, path), copy: COPY });
  }, [docType, docId, doc, vars, duplicates, audits, routes, path]);
  const frames = <AuditFrames docId={docId} doc={doc} path={path} onAudit={onAudit} />;
  return { checks, blocking: blockingChecks(checks), frames };
}

// ── The panel ────────────────────────────────────────────────────────────
const ICON = { ok: Check, info: Info, warn: AlertTriangle, block: X, pending: CircleDashed } as const;
const TONE = { ok: 'text-stage-ok', info: 'text-stage-text-3', warn: 'text-stage-gold', block: 'text-stage-bad', pending: 'text-stage-text-3' } as const;

function Counter({ check }: { check: SeoCheck }) {
  const c = check.count!;
  const pct = Math.min(100, (c.length / (c.max * 1.25)) * 100);
  const lo = (c.min / (c.max * 1.25)) * 100;
  const hi = (c.max / (c.max * 1.25)) * 100;
  return (
    <span className="mt-1 block" aria-hidden>
      <span className="relative block h-1.5 rounded-full bg-stage-bg">
        <span className="absolute inset-y-0 rounded-full bg-stage-ok/25" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
        <span className={clsx('absolute inset-y-0 left-0 rounded-full', check.severity === 'ok' ? 'bg-stage-ok' : check.severity === 'warn' ? 'bg-stage-gold' : 'bg-stage-bad')} style={{ width: `${pct}%` }} />
      </span>
      <span className="mt-0.5 flex justify-between text-[10px] text-stage-text-3"><span className="num">{c.length}</span><span>{t.seo.range(c.min, c.max)}</span></span>
    </span>
  );
}

function Row({ check, onField }: { check: SeoCheck; onField?: (field: string) => void }) {
  const Icon = ICON[check.severity];
  return (
    <li className="flex gap-2 py-1.5" data-testid={`seo-check-${check.id}${check.locale ? `-${check.locale}` : ''}`} data-severity={check.severity}>
      <Icon size={15} aria-hidden className={clsx('shrink-0 mt-0.5', TONE[check.severity])} />
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-stage-text-2">
        <span className="sr-only">{t.seo.severity[check.severity]}: </span>
        <span className="font-semibold text-stage-text">{t.seo.label[check.id]}</span>
        {' · '}
        <span className="break-words">{check.message}</span>
        {check.count && <Counter check={check} />}
        {check.items && check.items.length > 0 && check.severity !== 'ok' && (
          <span className="mt-0.5 block tabular-nums text-[11px] text-stage-text-3 break-all">{check.items.slice(0, 4).join(' · ')}{check.items.length > 4 ? ` · +${check.items.length - 4}` : ''}</span>
        )}
        {check.field && onField && (check.severity === 'block' || check.severity === 'warn') && (
          <button type="button" onClick={() => onField(check.field!)} className="ml-1 text-stage-pink-2 hover:underline cursor-pointer">{t.seo.toField}</button>
        )}
      </span>
    </li>
  );
}

export function SeoPanel({ checks, onField }: { checks: readonly SeoCheck[]; onField?: (field: string) => void }) {
  const blocking = blockingChecks(checks);
  const fails = checks.filter((c) => c.severity === 'block').length;
  const warns = checks.filter((c) => c.severity === 'warn').length;
  const page = checks.filter((c) => c.locale === null);
  return (
    <section className="rounded-stage border border-stage-line bg-stage-bg-2 p-3 space-y-2" aria-labelledby="seo-panel-title" data-testid="seo-panel">
      <header className="flex flex-wrap items-center gap-2">
        <h3 id="seo-panel-title" className="text-sm font-bold text-stage-text m-0">{t.seo.title}</h3>
        <span className={clsx('chip !text-[12px] !py-0.5', fails ? 'chip-bad' : warns ? 'chip-gold' : blocking.length ? '' : 'chip-ok')} data-testid="seo-summary">
          {fails ? t.seo.summaryBlock(fails) : blocking.length ? t.seo.summaryPending : warns ? t.seo.summaryWarn(warns) : t.seo.summaryOk}
        </span>
      </header>
      <div className="grid gap-x-4 md:grid-cols-2">
        {LOCALES.map((l) => (
          <div key={l}>
            <p className="t-eyebrow text-[11px] m-0 pt-1">{l === 'en' ? 'English' : 'Ελληνικά'}</p>
            <ul className="divide-y divide-stage-line/60 m-0 p-0 list-none">
              {checks.filter((c) => c.locale === l).map((c) => <Row key={`${c.id}-${l}`} check={c} onField={onField} />)}
            </ul>
          </div>
        ))}
      </div>
      {page.length > 0 && <ul className="m-0 p-0 list-none border-t border-stage-line/60">{page.map((c) => <Row key={c.id} check={c} onField={onField} />)}</ul>}
    </section>
  );
}

/** Publish's view: the blocking checks of a draft (frames mounted here), reported to the screen. */
export function SeoGate({ docId, doc, path, onBlocking }: SeoReportInput & { onBlocking: (docId: string, blocking: SeoCheck[]) => void }) {
  const report = useSeoReport({ docId, doc, path });
  const key = JSON.stringify(report.blocking.map((c) => [c.id, c.locale, c.severity]));
  const cb = useRef(onBlocking);
  cb.current = onBlocking;
  useEffect(() => { cb.current(docId, report.blocking); }, [docId, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <SeoPanel checks={report.checks} />
      {report.frames}
    </>
  );
}

export { TITLE_RANGE, DESCRIPTION_RANGE };

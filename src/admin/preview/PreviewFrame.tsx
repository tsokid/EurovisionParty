/**
 * The frame side of click-to-edit (Track 3 §5, Storyblok-style bridge): the
 * previewed page plus the outlines. It receives the draft from the editor
 * (protocol.ts `state`) and:
 * - outlines the editable element under the pointer, with its field's label;
 * - on a click, tells the editor which field to focus (`focus`), and swallows
 *   the click (links and buttons do nothing; a menu toggle still opens, so
 *   the links inside it can be reached);
 * - outlines the element of the field the editor focused (`highlight`) and
 *   scrolls it into view.
 *
 * Elements are found by data-cms-path: explicit markers (cmsAttrs in the
 * shared components) and the text mapping of autoTag.ts. Only the doc ids the
 * editor lists as editable are outlined, and only paths the editor has a
 * field for. Runs inside the preview iframe (AdminPreviewRoute) or inline
 * (InlinePreviewFrame).
 *
 * Diff mode (CMS P5, the publish screen): the host lists the changed fields
 * (`changed`), and the frame tints their nodes, the old side in rose and the
 * new side in green, with nothing clickable (`editable: []`).
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { auditDom, sameAudit, type DomAudit } from '../seo/domAudit';
import { CMS_PATH_ATTR, parseCmsPath } from '../../lib/cms/cmsAttrs';
import type { Locale } from '../../lib/seo/locale';
import { docTypeFor } from '../../../supabase/functions/_shared/cms/registry';
import type { DraftDoc } from '../../../supabase/functions/_shared/cms/overlay';
import { AUTO_ATTR, autoTag } from './autoTag';
import PreviewDocument from './PreviewDocument';
import type { FramePort, HostMessage } from './protocol';
import { t, docName } from '../i18n';

type State = Extract<HostMessage, { type: 'state' }>;

type Box = { top: number; left: number; width: number; height: number };

/** The label of a data-cms-path value: the form's own label, else the doc's name. */
export function targetLabel(target: string, labels: Record<string, string>, currentDoc: string): string {
  const p = parseCmsPath(target);
  if (!p) return target;
  if (p.docId !== currentDoc) return t.preview.otherDoc(docName(p.docId));
  const key = `${p.locale}.${p.path}`;
  const other = `${p.locale === 'en' ? 'el' : 'en'}.${p.path}`;
  if (labels[key]) return labels[key];
  if (labels[other]) return labels[other].replace(/\((EN|EL)\)$/, `(${p.locale.toUpperCase()})`);
  // A container (a block, a list item): its first field's label, less the field.
  const child = Object.keys(labels).find((k) => k.startsWith(`${key}.`));
  if (child) return labels[child].replace(/ › [^›]+$/, '');
  return t.preview.field;
}

const CHROME_DOCS = new Set(['site-header', 'site-footer']);

/** Every field path of the form and every path that contains one (cached per labels object). */
const fieldPaths = new WeakMap<Record<string, string>, Set<string>>();
function pathsOf(labels: Record<string, string>): Set<string> {
  let set = fieldPaths.get(labels);
  if (!set) {
    set = new Set();
    for (const key of Object.keys(labels)) {
      const parts = key.split('.');
      for (let i = 2; i <= parts.length; i++) set.add(parts.slice(0, i).join('.'));
    }
    fieldPaths.set(labels, set);
  }
  return set;
}

/** Whether the editor has a field at (or inside) the path of `target`. */
function hasField(target: string, labels: Record<string, string>, currentDoc: string): boolean {
  const p = parseCmsPath(target);
  if (!p) return false;
  // Another doc, or the header and footer (explicit markers; a footer column screen routes the other columns).
  if (p.docId !== currentDoc || CHROME_DOCS.has(p.docId)) return true;
  const paths = pathsOf(labels);
  if (paths.size === 0) return true; // no form to check against (standalone)
  return paths.has(`${p.locale}.${p.path}`) || paths.has(`${p.locale === 'en' ? 'el' : 'en'}.${p.path}`);
}

/** The elements of a target: exact matches, else the nearest marked container of it. */
export function elementsFor(root: ParentNode, target: string): Element[] {
  const all = [...root.querySelectorAll(`[${CMS_PATH_ATTR}]`)];
  const exact = all.filter((el) => el.getAttribute(CMS_PATH_ATTR) === target);
  if (exact.length) return exact;
  let best: Element[] = [];
  let bestLen = 0;
  for (const el of all) {
    const v = el.getAttribute(CMS_PATH_ATTR)!;
    if (target.startsWith(`${v}.`) && v.length > bestLen) {
      best = [el];
      bestLen = v.length;
    } else if (v.length === bestLen && target.startsWith(`${v}.`)) {
      best.push(el);
    }
  }
  return best;
}

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
};

function boxOf(el: Element, root: Element): Box {
  const r = el.getBoundingClientRect();
  const o = root.getBoundingClientRect();
  return { top: r.top - o.top, left: r.left - o.left, width: r.width, height: r.height };
}

const reducedMotion = (w: Window) => !!w.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Scrolls the frame (never the admin around it) so `el` sits in the upper third. */
function scrollToElement(el: Element) {
  const w = el.ownerDocument.defaultView;
  if (!w) return;
  if (w !== w.parent) {
    const top = el.getBoundingClientRect().top + w.scrollY - w.innerHeight / 3;
    w.scrollTo({ top: Math.max(0, top), behavior: reducedMotion(w) ? 'auto' : 'smooth' });
  } else {
    (el as HTMLElement).scrollIntoView?.({ block: 'nearest' });
  }
}

const NO_LABELS: Record<string, string> = {};
const editableCache = new Map<string, string[]>();
const defaultEditable = (docId: string) => {
  let v = editableCache.get(docId);
  if (!v) editableCache.set(docId, (v = [docId, 'site-header', 'site-footer']));
  return v;
};

const sameBox = (a: Box, b: Box) => a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

/** The same selection object when its boxes did not move (no re-render). */
function withBoxes<T extends { boxes: Box[] }>(s: T, boxes: Box[]): T {
  return boxes.length === s.boxes.length && boxes.every((b, i) => sameBox(b, s.boxes[i])) ? s : { ...s, boxes };
}

/** The page re-renders only when what it shows changes (not on every hover). */
const MemoPreviewDocument = memo(PreviewDocument);

/** Elements the diff tints carry data-cms-changed (frame only). */
export const CHANGED_ATTR = 'data-cms-changed';

/**
 * The nodes of the changed targets: each target's own nodes and the nodes
 * inside it (a list that changed length is one target), else its nearest
 * marked container. Outermost nodes only, so a tinted block is one box.
 */
export function tintElements(root: ParentNode, targets: readonly string[]): Element[] {
  if (targets.length === 0) return [];
  const all = [...root.querySelectorAll(`[${CMS_PATH_ATTR}]`)];
  const hit = new Set<Element>();
  for (const target of targets) {
    const own = all.filter((el) => {
      const v = el.getAttribute(CMS_PATH_ATTR)!;
      return v === target || v.startsWith(`${target}.`);
    });
    for (const el of own.length ? own : elementsFor(root, target)) hit.add(el);
  }
  return [...hit].filter((el) => ![...hit].some((other) => other !== el && other.contains(el)));
}

function markChanged(scope: ParentNode, targets: readonly string[]): Element[] {
  for (const el of scope.querySelectorAll(`[${CHANGED_ATTR}]`)) el.removeAttribute(CHANGED_ATTR);
  const els = tintElements(scope, targets);
  for (const el of els) el.setAttribute(CHANGED_ATTR, '');
  return els;
}

const TINT = {
  live: { border: '#ff5c7a', fill: 'rgb(255 92 122 / 0.16)' },
  draft: { border: '#35d29a', fill: 'rgb(53 210 154 / 0.16)' },
} as const;

function tintStyle(b: Box, tone: 'live' | 'draft') {
  return {
    position: 'absolute', top: b.top - 2, left: b.left - 2, width: b.width + 4, height: b.height + 4,
    border: `2px dashed ${TINT[tone].border}`, borderRadius: 5, background: TINT[tone].fill,
  } as const;
}

const NO_TARGETS: string[] = [];

/** The selected field's elements carry data-cms-selected (frame only: the outlines and tests read it). */
export const SELECTED_ATTR = 'data-cms-selected';

function markSelected(scope: ParentNode, target: string | null): Element[] {
  for (const el of scope.querySelectorAll(`[${SELECTED_ATTR}]`)) el.removeAttribute(SELECTED_ATTR);
  if (!target) return [];
  const els = elementsFor(scope, target);
  for (const el of els) el.setAttribute(SELECTED_ATTR, '');
  return els;
}

const isMenuToggle = (el: Element) => !!el.closest('[aria-haspopup], [aria-controls]');

// Admin-only styles stay inline: nothing here may reach the public CSS.
const PINK = 'var(--color-stage-pink, #ff2d87)';
const GOLD = 'var(--color-stage-gold, #ffc24b)';
const LAYER = { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2147483000 } as const;

function outline(b: Box, kind: 'hover' | 'selected') {
  return {
    position: 'absolute', top: b.top - 3, left: b.left - 3, width: b.width + 6, height: b.height + 6,
    border: `2px ${kind === 'hover' ? 'solid' : 'solid'} ${kind === 'hover' ? PINK : GOLD}`, borderRadius: 6,
    boxShadow: kind === 'selected' ? '0 0 0 4px rgb(255 194 75 / 0.25)' : '0 0 0 3px rgb(255 45 135 / 0.18)',
    background: kind === 'selected' ? 'rgb(255 194 75 / 0.08)' : 'rgb(255 45 135 / 0.05)',
  } as const;
}

/** The label sits above the box (inside it when the box touches the top). */
function labelStyle(b: Box) {
  return {
    position: 'absolute', left: -2, ...(b.top < 26 ? { top: 0 } : { bottom: '100%' }),
    maxWidth: 'min(28rem, 90vw)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    background: PINK, color: '#fff', font: '600 12px/1.2 Inter, system-ui, sans-serif', letterSpacing: 0,
    padding: '4px 8px', borderRadius: '6px 6px 6px 0', marginBottom: 2, boxShadow: '0 4px 14px rgb(0 0 0 / 0.35)',
  } as const;
}

type Shown = { doc: unknown; locale: Locale; path?: string | null };

export function PreviewFrame({ port, docId, initial, live, drafts }: {
  port: FramePort;
  docId: string;
  /** What to show before the editor sends its state (the iframe opened on its own). */
  initial?: Shown | null;
  /** Inline only: the editor's current draft, shown as is (the bridge still carries labels, clicks and focus). */
  live?: Shown;
  /** Saved drafts of the other docs the page shows (the header and footer). */
  drafts?: readonly DraftDoc[];
}) {
  const [state, setState] = useState<State | null>(null);
  const [hover, setHover] = useState<{ target: string; box: Box; label: string } | null>(null);
  const [selected, setSelected] = useState<{ target: string; boxes: Box[] } | null>(null);
  const [tints, setTints] = useState<Box[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverEl = useRef<Element | null>(null);
  const latest = useRef<State | null>(null);
  latest.current = state;
  const revealed = useRef<string | null>(null);
  const lastAudit = useRef<{ locale: string; audit: DomAudit } | null>(null);

  const shown: Shown | null = live ?? (state ? { doc: state.doc, locale: state.locale, path: state.path } : initial ?? null);
  const doc = shown?.doc;
  const locale = shown?.locale ?? 'en';
  const path = shown?.path;
  const labels = state?.labels ?? NO_LABELS;
  const editable = state?.editable ?? defaultEditable(docId);
  const changed = state?.changed ?? NO_TARGETS;
  const changedKey = changed.join('|');
  const changedRef = useRef(changed);
  changedRef.current = changed;
  const tone = state?.tone ?? 'draft';
  const shownDrafts = state?.overlays ?? drafts;

  const isEditable = useCallback((target: string | null): target is string => {
    if (!target) return false;
    const p = parseCmsPath(target);
    if (!p || !editable.includes(p.docId)) return false;
    return hasField(target, latest.current?.labels ?? {}, docId);
  }, [editable, docId]);

  // Messages from the editor.
  useEffect(() => {
    const off = port.listen((msg) => {
      if (msg.type === 'state') {
        if (msg.docId !== docId || msg.docType !== docTypeFor(docId)) return;
        // A host that just connected has not seen the audit yet: post it again after this render.
        lastAudit.current = null;
        setState(msg);
      } else if (msg.type === 'highlight') {
        const target = msg.target;
        setSelected((s) => (target ? (s?.target === target ? s : { target, boxes: [] }) : null));
      }
    });
    port.post({ type: 'ready' });
    return off;
  }, [port, docId]);

  // The text mapping, after every render of the page (content can arrive later: watch the DOM).
  const slice = doc && typeof doc === 'object' ? (doc as Record<string, unknown>)[locale] : undefined;
  const pageDoc = docId;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const docRoot = root.ownerDocument;
    let raf = 0;
    const accept = (p: string) => hasField(`${pageDoc}:${locale}:${p}`, latest.current?.labels ?? {}, docId);
    // In the iframe the whole document is the page (the mobile menu is portalled to its body); inline, only the pane.
    const w = docRoot.defaultView;
    const scope: Element = w && w !== w.parent ? docRoot.body : root;
    const run = () => {
      raf = 0;
      observer.disconnect();
      autoTag(scope, pageDoc, locale, slice, accept);
      port.post({ type: 'tagged', count: scope.querySelectorAll(`[${CMS_PATH_ATTR}]`).length });
      // The SEO panel's view of the rendered page (CMS P6), when it changed.
      const audit = auditDom(scope);
      if (lastAudit.current?.locale !== locale || !sameAudit(lastAudit.current.audit, audit)) {
        lastAudit.current = { locale, audit };
        port.post({ type: 'audit', locale, audit });
      }
      setSelected((s) => (s ? withBoxes(s, markSelected(scope, s.target).filter(visible).map((el) => boxOf(el, root))) : s));
      if (changedRef.current.length || scope.querySelector(`[${CHANGED_ATTR}]`)) {
        const tinted = markChanged(scope, changedRef.current).filter(visible);
        setTints((prev) => {
          const next = tinted.map((el) => boxOf(el, root));
          return next.length === prev.length && next.every((b, i) => sameBox(b, prev[i])) ? prev : next;
        });
        port.post({ type: 'tinted', count: tinted.length });
      }
      observer.observe(scope, { childList: true, subtree: true, characterData: true });
    };
    const schedule = () => {
      if (!raf) raf = (docRoot.defaultView ?? window).requestAnimationFrame(run);
    };
    const observer = new MutationObserver(schedule);
    run();
    return () => {
      observer.disconnect();
      if (raf) (docRoot.defaultView ?? window).cancelAnimationFrame(raf);
      for (const el of scope.querySelectorAll(`[${AUTO_ATTR}]`)) {
        el.removeAttribute(AUTO_ATTR);
        el.removeAttribute(CMS_PATH_ATTR);
      }
    };
  }, [slice, locale, pageDoc, docId, port, labels, changedKey]);

  // Pointer: outline on hover, focus the field on click.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const d = root.ownerDocument;
    const targetOf = (node: EventTarget | null): Element | null => {
      let el = node instanceof Element ? node.closest(`[${CMS_PATH_ATTR}]`) : null;
      while (el && !isEditable(el.getAttribute(CMS_PATH_ATTR))) el = el.parentElement?.closest(`[${CMS_PATH_ATTR}]`) ?? null;
      return el;
    };
    const onOver = (e: Event) => {
      const el = targetOf(e.target);
      hoverEl.current = el;
      if (!el) { setHover(null); return; }
      const target = el.getAttribute(CMS_PATH_ATTR)!;
      setHover({ target, box: boxOf(el, root), label: targetLabel(target, latest.current?.labels ?? {}, docId) });
    };
    const onLeave = (e: Event) => {
      if (!(e as MouseEvent).relatedTarget) { hoverEl.current = null; setHover(null); }
    };
    const onClick = (e: Event) => {
      const el = targetOf(e.target);
      if ((e.target as Element | null)?.closest?.('a')) e.preventDefault();
      if (!el) return;
      if (!isMenuToggle(e.target as Element)) {
        e.preventDefault();
        e.stopPropagation();
      }
      port.post({ type: 'focus', target: el.getAttribute(CMS_PATH_ATTR)! });
    };
    const onSubmit = (e: Event) => e.preventDefault();
    d.addEventListener('mouseover', onOver, true);
    d.addEventListener('mouseout', onLeave, true);
    d.addEventListener('click', onClick, true);
    d.addEventListener('submit', onSubmit, true);
    return () => {
      d.removeEventListener('mouseover', onOver, true);
      d.removeEventListener('mouseout', onLeave, true);
      d.removeEventListener('click', onClick, true);
      d.removeEventListener('submit', onSubmit, true);
    };
  }, [port, isEditable, docId]);

  // The field the editor is in: outline its element(s), scroll the first into view.
  const selectedTarget = selected?.target ?? null;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const marked = markSelected(root.ownerDocument, selectedTarget);
    if (!selectedTarget) return;
    const els = marked.filter(visible);
    setSelected((s) => (s ? withBoxes(s, els.map((el) => boxOf(el, root))) : s));
    if (els[0]) scrollToElement(els[0]);
  }, [selectedTarget]);

  // Once per doc: the footer editor opens on the footer.
  const reveal = state?.reveal ?? null;
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !reveal || revealed.current === reveal) return;
    const el = root.ownerDocument.querySelector(`[${CMS_PATH_ATTR}^="${reveal}:"]`);
    if (el) {
      revealed.current = reveal;
      scrollToElement(el);
    }
  });

  // Keep the outlines on their elements when the page reflows or scrolls.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.ownerDocument.defaultView ?? window;
    const relayout = () => {
      if (hoverEl.current) {
        const el = hoverEl.current;
        setHover((h) => (h ? { ...h, box: boxOf(el, root) } : h));
      }
      setSelected((s) => (s ? withBoxes(s, elementsFor(root.ownerDocument, s.target).filter(visible).map((el) => boxOf(el, root))) : s));
      const tinted = [...root.ownerDocument.querySelectorAll(`[${CHANGED_ATTR}]`)].filter(visible);
      setTints((prev) => (prev.length || tinted.length ? tinted.map((el) => boxOf(el, root)) : prev));
    };
    w.addEventListener('resize', relayout);
    w.addEventListener('scroll', relayout, true);
    return () => {
      w.removeEventListener('resize', relayout);
      w.removeEventListener('scroll', relayout, true);
    };
  }, []);

  if (doc === undefined) return <p className="m-4 t-small">{t.common.loading}</p>;

  return (
    <div ref={rootRef} className="relative" data-testid="preview-frame">
      <MemoPreviewDocument docId={docId} doc={doc} locale={locale} path={path} drafts={shownDrafts} />
      <div aria-hidden style={LAYER} data-testid="preview-outlines">
        {tints.map((b, i) => (
          <div key={`t${i}`} style={tintStyle(b, tone)} data-testid="preview-tint" data-tone={tone} />
        ))}
        {selected?.boxes.map((b, i) => (
          <div key={i} style={outline(b, 'selected')} data-testid="preview-selected" />
        ))}
        {hover && hover.target !== selected?.target && (
          <div style={outline(hover.box, 'hover')}>
            <span style={labelStyle(hover.box)} data-testid="preview-hover-label">{hover.label}</span>
          </div>
        )}
        {hover && hover.target === selected?.target && (
          <div style={{ ...outline(hover.box, 'selected'), boxShadow: 'none' }}>
            <span style={{ ...labelStyle(hover.box), background: GOLD, color: '#1a0f00' }} data-testid="preview-hover-label">{hover.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

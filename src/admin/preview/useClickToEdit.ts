// The editor side of click-to-edit (Track 3 §4, §5):
// - a click on the preview focuses its field: scrolled into view and focused,
//   with ?field= in the URL (a deep link to the field);
// - a field that gets focus is outlined on the preview (`highlight`), and
//   stays outlined until another field gets focus;
// - an element of another doc (the header or footer, from a page editor)
//   opens that doc's editor on the field;
// - /admin/pages/:docId?field=en.hero.title opens on that field.
//
// Fields are the form's controls carrying data-cms-field (`en.hero.title`,
// the locale then the path inside it). Their labels feed the preview's hover
// tag: data-cms-label, else the control's accessible name.
import { useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { UNSAFE_LocationContext, UNSAFE_NavigationContext } from 'react-router-dom';
import type { FocusTarget } from '../modules/pages/PreviewPane';
import { adminPaths } from '../paths';

const FIELD_ATTR = 'data-cms-field';

const attr = (v: string) => v.replace(/["\\]/g, (c) => `\\${c}`);

/** The control of a field: exact, else the first inside it (a block, an item), else the same path in the other locale (a shared field). */
export function findField(root: ParentNode, field: string): HTMLElement | null {
  const exact = root.querySelector<HTMLElement>(`[${FIELD_ATTR}="${attr(field)}"]`);
  if (exact) return exact;
  const inside = root.querySelector<HTMLElement>(`[${FIELD_ATTR}^="${attr(field)}."]`);
  if (inside) return inside;
  const dot = field.indexOf('.');
  const other = `${field.startsWith('en.') ? 'el' : 'en'}${field.slice(dot)}`;
  if (other === field) return null;
  return root.querySelector<HTMLElement>(`[${FIELD_ATTR}="${attr(other)}"]`) ?? root.querySelector<HTMLElement>(`[${FIELD_ATTR}^="${attr(other)}."]`);
}

/** A control's label as the person sees it. */
export function controlLabel(el: HTMLElement): string | null {
  const own = el.dataset.cmsLabel ?? el.getAttribute('aria-label');
  if (own) return own.trim();
  const label = (el as HTMLInputElement).labels?.[0]?.textContent;
  return label ? label.replace(/\s+/g, ' ').trim() : null;
}

/** Every field of the form with its label (labels read once: input.labels scans the whole document). */
export function formLabels(root: ParentNode | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!root) return out;
  const byId = new Map<string, string>();
  for (const l of root.querySelectorAll<HTMLLabelElement>('label[for]')) {
    if (!byId.has(l.htmlFor)) byId.set(l.htmlFor, (l.textContent ?? '').replace(/\s+/g, ' ').trim());
  }
  for (const el of root.querySelectorAll<HTMLElement>(`[${FIELD_ATTR}]`)) {
    const field = el.getAttribute(FIELD_ATTR)!;
    if (field in out) continue;
    const own = el.dataset.cmsLabel ?? el.getAttribute('aria-label');
    out[field] = own?.trim() || (el.id && byId.get(el.id)) || (el.closest('label')?.querySelector('span')?.textContent?.trim() ?? field);
  }
  return out;
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Scrolls the control to the middle of the screen and puts the caret in it. */
export function focusControl(el: HTMLElement) {
  el.scrollIntoView?.({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  el.focus({ preventScroll: true });
}

export interface ClickToEditOptions {
  docId: string;
  /** The form's container. */
  formRef: RefObject<HTMLElement | null>;
  /** Whether the form is on screen (the field is focused only once it is). */
  ready: boolean;
  /** Before a field is focused (phones: switch to the Edit tab). */
  beforeFocus?: () => void;
  /** The editor URL of another doc's field (default: its editor, ?field=). */
  editorFor?: (target: FocusTarget) => string;
  /** This doc's field is not on this screen (another footer column): the screen that has it, or null. */
  screenFor?: (field: string) => string | null;
}

export function useClickToEdit({ docId, formRef, ready, beforeFocus, editorFor, screenFor }: ClickToEditOptions) {
  const [highlight, setHighlight] = useState<string | null>(null);
  // Router contexts read directly: the editors also render without a router (tests, the gallery).
  const nav = useContext(UNSAFE_NavigationContext);
  const loc = useContext(UNSAFE_LocationContext);
  const location = loc?.location ?? null;
  const latest = useRef({ beforeFocus, editorFor, screenFor, nav, location });
  latest.current = { beforeFocus, editorFor, screenFor, nav, location };

  /** ?field= on the current URL (replace: no new history entry per click). */
  const writeField = useCallback((field: string) => {
    const { nav: n, location: l } = latest.current;
    if (!n || !l) return;
    const params = new URLSearchParams(l.search);
    if (params.get('field') === field) return;
    params.set('field', field);
    n.navigator.replace({ pathname: l.pathname, search: `?${params}`, hash: l.hash }, l.state);
  }, []);

  const focusField = useCallback((field: string, write = true) => {
    latest.current.beforeFocus?.();
    // After the tab switch has rendered.
    requestAnimationFrame(() => {
      const root = formRef.current;
      const el = root ? findField(root, field) : null;
      if (!el) {
        const other = latest.current.screenFor?.(field);
        if (other && latest.current.nav) latest.current.nav.navigator.push(`${other}?field=${encodeURIComponent(field)}`);
        return;
      }
      focusControl(el);
      setHighlight(el.getAttribute(FIELD_ATTR));
      if (write) writeField(field);
    });
  }, [formRef, writeField]);

  const onFocusTarget = useCallback((target: FocusTarget) => {
    const field = `${target.locale}.${target.path}`;
    if (target.docId === docId) {
      focusField(field);
      return;
    }
    const { nav: n, editorFor: to } = latest.current;
    const url = to?.(target) ?? `${adminPaths.editorOf(target.docId)}?field=${encodeURIComponent(field)}`;
    if (n) n.navigator.push(url);
  }, [docId, focusField]);

  // Field focus -> outline on the page.
  useEffect(() => {
    const root = formRef.current;
    if (!root || !ready) return;
    const onIn = (e: FocusEvent) => {
      const holder = (e.target as HTMLElement | null)?.closest?.(`[${FIELD_ATTR}]`);
      if (holder) setHighlight(holder.getAttribute(FIELD_ATTR));
    };
    // The outline stays on the last field until another one gets focus, so
    // switching to the Preview tab (phones) still shows what was just edited.
    root.addEventListener('focusin', onIn);
    return () => root.removeEventListener('focusin', onIn);
  }, [formRef, ready]);

  // ?field= on arrival: focus it once the form is there.
  const deepField = location ? new URLSearchParams(location.search).get('field') : null;
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !deepField || done.current === `${docId}|${deepField}`) return;
    done.current = `${docId}|${deepField}`;
    focusField(deepField, false);
  }, [ready, deepField, docId, focusField]);

  const getLabels = useCallback(() => formLabels(formRef.current), [formRef]);

  return { highlight, onFocusTarget, getLabels, focusField };
}

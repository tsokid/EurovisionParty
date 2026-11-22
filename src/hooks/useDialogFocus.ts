import { useEffect, useLayoutEffect, type RefObject } from 'react';

/** What counts as a Tab stop inside a dialog. */
export const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs, innermost last. Only the top one traps Tab, so a dialog
// opened from another dialog (TV mode → finale / reel) owns the keyboard.
const stack: RefObject<HTMLElement | null>[] = [];

/** True when `ref` is the innermost open dialog (e.g. to decide who handles Escape). */
export function isTopDialog(ref: RefObject<HTMLElement | null>): boolean {
  return stack[stack.length - 1] === ref;
}

function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('inert'));
}

/**
 * Modal dialog focus: Tab and Shift+Tab cycle inside `ref` and never reach
 * the page behind; on close (active → false, or unmount) focus returns to
 * the element that had it when the dialog opened.
 *
 * Initial focus stays with the dialog (each one knows its first control);
 * Escape stays with the dialog too. The opener is read in a layout effect,
 * which runs before the dialog's own effects move focus inside.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active = true): void {
  useLayoutEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const opener = document.activeElement as HTMLElement | null;
    const root = ref.current;
    stack.push(ref);
    return () => {
      const i = stack.lastIndexOf(ref);
      if (i >= 0) stack.splice(i, 1);
      // After the commit: React restores the pre-commit focus at the end of
      // it, and an exiting dialog (AnimatePresence) is still in the DOM then.
      // Only take focus back if it is still in the closed dialog or lost.
      queueMicrotask(() => {
        if (!opener || opener === document.body || !opener.isConnected) return;
        const now = document.activeElement;
        if (!now || now === document.body || (root && root.contains(now))) opener.focus?.();
      });
    };
  }, [active, ref]);

  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || stack[stack.length - 1] !== ref) return;
      const root = ref.current;
      if (!root) return;
      const items = tabbables(root);
      if (items.length === 0) { e.preventDefault(); root.focus?.(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (!current || !root.contains(current)) {
        // Focus escaped (e.g. to <body> after a control unmounted): bring it back.
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, ref]);
}

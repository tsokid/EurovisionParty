// Unsaved-edits guard for the admin. A module with unsaved edits calls
// useUnsavedGuard(dirty): while dirty, a page unload (close, reload, URL
// change) triggers the browser's "leave site?" prompt, and in-admin
// navigation (switching module, signing out, opening another page in the
// Pages module) asks confirmLeave() first. The shell provides one guard;
// without a provider a module-level default is used (e.g. a module rendered
// alone in a test).
import { createContext, useContext, useEffect, useState } from 'react';

export const UNSAVED_TEXT = 'You have unsaved edits. Leave without saving?';

export type UnsavedGuard = {
  /** Marks the holder of `token` dirty or clean. */
  setDirty: (token: object, dirty: boolean) => void;
  isDirty: () => boolean;
  /** True when nothing is dirty or the user confirms leaving. */
  confirmLeave: () => boolean;
};

export function createUnsavedGuard(): UnsavedGuard {
  const dirty = new Set<object>();
  return {
    setDirty: (token, d) => {
      if (d) dirty.add(token);
      else dirty.delete(token);
    },
    isDirty: () => dirty.size > 0,
    confirmLeave: () => dirty.size === 0 || window.confirm(UNSAVED_TEXT),
  };
}

export const UnsavedGuardContext = createContext<UnsavedGuard>(createUnsavedGuard());

export const useLeaveGuard = (): UnsavedGuard => useContext(UnsavedGuardContext);

function blockUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  // Older browsers need returnValue set to show the prompt.
  e.returnValue = '';
}

/** Registers this component's unsaved state; released on unmount. */
export function useUnsavedGuard(dirty: boolean): void {
  const guard = useLeaveGuard();
  const [token] = useState(() => ({}));
  useEffect(() => {
    if (!dirty) return;
    guard.setDirty(token, true);
    window.addEventListener('beforeunload', blockUnload);
    return () => {
      window.removeEventListener('beforeunload', blockUnload);
      guard.setDirty(token, false);
    };
  }, [guard, token, dirty]);
}

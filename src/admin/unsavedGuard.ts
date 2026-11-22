// Unsaved-edits guard for the admin. A module with unsaved edits calls
// useUnsavedGuard(dirty): while dirty, a page unload (close, reload, typed
// URL) triggers the browser's "leave site?" prompt, and in-admin navigation
// asks first: route changes (nav links, back/forward, links inside modules)
// through useRouteLeaveGuard in the shell, sign-out through confirmLeave().
// The shell provides one guard; without a provider a module-level default is
// used (e.g. a module rendered alone in a test).
import { createContext, useContext, useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';

import { t } from './i18n';

export const UNSAVED_TEXT: string = t.unsaved.leave;

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

/**
 * Asks before a route change leaves unsaved edits (links, back/forward).
 * `keyOf` maps a pathname to the editor it mounts: moves that keep the key
 * (e.g. a contest's details ↔ its entries) keep the edits and pass freely.
 * Needs a data router (createBrowserRouter / createMemoryRouter).
 */
export function useRouteLeaveGuard(guard: UnsavedGuard, keyOf: (pathname: string) => string): void {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      guard.isDirty() && keyOf(currentLocation.pathname) !== keyOf(nextLocation.pathname),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(UNSAVED_TEXT)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
}

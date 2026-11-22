// What the admin top bar shows for the current screen: the breadcrumb (set
// by the routed screen) and the public URL of the item on screen, when it
// has one (set by the screen, or by the module once it knows the item, e.g.
// a contest's archive slug). Outside the shell the hooks do nothing.
import { createContext, useContext, useEffect } from 'react';

export interface Crumb {
  label: string;
  /** Admin path; the last crumb has none. */
  to?: string;
}

export interface AdminMetaApi {
  setCrumbs(crumbs: Crumb[]): void;
  /** Unlocalized public path ('/faq'), or null when the screen has none. */
  setLive(path: string | null): void;
}

export const AdminMetaContext = createContext<AdminMetaApi | null>(null);

/** Sets the breadcrumb while the calling screen is mounted. */
export function useAdminCrumbs(crumbs: Crumb[]): void {
  const api = useContext(AdminMetaContext);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    if (!api) return;
    api.setCrumbs(JSON.parse(key) as Crumb[]);
  }, [api, key]);
}

/** Sets the "View live" target while the caller is mounted (null: none). */
export function useAdminLive(path: string | null | undefined): void {
  const api = useContext(AdminMetaContext);
  const value = path ?? null;
  useEffect(() => {
    if (!api) return;
    api.setLive(value);
    return () => api.setLive(null);
  }, [api, value]);
}

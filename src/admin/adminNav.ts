// Cross-module navigation in the admin (the shell switches modules by state,
// not by URL): openDoc(docId) shows the Pages module with that document's
// editor, e.g. the Contests "Editorial" indicator opening archive-{year}.
// It goes through the unsaved-edits guard like a sidebar click.
import { createContext, useContext } from 'react';

export interface AdminNav {
  /** Show the Pages module with the editor of `docId`. */
  openDoc(docId: string): void;
  /** The doc the Pages module should open on mount (then cleared), if any. */
  pendingDoc: string | null;
  clearPendingDoc(): void;
}

export const AdminNavContext = createContext<AdminNav | null>(null);

/** The admin navigation; null outside the admin shell (e.g. a module rendered alone in a test). */
export function useAdminNav(): AdminNav | null {
  return useContext(AdminNavContext);
}

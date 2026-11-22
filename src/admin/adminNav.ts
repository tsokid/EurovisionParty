// Cross-module navigation in the admin: openDoc(docId) opens that document's
// editor (/admin/pages/:docId), e.g. the Contests "Editorial" indicator
// opening archive-{year}. It is a route change, so the shell's route guard
// asks before unsaved edits are left behind.
import { createContext, useContext } from 'react';

export interface AdminNav {
  /** Opens the Pages editor of `docId`. */
  openDoc(docId: string): void;
}

export const AdminNavContext = createContext<AdminNav | null>(null);

/** The admin navigation; null outside the admin shell (e.g. a module rendered alone in a test). */
export function useAdminNav(): AdminNav | null {
  return useContext(AdminNavContext);
}

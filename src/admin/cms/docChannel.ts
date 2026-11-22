// The realtime side of one open CMS document (spec §4 "Two editors at
// once"): Supabase Realtime presence on the private channel cms:doc:{id}
// (who else is here, and which field they are in), a "saved" broadcast after
// every autosave, and postgres_changes on the doc's cms_documents row (087)
// as a second source of the other editor's saves. Only super admins may join
// (087's realtime.messages policies). When the channel cannot be joined
// (087 not applied, offline) the editor keeps working without presence; a
// concurrent save is still caught by cms_save's refusal.
//
// The factory is injectable (CmsRealtimeContext) so tests can run two
// editors against one in-memory hub (tests/admin/cmsTwoEditors.test.tsx).
import { createContext } from 'react';
import { supabase } from '../../lib/supabase';

export type Me = { userId: string; email: string | null };

/** One open editor tab of someone else. */
export type Peer = {
  /** Unique per tab. */
  key: string;
  userId: string;
  email: string | null;
  /** The field they are in ("el.blocks.3.items.1.a"), and its label as they see it. */
  field: string | null;
  fieldLabel: string | null;
};

export type RemoteSave = { updatedAt: string | null; by: string | null };

export type DocChannelHandlers = {
  onPeers: (peers: Peer[]) => void;
  onRemoteSave: (e: RemoteSave) => void;
  onStatus?: (live: boolean) => void;
};

export interface DocChannel {
  /** My current field (null: none). */
  focus(field: string | null, fieldLabel: string | null): void;
  /** Tell the others I saved. */
  announceSaved(updatedAt: string): void;
  close(): void;
}

export type DocChannelFactory = (docId: string, me: Me & { tab: string }, handlers: DocChannelHandlers) => DocChannel;

type PresenceMeta = { userId: string; email: string | null; field: string | null; fieldLabel: string | null; tab: string };

/** The other tabs in a presence state (one entry per tab key). */
export function peersFrom(state: Record<string, PresenceMeta[] | undefined>, myTab: string): Peer[] {
  const out: Peer[] = [];
  for (const [key, metas] of Object.entries(state)) {
    const m = metas?.[metas.length - 1];
    if (!m || key === myTab) continue;
    out.push({ key, userId: m.userId, email: m.email, field: m.field ?? null, fieldLabel: m.fieldLabel ?? null });
  }
  return out.sort((a, b) => (a.email ?? '').localeCompare(b.email ?? '') || a.key.localeCompare(b.key));
}

/** The Supabase implementation. */
export const supabaseDocChannel: DocChannelFactory = (docId, me, handlers) => {
  // Older test mocks of the client have no realtime: no presence then.
  if (typeof (supabase as { channel?: unknown }).channel !== 'function') {
    return { focus() {}, announceSaved() {}, close() {} };
  }
  let meta: PresenceMeta = { userId: me.userId, email: me.email, field: null, fieldLabel: null, tab: me.tab };
  let joined = false;
  const ch = supabase.channel(`cms:doc:${docId}`, {
    config: { private: true, presence: { key: me.tab }, broadcast: { self: false } },
  });
  ch.on('presence', { event: 'sync' }, () => {
    handlers.onPeers(peersFrom(ch.presenceState() as Record<string, PresenceMeta[]>, me.tab));
  });
  ch.on('broadcast', { event: 'saved' }, (msg: { payload?: { updatedAt?: string; by?: string } }) => {
    handlers.onRemoteSave({ updatedAt: msg.payload?.updatedAt ?? null, by: msg.payload?.by ?? null });
  });
  ch.on(
    'postgres_changes' as never,
    { event: '*', schema: 'public', table: 'cms_documents', filter: `doc_id=eq.${docId}` } as never,
    (p: { new?: { updated_at?: string } }) => {
      handlers.onRemoteSave({ updatedAt: p.new?.updated_at ?? null, by: null });
    },
  );
  ch.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      joined = true;
      handlers.onStatus?.(true);
      void ch.track(meta);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      joined = false;
      handlers.onStatus?.(false);
    }
  });
  return {
    focus(field, fieldLabel) {
      meta = { ...meta, field, fieldLabel };
      if (joined) void ch.track(meta);
    },
    announceSaved(updatedAt) {
      if (joined) void ch.send({ type: 'broadcast', event: 'saved', payload: { updatedAt, by: me.email ?? me.userId } });
    },
    close() {
      void supabase.removeChannel(ch);
    },
  };
};

export const CmsRealtimeContext = createContext<DocChannelFactory>(supabaseDocChannel);

/** The signed-in editor; null outside the admin shell (no presence then). */
export const AdminUserContext = createContext<Me | null>(null);

/** A stable id for this browser tab. */
export const TAB_ID = `tab-${Math.random().toString(36).slice(2, 10)}`;

/** "elena@example.com" → "elena"; initials "EL". */
export function personName(email: string | null | undefined): string {
  if (!email) return 'Άλλο άτομο';
  return email.split('@')[0];
}

export function initials(email: string | null | undefined): string {
  const name = personName(email).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (!name) return '?';
  const parts = name.split(' ');
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

// ── An in-memory hub: two editors in one process (tests, gallery) ──
type HubMember = { docId: string; tab: string; meta: PresenceMeta; handlers: DocChannelHandlers };

export function createMemoryHub() {
  const members = new Set<HubMember>();
  const sync = (docId: string) => {
    const state: Record<string, PresenceMeta[]> = {};
    for (const m of members) if (m.docId === docId) state[m.tab] = [m.meta];
    for (const m of members) if (m.docId === docId) m.handlers.onPeers(peersFrom(state, m.tab));
  };
  const factory: DocChannelFactory = (docId, me, handlers) => {
    const member: HubMember = { docId, tab: me.tab, meta: { userId: me.userId, email: me.email, field: null, fieldLabel: null, tab: me.tab }, handlers };
    members.add(member);
    handlers.onStatus?.(true);
    sync(docId);
    return {
      focus(field, fieldLabel) {
        member.meta = { ...member.meta, field, fieldLabel };
        sync(docId);
      },
      announceSaved(updatedAt) {
        for (const m of members) if (m !== member && m.docId === docId) m.handlers.onRemoteSave({ updatedAt, by: me.email });
      },
      close() {
        members.delete(member);
        sync(docId);
      },
    };
  };
  return { factory, members };
}

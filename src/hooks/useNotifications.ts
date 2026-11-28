import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import type { Notification, Room } from '../lib/types';
import { onLive, playerTopic, roomTopic } from '../lib/liveChannel';
import { onResync } from '../lib/resync';
import { isLocalNotification, phaseNotificationFor } from '../lib/phaseNotifications';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refetchNotifications: () => Promise<void>;
}

async function fetchInto(playerId: string, add: (n: Notification) => void): Promise<void> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(50);
  // addNotification deduplicates and swaps the app's own phase entries for
  // the stored rows.
  if (data) for (const n of data) add(n as Notification);
}

/** Marks the stored row behind the app's own phase entry as read. */
function markStoredPhaseRead(n: Notification) {
  return supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('player_id', n.player_id)
    .eq('type', n.type)
    .eq('created_at', n.created_at);
}

/**
 * The bell's actions (mark read). Fetches and listens to nothing: the
 * room page runs the one feed (useNotifications), the panel only acts on
 * the shared list.
 */
export function useNotificationActions() {
  const { notifications, markNotificationRead } = useGameStore();

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        const n = useGameStore.getState().notifications.find((x) => x.id === id);
        const { error } = n && isLocalNotification(n)
          ? await markStoredPhaseRead(n)
          : await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (error) throw error;
        markNotificationRead(id);
      } catch (err) {
        console.error('[useNotifications] markAsRead failed:', err);
      }
    },
    [markNotificationRead]
  );

  const markAllRead = useCallback(async () => {
    try {
      const unread = useGameStore.getState().notifications.filter((n) => !n.is_read);
      if (unread.length === 0) return;
      const storedIds = unread.filter((n) => !isLocalNotification(n)).map((n) => n.id);
      const local = unread.filter(isLocalNotification);
      if (storedIds.length > 0) {
        const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', storedIds);
        if (error) throw error;
      }
      for (const n of local) {
        const { error } = await markStoredPhaseRead(n);
        if (error) throw error;
      }
      unread.forEach((n) => markNotificationRead(n.id));
    } catch (err) {
      console.error('[useNotifications] markAllRead failed:', err);
    }
  }, [markNotificationRead]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  return { notifications, unreadCount, markAsRead, markAllRead };
}

/**
 * The player's notifications: one fetch on entry, live pushes on the
 * player's own channel, the bell entry of a phase change from the room's
 * push (106), and one catch-up after the phone was away. Mount it once per
 * room page; the bell panel uses useNotificationActions.
 */
export function useNotifications(playerId: string | null | undefined): UseNotificationsReturn {
  const addNotification = useGameStore((s) => s.addNotification);
  const roomId = useGameStore((s) => s.room?.id ?? null);
  const actions = useNotificationActions();
  const fetchedRef = useRef<string | null>(null);

  // Existing notifications, once per player (supports rejoin).
  useEffect(() => {
    if (!playerId || fetchedRef.current === playerId) return;
    fetchedRef.current = playerId;
    void fetchInto(playerId, addNotification);
  }, [playerId, addNotification]);

  // New notifications arrive as a server push on the player's own channel.
  useEffect(() => {
    if (!playerId) return;
    return onLive<Notification>(playerTopic(playerId), 'notifications', (change) => {
      if (change.eventType === 'INSERT') addNotification(change.new);
    });
  }, [playerId, addNotification]);

  // A phase change: the server stored the bell entry but pushes only the
  // room row, so the entry is added from that push.
  useEffect(() => {
    if (!playerId || !roomId) return;
    let prev: string | null = useGameStore.getState().room?.phase ?? null;
    return onLive<Room>(roomTopic(roomId), 'rooms', (change) => {
      if (change.eventType !== 'UPDATE' || !change.new?.phase) return;
      const n = phaseNotificationFor(prev, change.new, playerId);
      prev = change.new.phase;
      if (n) addNotification(n);
    });
  }, [playerId, roomId, addNotification]);

  const refetchNotifications = useCallback(async () => {
    if (!playerId) return;
    await fetchInto(playerId, addNotification);
  }, [playerId, addNotification]);

  // After the phone was away (locked, offline), fetch what was missed once.
  useEffect(() => {
    if (!playerId) return;
    return onResync(() => { void refetchNotifications(); });
  }, [playerId, refetchNotifications]);

  return { ...actions, refetchNotifications };
}

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import type { Notification } from '../lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refetchNotifications: () => Promise<void>;
}

export function useNotifications(playerId: string | null | undefined): UseNotificationsReturn {
  const { notifications, addNotification, markNotificationRead } = useGameStore();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const fetchedRef = useRef(false);

  // Fetch existing notifications on mount (supports rejoin)
  useEffect(() => {
    if (!playerId || fetchedRef.current) return;
    fetchedRef.current = true;

    supabase
      .from('notifications')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          // Add each one (addNotification deduplicates)
          for (const n of data) {
            addNotification(n as Notification);
          }
        }
      });
  }, [playerId, addNotification]);

  // Subscribe to new notifications for this player
  useEffect(() => {
    if (!playerId) return;

    const channel = supabase
      .channel(`notifications:${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          addNotification(payload.new as Notification);
        }
      )
      .subscribe((status, err) => {
        if (err) console.error('[useNotifications] Realtime error:', status, err);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [playerId, addNotification]);

  // Polling fallback: refetch every 30s + on tab focus so the badge updates
  // even when Realtime drops or the tab was in the background.
  useEffect(() => {
    if (!playerId) return;

    const poll = () => refetchNotifications();
    const id = setInterval(poll, 30_000);

    const onVisible = () => { if (document.visibilityState === 'visible') refetchNotifications(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [playerId, refetchNotifications]);

  const refetchNotifications = useCallback(async () => {
    if (!playerId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      for (const n of data) addNotification(n as Notification);
    }
  }, [playerId, addNotification]);

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id);

        if (error) throw error;
        markNotificationRead(id);
      } catch (err) {
        console.error('[useNotifications] markAsRead failed:', err);
      }
    },
    [markNotificationRead]
  );

  const markAllRead = useCallback(async () => {
    if (!playerId) return;
    try {
      // Use store's current state directly
      const unreadIds = useGameStore.getState().notifications
        .filter((n) => !n.is_read)
        .map((n) => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (error) throw error;
      unreadIds.forEach((id) => markNotificationRead(id));
    } catch (err) {
      console.error('[useNotifications] markAllRead failed:', err);
    }
  }, [playerId, markNotificationRead]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, unreadCount, markAsRead, markAllRead, refetchNotifications };
}

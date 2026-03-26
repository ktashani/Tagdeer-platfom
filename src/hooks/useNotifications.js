'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * useNotifications hook
 * Fetches and manages notifications from the notifications table.
 * Supports real-time subscription for instant updates.
 *
 * @param {Object} options
 * @param {boolean} options.unreadOnly - Only fetch unread notifications
 * @param {number} options.limit - Max notifications to fetch
 * @returns {{ notifications, unreadCount, loading, markRead, markAllRead, refresh }}
 */
export function useNotifications({ unreadOnly = false, limit = 20 } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('notifications')
        .select('id, type, title, message, metadata, is_read, created_at')
        .eq('profile_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useNotifications] fetch error:', error.message);
        return;
      }

      setNotifications(data || []);
      setUnreadCount((data || []).filter((n) => !n.is_read).length);
    } catch (err) {
      console.error('[useNotifications] unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, limit]);

  // Mark a single notification as read
  const markRead = useCallback(async (notificationId) => {
    const { error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId,
    });

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, []);

  // Mark all notifications as read
  const markAllRead = useCallback(async () => {
    const { error } = await supabase.rpc('mark_all_notifications_read');

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    let channel;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      channel = supabase
        .channel('notifications_realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${session.user.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new, ...prev].slice(0, limit));
            setUnreadCount((prev) => prev + 1);
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [limit]);

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    refresh: fetchNotifications,
  };
}

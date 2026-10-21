import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

// Dual-tone pleasant notification chime using Web Audio API (WhatsApp-style)
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Friendly two-tone chord
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.setValueAtTime(880, now + 0.1); // A5

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  } catch (err) {
    // Audio context may require prior user interaction
  }
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [browserPermission, setBrowserPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Keep track of previously seen notification IDs to detect brand-new arrivals
  const seenIdsRef = useRef(new Set());
  const initialLoadRef = useRef(true);
  const titleIntervalRef = useRef(null);

  // Ask for Browser Notifications Permission
  const requestBrowserPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setBrowserPermission(perm);
        return perm;
      } catch (e) {
        console.warn('Failed to request notification permission:', e);
      }
    }
    return 'denied';
  }, []);

  // Dismiss a floating toast
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Trigger floating side notification (like WhatsApp) & browser notification
  const triggerNotificationAlert = useCallback((item) => {
    // 1. Play audio chime
    playNotificationChime();

    // 2. Add to side floating toasts (auto-dismisses after 7 seconds)
    const toastId = item.id || Date.now();
    const createdAtIso = item.created_at || new Date().toISOString();
    setToasts((prev) => {
      // Avoid duplicate toasts
      if (prev.some((t) => t.id === toastId)) return prev;
      return [...prev.slice(-3), { ...item, toastId, created_at: createdAtIso }]; // Keep at most 4 simultaneous toasts
    });

    // 3. Trigger native browser notification if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(item.title || 'Task Tracker Alert', {
          body: item.message || 'You have a new update in Task Tracker.',
          icon: '/Call_Astro_icon.png',
          badge: '/Call_Astro_icon.png',
          tag: `task-tracker-notif-${toastId}`,
          timestamp: new Date(createdAtIso).getTime()
        });

        notif.onclick = () => {
          window.focus();
          if (item.entity_type === 'Task' && item.entity_id) {
            setSelectedTaskId(item.entity_id);
          }
          notif.close();
        };
      } catch (err) {
        // Suppress any OS notification restrictions
      }
    }
  }, []);

  // Fetch notifications from server
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getNotifications({ limit: 40 });
      if (res && Array.isArray(res.notifications)) {
        const incoming = res.notifications;
        setNotifications(incoming);
        setUnreadCount(res.unreadCount || 0);

        // Check for new unread notifications that haven't been shown as side toasts yet
        if (!initialLoadRef.current) {
          const newUnread = incoming.filter((n) => !n.is_read && !seenIdsRef.current.has(n.id));
          if (newUnread.length > 0) {
            newUnread.forEach((item) => triggerNotificationAlert(item));
          }
        } else {
          initialLoadRef.current = false;
        }

        // Update seen IDs
        incoming.forEach((n) => seenIdsRef.current.add(n.id));
      }
    } catch (err) {
      console.warn('Notification fetch warning:', err);
    }
  }, [user, triggerNotificationAlert]);

  // Polling: fetch every 10 seconds for real-time responsiveness
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setToasts([]);
      seenIdsRef.current.clear();
      initialLoadRef.current = true;
      return;
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);

    // Also fetch immediately when window gets focus
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, fetchNotifications]);

  // Browser Tab Title Animation / Badge update
  useEffect(() => {
    if (titleIntervalRef.current) {
      clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
    }

    const baseTitle = 'Task Tracker';

    if (unreadCount <= 0) {
      document.title = baseTitle;
      return;
    }

    // When tab has unread notifications
    document.title = `(${unreadCount}) 🔔 ${baseTitle}`;

    // If tab is in the background, alternate tab title like WhatsApp/Slack
    const handleVisibility = () => {
      if (document.hidden && unreadCount > 0) {
        let toggle = false;
        if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = setInterval(() => {
          document.title = toggle
            ? `(${unreadCount}) 💬 New Alert!`
            : `(${unreadCount}) 🔔 ${baseTitle}`;
          toggle = !toggle;
        }, 1500);
      } else {
        if (titleIntervalRef.current) {
          clearInterval(titleIntervalRef.current);
          titleIntervalRef.current = null;
        }
        document.title = unreadCount > 0 ? `(${unreadCount}) 🔔 ${baseTitle}` : baseTitle;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    handleVisibility();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);
    };
  }, [unreadCount]);

  // Mark single notification as read
  const markAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  // Delete notification
  const deleteNotification = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.deleteNotification(id);
      const target = notifications.find((n) => n.id === id);
      if (target && !target.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      dismissToast(id);
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Clear all notifications
  const clearAll = async () => {
    try {
      await api.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      setToasts([]);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  // Handle clicking a notification (opens task modal if it references a task)
  const openTaskFromNotification = useCallback((item) => {
    if (!item) return;
    if (!item.is_read) {
      markAsRead(item.id);
    }
    dismissToast(item.id);

    if (item.entity_type === 'Task' && item.entity_id) {
      setSelectedTaskId(item.entity_id);
    }
  }, [markAsRead, dismissToast]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        dismissToast,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        openTaskFromNotification,
        selectedTaskId,
        setSelectedTaskId,
        browserPermission,
        requestBrowserPermission,
        triggerNotificationAlert
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

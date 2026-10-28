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
  // Keep track of previously seen notification IDs to detect brand-new arrivals
  const seenIdsRef = useRef(new Set());
  const initialLoadRef = useRef(true);
  const titleIntervalRef = useRef(null);

  // Register Service Worker for native Windows OS Notifications
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // SW registered successfully
        })
        .catch((err) => {
          console.warn('Service Worker registration skipped or failed:', err);
        });

      // Handle message from Service Worker when user clicks Windows OS notification
      const handleMessage = (event) => {
        if (event.data?.type === 'NAVIGATE_TO_TASK' && event.data?.taskId) {
          setSelectedTaskId(event.data.taskId);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  // Dismiss a floating toast (if any)
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Trigger native Windows OS Desktop Notification (just like WhatsApp)
  const triggerWindowsNotification = useCallback(async (item) => {
    // 1. Play dual-tone notification chime
    playNotificationChime();

    // 2. Check if browser supports notifications & permission is granted
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notifTitle = item.title || 'Task Tracker Alert';
    const notifBody = (item.sender_name ? `${item.sender_name}: ` : '') + (item.message || 'You have a new update in Task Tracker.');
    const iconUrl = `${window.location.origin}/notification-icon.png`;
    const toastTag = `task-tracker-notif-${item.id || Date.now()}`;
    const taskId = item.entity_type === 'Task' ? item.entity_id : null;

    const notifOptions = {
      body: notifBody,
      icon: iconUrl,
      badge: iconUrl,
      tag: toastTag,
      renotify: true,
      requireInteraction: false,
      silent: false,
      data: {
        taskId: taskId,
        url: window.location.href
      }
    };

    // Method A: Trigger via Service Worker (Best for Windows 10/11 Action Center & background alerts)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(notifTitle, notifOptions);
          return;
        }
      } catch (swErr) {
        console.warn('SW showNotification warning:', swErr);
      }
    }

    // Method B: Standard Notification API fallback
    try {
      const notif = new Notification(notifTitle, notifOptions);
      notif.onclick = () => {
        window.focus();
        if (taskId) {
          setSelectedTaskId(taskId);
        }
        notif.close();
      };
    } catch (err) {
      console.warn('Native notification display error:', err);
    }
  }, []);

  // Ask for Browser Notifications Permission
  const requestBrowserPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setBrowserPermission(perm);
        if (perm === 'granted') {
          // Immediately send a confirmation Windows notification
          setTimeout(() => {
            triggerWindowsNotification({
              id: 'perm-granted-' + Date.now(),
              title: 'Windows Notifications Enabled 🔔',
              sender_name: 'Task Tracker',
              message: 'You will now receive desktop notifications for tasks and updates just like WhatsApp!'
            });
          }, 300);
        }
        return perm;
      } catch (e) {
        console.warn('Failed to request notification permission:', e);
      }
    }
    return 'denied';
  }, [triggerWindowsNotification]);

  // Test native Windows notification immediately
  const testWindowsNotification = useCallback(async () => {
    playNotificationChime();
    let perm = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied';
    if (perm !== 'granted') {
      perm = await requestBrowserPermission();
    }
    if (perm === 'granted') {
      await triggerWindowsNotification({
        id: 'test-' + Date.now(),
        title: 'Task Tracker • Windows Alert',
        sender_name: 'System Test',
        message: 'Windows notifications are active! Real-time alerts will appear on your desktop just like WhatsApp.',
        entity_type: null,
        entity_id: null
      });
      return true;
    }
    return false;
  }, [requestBrowserPermission, triggerWindowsNotification]);

  // Fetch notifications from server
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getNotifications({ limit: 40 });
      if (res && Array.isArray(res.notifications)) {
        const incoming = res.notifications;
        setNotifications(incoming);
        setUnreadCount(res.unreadCount || 0);

        // Check for new unread notifications that haven't been shown yet
        if (!initialLoadRef.current) {
          const newUnread = incoming.filter((n) => !n.is_read && !seenIdsRef.current.has(n.id));
          if (newUnread.length > 0) {
            newUnread.forEach((item) => triggerWindowsNotification(item));
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
  }, [user, triggerWindowsNotification]);

  // Polling: fetch every 4 seconds for instant real-time Windows notifications
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
    const interval = setInterval(fetchNotifications, 4000);

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
        triggerWindowsNotification,
        triggerNotificationAlert: triggerWindowsNotification,
        testWindowsNotification
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

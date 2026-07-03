import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api.js';

const NotificationContext = createContext(undefined);

const WS_BASE = 'ws://localhost:8000';

export function NotificationProvider({ children, user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  // ── Fetch notifications ──────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get('/api/notifications/');
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setNotifications(data);
      
      const count = res.data.unread_count !== undefined 
        ? res.data.unread_count 
        : data.filter(n => !n.is_read).length;
      setUnreadCount(count);
    } catch (err) {
      console.error('[Notifications] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── WebSocket connection ──────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (!user) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_BASE}/ws/notifications/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Notifications connected');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        // Prepend incoming notification
        setNotifications(prev => [payload, ...prev]);
        setUnreadCount(prev => prev + 1);
        // Trigger toast
        setToast(payload);
        // Auto-dismiss toast after 4s
        setTimeout(() => setToast(null), 4000);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('[WS] Notifications disconnected', event.code);
      // Reconnect after 3s (skip if intentional close = 1000 or auth fail = 4001)
      if (event.code !== 1000 && event.code !== 4001 && user) {
        reconnectTimer.current = setTimeout(connectWS, 3000);
      }
    };

    ws.onerror = () => {
      // onclose handles reconnect
    };
  }, [user]);

  // ── Initialize & Clean up WebSocket ──────────────────────────────
  useEffect(() => {
    if (user) {
      fetchNotifications();
      connectWS();
    } else {
      // Clean up on logout
      setNotifications([]);
      setUnreadCount(0);
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
      clearTimeout(reconnectTimer.current);
    }

    return () => {
      // Unmount cleanup
      clearTimeout(reconnectTimer.current);
    };
  }, [user, fetchNotifications, connectWS]);

  // ── Actions ───────────────────────────────────────────────────────
  const markAsRead = useCallback(async (id) => {
    try {
      await api.post(`/api/notifications/${id}/read/`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[Notifications] Mark read failed:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.post('/api/notifications/read-all/');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[Notifications] Mark all read failed:', err);
    }
  }, []);

  const deleteNotification = useCallback(async (id) => {
    try {
      await api.delete(`/api/notifications/${id}/`);
      setNotifications(prev => {
        const item = prev.find(n => n.id === id);
        const wasUnread = item && !item.is_read;
        if (wasUnread) {
          setUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.filter(n => n.id !== id);
      });
    } catch (err) {
      console.error('[Notifications] Delete notification failed:', err);
    }
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const value = {
    notifications,
    unreadCount,
    loading,
    toast,
    markAsRead,
    markAllRead,
    deleteNotification,
    dismissToast,
    refetch: fetchNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}

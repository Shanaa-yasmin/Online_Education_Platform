/**
 * useNotifications — custom hook for real-time notification management.
 *
 * Features:
 *  - Fetches notifications via REST on mount
 *  - Connects to WebSocket for live push updates
 *  - Exposes unread count, list, mark-read, and mark-all-read actions
 *  - Auto-reconnects WebSocket on disconnect
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api.js';

const WS_BASE = 'ws://localhost:8000';

export default function useNotifications(user) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null); // latest incoming notification for toast
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  // ── Fetch initial notifications via REST ──────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/notifications/');
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('[Notifications] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── WebSocket connection ──────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (!user) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Close existing connection
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
      if (event.code !== 1000 && event.code !== 4001) {
        reconnectTimer.current = setTimeout(connectWS, 3000);
      }
    };

    ws.onerror = () => {
      // onclose will fire after this, which handles reconnect
    };
  }, [user]);

  // ── Lifecycle ─────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      fetchNotifications();
      connectWS();
    }

    return () => {
      if (wsRef.current) wsRef.current.close(1000);
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

  const dismissToast = useCallback(() => setToast(null), []);

  return {
    notifications,
    unreadCount,
    loading,
    toast,
    markAsRead,
    markAllRead,
    dismissToast,
    refetch: fetchNotifications,
  };
}

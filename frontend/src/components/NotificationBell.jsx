/**
 * NotificationBell — topbar bell icon with badge + dropdown + toast.
 *
 * Props:
 *   user {object} - current authenticated user (from useAuth)
 *
 * Drop this component into any topbar-right div.
 */
import { useState, useRef, useEffect, memo } from 'react';
import useNotifications from '../hooks/useNotifications.js';
import './NotificationBell.css';

function NotificationBell({ user }) {
  const {
    notifications,
    unreadCount,
    loading,
    toast,
    markAsRead,
    markAllRead,
    dismissToast,
  } = useNotifications(user);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // ── Close dropdown on outside click ────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Time-ago helper ────────────────────────────────────────────────
  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // ── Notification type → icon mapping ───────────────────────────────
  const typeIcon = (type) => {
    switch (type) {
      case 'ENROLLMENT':  return 'ti-school';
      case 'LESSON_ADDED': return 'ti-book';
      case 'QNA_REPLY':    return 'ti-message-circle';
      case 'REFUND':       return 'ti-receipt-refund';
      case 'SYSTEM':       return 'ti-info-circle';
      default:             return 'ti-bell';
    }
  };

  return (
    <>
      {/* ── Bell Button ─────────────────────────────────────────── */}
      <div className="nb-wrap" ref={wrapRef}>
        <button
          className="topbar-icon-btn nb-trigger"
          onClick={() => setOpen(prev => !prev)}
          aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
          aria-expanded={open}
        >
          <i className="ti ti-bell" />
          {unreadCount > 0 && (
            <span className="nb-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        {/* ── Dropdown ────────────────────────────────────────────── */}
        {open && (
          <div className="nb-dropdown" role="dialog" aria-label="Notifications">
            <div className="nb-header">
              <h3 className="nb-title">
                Notifications
                {unreadCount > 0 && <span className="nb-title-count">{unreadCount}</span>}
              </h3>
              {unreadCount > 0 && (
                <button className="nb-mark-all" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
            </div>

            <div className="nb-list">
              {loading && (
                <div className="nb-empty">
                  <span className="nb-spinner" />
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="nb-empty">
                  <i className="ti ti-bell-off nb-empty-icon" />
                  <p>No notifications yet</p>
                </div>
              )}

              {!loading && notifications.slice(0, 20).map(n => (
                <button
                  key={n.id}
                  className={`nb-item ${n.is_read ? '' : 'nb-item--unread'}`}
                  onClick={() => {
                    if (!n.is_read) markAsRead(n.id);
                  }}
                >
                  <div className={`nb-item-icon nb-icon--${(n.notification_type || 'system').toLowerCase()}`}>
                    <i className={`ti ${typeIcon(n.notification_type)}`} />
                  </div>
                  <div className="nb-item-body">
                    <p className="nb-item-title">{n.title}</p>
                    <p className="nb-item-msg">{n.message}</p>
                    <span className="nb-item-time">{timeAgo(n.created_at)}</span>
                  </div>
                  {!n.is_read && <span className="nb-item-dot" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Toast ──────────────────────────────────────────────────── */}
      {toast && (
        <div className="nb-toast" role="alert" onClick={dismissToast}>
          <div className={`nb-toast-icon nb-icon--${(toast.notification_type || 'system').toLowerCase()}`}>
            <i className={`ti ${typeIcon(toast.notification_type)}`} />
          </div>
          <div className="nb-toast-body">
            <p className="nb-toast-title">{toast.title}</p>
            <p className="nb-toast-msg">{toast.message}</p>
          </div>
          <button className="nb-toast-close" aria-label="Dismiss">
            <i className="ti ti-x" />
          </button>
        </div>
      )}
    </>
  );
}

export default memo(NotificationBell);

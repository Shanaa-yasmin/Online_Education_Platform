import { useState, useRef, useEffect, memo } from 'react';
import useNotifications from '../hooks/useNotifications.js';
import NotificationDropdown from './NotificationDropdown.jsx';
import './NotificationBell.css';

function NotificationBell({ user }) {
  const { unreadCount, toast, dismissToast } = useNotifications();
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

  // ── Notification type → icon mapping for toast ─────────────────────
  const typeIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'ENROLLMENT': return 'ti-school';
      case 'LESSON_ADDED': return 'ti-book';
      case 'QUESTION_REPLY':
      case 'QNA_REPLY': return 'ti-message-circle';
      case 'PAYMENT_SUCCESS':
      case 'REFUND_PROCESSED':
      case 'REFUND': return 'ti-receipt-refund';
      case 'CERTIFICATE_GENERATED': return 'ti-award';
      case 'COURSE_APPROVED':
      case 'MENTOR_APPROVED': return 'ti-circle-check';
      case 'COURSE_REJECTED': return 'ti-circle-x';
      default: return 'ti-bell';
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
          <NotificationDropdown onClose={() => setOpen(false)} user={user} />
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

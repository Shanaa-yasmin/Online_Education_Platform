import { useNavigate } from 'react-router-dom';
import useNotifications from '../hooks/useNotifications.js';

export default function NotificationCard({ notification, onClickItem, onDelete, user }) {
  const navigate = useNavigate();
  const { markAsRead, deleteNotification } = useNotifications();

  const isRead = notification.is_read;

  // ── Relative Timestamp ────────────────────────────────────────────
  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // ── Notification Type → Emoji mapping ──────────────────────────────
  const getTypeEmoji = (type) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'ENROLLMENT':
        return '👨‍🎓';
      case 'NEW_REVIEW':
        return '⭐';
      case 'PAYMENT_SUCCESS':
      case 'REFUND_PROCESSED':
      case 'REFUND':
        return '💳';
      case 'CERTIFICATE_GENERATED':
        return '🏆';
      case 'NEW_QUESTION':
      case 'QUESTION_REPLY':
      case 'QNA_REPLY':
        return '💬';
      case 'COURSE_APPROVED':
      case 'MENTOR_APPROVED':
        return '✅';
      case 'COURSE_REJECTED':
        return '❌';
      case 'COURSE_PENDING_APPROVAL':
        return '🕓';
      case 'LESSON_ADDED':
        return '📚';
      case 'COURSE_UPDATED':
        return '📝';
      default:
        return '🔔';
    }
  };

  // ── Deep Linking Router mapping ──────────────────────────────────
  const handleNavigate = () => {
    const type = (notification.notification_type || '').toUpperCase();
    const id = notification.related_object_id;

    let path = '/notifications';

    switch (type) {
      case 'ENROLLMENT':
      case 'COURSE_APPROVED':
      case 'COURSE_REJECTED':
        path = id ? `/mentor/courses/${id}/builder` : '/mentor/dashboard';
        break;
      case 'COURSE_PENDING_APPROVAL':
        path = '/admin/portal?tab=courses';
        break;
      case 'QUESTION_REPLY':
      case 'QNA_REPLY':
        path = id ? `/courses/${id}/learn?tab=qa` : '/dashboard';
        break;
      case 'NEW_REVIEW':
        path = id ? `/courses/${id}#reviews` : '/courses';
        break;
      case 'CERTIFICATE_GENERATED':
        path = '/dashboard';
        break;
      case 'PAYMENT_SUCCESS':
      case 'REFUND_PROCESSED':
      case 'REFUND':
        // Admins receive these for oversight; mentors for their own course sales.
        path = notification.recipient_role === 'ADMIN'
          ? '/admin/portal?tab=payments'
          : '/mentor/dashboard?tab=payments';
        break;
      case 'LESSON_ADDED':
        path = id ? `/courses/${id}/learn` : '/courses';
        break;
      case 'COURSE_UPDATED':
        path = id ? `/courses/${id}` : '/courses';
        break;
      case 'MENTOR_APPROVED':
        path = '/mentor/dashboard';
        break;
      default:
        path = '/notifications';
        break;
    }

    navigate(path);
  };

  const handleClick = (e) => {
    // Avoid double navigation or trigger if action buttons clicked
    if (e.target.closest('.nc-delete-btn')) return;

    if (!isRead) {
      // Trigger API read state in background without blocking UI navigation
      markAsRead(notification.id);
    }

    // Execute routing transition immediately
    handleNavigate();

    if (onClickItem) {
      onClickItem();
    }
  };

  return (
    <div
      className={`nc-card ${isRead ? '' : 'nc-card--unread'}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Notification: ${notification.title}. ${notification.message}. ${isRead ? 'Read' : 'Unread'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e);
        }
      }}
    >
      <div className="nc-emoji-wrapper">
        <span className="nc-emoji" role="img" aria-hidden="true">
          {getTypeEmoji(notification.notification_type)}
        </span>
      </div>
      <div className="nc-content">
        <div className="nc-header-row">
          <h4 className="nc-title">{notification.title}</h4>
          <span className="nc-time">{timeAgo(notification.created_at)}</span>
        </div>
        <p className="nc-message">{notification.message}</p>
      </div>
      <div className="nc-status-indicator">
        {!isRead && <span className="nc-unread-dot" />}
        <button
          className="nc-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            deleteNotification(notification.id);
            if (onDelete) {
              onDelete(notification.id);
            }
          }}
          aria-label="Delete notification"
        >
          <i className="ti ti-trash" />
        </button>
      </div>
    </div>
  );
}

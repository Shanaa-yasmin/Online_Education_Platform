import { Link } from 'react-router-dom';
import useNotifications from '../hooks/useNotifications.js';
import NotificationCard from './NotificationCard.jsx';
import NotificationSkeleton from './NotificationSkeleton.jsx';

export default function NotificationDropdown({ onClose, user }) {
  const {
    notifications,
    unreadCount,
    loading,
    markAllRead,
  } = useNotifications();

  // Show only top 8 notifications in the quick dropdown
  const quickList = notifications.slice(0, 8);

  return (
    <div className="nd-dropdown" role="dialog" aria-label="Notifications Dropdown">
      <div className="nd-header">
        <h3 className="nd-title">
          Notifications
          {unreadCount > 0 && <span className="nd-unread-badge">{unreadCount}</span>}
        </h3>
        {unreadCount > 0 && (
          <button className="nd-mark-all-btn" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>

      <div className="nd-body">
        {loading && <NotificationSkeleton count={3} />}

        {!loading && notifications.length === 0 && (
          <div className="nd-empty-state">
            <i className="ti ti-bell-off nd-empty-icon" />
            <p className="nd-empty-text">You have no notifications yet.</p>
            <p className="nd-empty-sub">We'll alert you when something happens.</p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div className="nd-list">
            {quickList.map((n) => (
              <NotificationCard
                key={n.id}
                notification={n}
                onClickItem={onClose}
                user={user}
              />
            ))}
          </div>
        )}
      </div>

      <div className="nd-footer">
        <Link to="/notifications" className="nd-view-all-link" onClick={onClose}>
          View all notifications
        </Link>
      </div>
    </div>
  );
}

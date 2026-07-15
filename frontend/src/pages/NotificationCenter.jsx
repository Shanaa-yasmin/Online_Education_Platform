import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import useNotifications from '../hooks/useNotifications.js';
import NotificationCard from '../components/NotificationCard.jsx';
import NotificationSkeleton from '../components/NotificationSkeleton.jsx';
import Sidebar from '../components/Sidebar.jsx';
import './NotificationCenter.css';

export default function NotificationCenter() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const {
    notifications: globalNotifications,
    unreadCount,
    markAsRead,
    markAllRead,
    deleteNotification,
  } = useNotifications();

  // ── States ──────────────────────────────────────────────────────────
  const [localNotifications, setLocalNotifications] = useState([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState('all'); // all, read, unread
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const isMentor = user?.role === 'MENTOR';
  const isAdmin  = user?.role === 'ADMIN';
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  // ── Debounce Search Query ──────────────────────────────────────────
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset page on search change
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // ── Fetch Notifications from API ────────────────────────────────────
  const fetchLocalNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLocalLoading(true);
      let url = `/api/notifications/?page=${currentPage}`;
      if (filter === 'read') {
        url += '&is_read=true';
      } else if (filter === 'unread') {
        url += '&is_read=false';
      }
      if (debouncedSearch) {
        url += `&search=${encodeURIComponent(debouncedSearch)}`;
      }
      const res = await api.get(url);
      const data = res.data;
      setLocalNotifications(data.results || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      console.error('[NotificationCenter] Failed to fetch notifications:', err);
    } finally {
      setLocalLoading(false);
    }
  }, [user, currentPage, filter, debouncedSearch]);

  useEffect(() => {
    fetchLocalNotifications();
  }, [fetchLocalNotifications]);

  // ── Listen to Live WebSocket Notifications ──────────────────────────
  const prevGlobalFirstId = useRef(null);
  useEffect(() => {
    if (globalNotifications.length > 0) {
      const first = globalNotifications[0];
      if (prevGlobalFirstId.current && first.id !== prevGlobalFirstId.current) {
        // A new notification arrived through WS
        // If we are on page 1 and no search query, prepend it to local view
        if (currentPage === 1 && !searchQuery) {
          setLocalNotifications(prev => {
            if (prev.some(n => n.id === first.id)) return prev;
            // Prepend new and slice to PAGE_SIZE
            const updated = [first, ...prev];
            if (updated.length > PAGE_SIZE) {
              updated.pop();
            }
            return updated;
          });
          setTotalCount(c => c + 1);
        } else {
          // Otherwise trigger a silent update/refetch or count increment
          setTotalCount(c => c + 1);
        }
      }
      prevGlobalFirstId.current = first.id;
    } else {
      prevGlobalFirstId.current = null;
    }
  }, [globalNotifications, currentPage, searchQuery]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleMarkAsRead = async (id) => {
    await markAsRead(id);
    setLocalNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  };

  const handleDelete = (id) => {
    setLocalNotifications(prev => prev.filter(n => n.id !== id));
    setTotalCount(c => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    try {
      setIsMarkingAll(true);
      await markAllRead();
      setLocalNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
    } catch (err) {
      console.error('[NotificationCenter] Mark all read failed:', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  // Determine empty state message based on filter
  const getEmptyStateContent = () => {
    if (filter === 'unread') {
      return {
        title: "You're all caught up.",
        sub: "No unread notifications to display."
      };
    }
    return {
      title: "You have no notifications yet.",
      sub: "We'll alert you when something happens."
    };
  };

  return (
    <div className="dashboard-page">
      {/* Sidebar Layout */}
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} active="" />

      {/* Main Container */}
      <div className="dashboard-main">
        {/* Topbar */}

        {/* Dedicated Page Content */}
        <div className="inner-content">
          <div className="nce-container animate-fadeIn">
            {/* Filter and Search Bar */}
            <div className="nce-bar">
              <div className="nce-filters">
                <button
                  className={`nce-tab ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => { setFilter('all'); setCurrentPage(1); }}
                  aria-label="Show all notifications"
                >
                  All
                </button>
                <button
                  className={`nce-tab ${filter === 'unread' ? 'active' : ''}`}
                  onClick={() => { setFilter('unread'); setCurrentPage(1); }}
                  aria-label="Show unread notifications only"
                >
                  Unread {unreadCount > 0 && <span className="nce-tab-count">{unreadCount}</span>}
                </button>
                <button
                  className={`nce-tab ${filter === 'read' ? 'active' : ''}`}
                  onClick={() => { setFilter('read'); setCurrentPage(1); }}
                  aria-label="Show read notifications only"
                >
                  Read
                </button>
              </div>

              <div className="nce-search-wrapper">
                <i className="ti ti-search nce-search-icon" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="nce-search-input"
                  aria-label="Search notifications"
                />
              </div>
            </div>

            {/* Actions Bar */}
            <div className="nce-actions">
              <span className="nce-results-count">
                {localLoading ? 'Loading notifications...' : `${totalCount} notifications found`}
              </span>
              {unreadCount > 0 && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleMarkAllRead}
                  disabled={isMarkingAll}
                  aria-label="Mark all visible notifications as read"
                >
                  <i className="ti ti-checks" /> Mark all as read
                </button>
              )}
            </div>

            {/* List Body */}
            <div className="nce-body-card">
              {localLoading ? (
                <NotificationSkeleton count={4} />
              ) : localNotifications.length === 0 ? (
                <div className="nce-empty-state">
                  <i className="ti ti-bell-off nce-empty-icon" />
                  <h3 className="nce-empty-text">{getEmptyStateContent().title}</h3>
                  <p className="nce-empty-sub">{getEmptyStateContent().sub}</p>
                </div>
              ) : (
                <div className="nce-list">
                  {localNotifications.map((n) => (
                    <NotificationCard
                      key={n.id}
                      notification={n}
                      onClickItem={() => handleMarkAsRead(n.id)}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {!localLoading && totalPages > 1 && (
              <div className="nce-pagination">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <i className="ti ti-chevron-left" /> Previous
                </button>
                <span className="nce-pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next <i className="ti ti-chevron-right" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

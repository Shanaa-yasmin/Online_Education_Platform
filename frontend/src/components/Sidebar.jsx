import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import NotificationBell from './NotificationBell.jsx';
import SearchAutocomplete from './SearchAutocomplete.jsx';

const NAV_ITEMS = [
  { key: 'dashboard',       to: '/dashboard',        icon: 'ti ti-layout-dashboard', label: 'Dashboard',    roles: 'all' },
  { key: 'courses',         to: '/courses',          icon: 'ti ti-book',             label: 'Explore Courses', roles: 'all' },
  { key: 'admin-portal',    to: '/admin/portal',     icon: 'ti ti-settings',         label: 'Admin Portal', roles: ['ADMIN'] },
  { key: 'admin-reports',   to: '/admin/reports',    icon: 'ti ti-chart-bar',        label: 'Reports',      roles: ['ADMIN'] },
  { key: 'my-courses',      to: '/my-courses',       icon: 'ti ti-notebook',         label: 'My Courses',   roles: ['STUDENT', 'MENTOR'] },
  { key: 'mentor-qa',       to: '/mentor/qa',        icon: 'ti ti-messages',         label: 'Q&A',          roles: ['MENTOR'] },
  { key: 'mentor-payments', to: '/mentor/payments',  icon: 'ti ti-wallet',           label: 'Payment Logs', roles: ['MENTOR', 'ADMIN'] },
  { key: 'mentor-analytics',to: '/mentor/analytics', icon: 'ti ti-chart-pie',        label: 'Analytics',    roles: ['MENTOR'] },
  { key: 'announcements',   to: '/announcements',    icon: 'ti ti-speakerphone',     label: 'Announcements',roles: 'all' },
  { key: 'profile',         to: '/profile',          icon: 'ti ti-user',             label: 'Profile',      roles: 'all' },
];

function getInitials(user) {
  if (!user) return '?';
  return (user.username || user.email || '?').slice(0, 2).toUpperCase();
}

export default function Sidebar({ user, onLogout, loggingOut, active }) {
  const role = user?.role;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [drawerOpen]);

  const isVisible = (item) => {
    if (item.roles === 'all') return true;
    return item.roles.includes(role);
  };

  const visibleItems = NAV_ITEMS.filter(isVisible);

  return (
    <>
      <aside className="sidebar">
        {/* Clickable Logo that triggers Sidebar Drawer */}
        <div className="sidebar-logo-area">
          <button
            className="nav-logo-trigger"
            onClick={() => setDrawerOpen(v => !v)}
            aria-expanded={drawerOpen}
            aria-label="Toggle navigation drawer"
          >
            <i className="ti ti-menu-2 logo-menu-icon" />
            <img src="/favicon.jpeg" alt="EduPath Logo" className="logo-img" />
            <span className="nav-logo-text">Edu<span>Path</span></span>
          </button>
        </div>

        {/* Right actions (Search, Bell & Profile) */}
        <div className="sidebar-right-actions">
          <SearchAutocomplete variant="topbar" placeholder="Search courses…" />
          {user && <NotificationBell user={user} />}

          {user && (
            <Link to="/profile" className="sidebar-profile-link">
              <div className="avatar-initials avatar-initials-sm">
                {getInitials(user)}
              </div>
              <span className="sidebar-username">{user.username}</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Backdrop overlay */}
      {drawerOpen && (
        <div
          className="sidebar-backdrop-overlay"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Slide-out Sidebar Drawer */}
      <div
        className={`sidebar-drawer${drawerOpen ? ' open' : ''}`}
        ref={drawerRef}
      >
        <div className="drawer-header">
          <div className="nav-logo">
            <img src="/favicon.jpeg" alt="EduPath Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
            <span className="nav-logo-text">Edu<span>Path</span></span>
          </div>
          <button
            className="drawer-close-btn"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>

        <nav className="drawer-nav">
          {visibleItems.map((item) => {
            const isActive = active === item.key;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={`drawer-nav-item${isActive ? ' active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setDrawerOpen(false)}
              >
                <i className={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="drawer-footer">
          <button
            className="drawer-logout-btn"
            onClick={() => { setDrawerOpen(false); onLogout(); }}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <><span className="loading-spinner loading-spinner-sm" />Signing out…</>
            ) : (
              <><i className="ti ti-logout" /><span>Sign out</span></>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
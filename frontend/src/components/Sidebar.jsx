import { Link } from 'react-router-dom';

const NAV_ITEMS = [
  { key: 'dashboard', to: '/dashboard', icon: 'ti ti-layout-dashboard', label: 'Dashboard', roles: 'all' },
  { key: 'mentor', to: '/mentor/dashboard', icon: 'ti ti-award', label: 'Mentor Portal', roles: ['MENTOR', 'ADMIN'] },
  { key: 'admin-portal', to: '/admin/portal', icon: 'ti ti-settings', label: 'Admin Portal', roles: ['ADMIN'] },
  { key: 'admin-reports', to: '/admin/reports', icon: 'ti ti-chart-bar', label: 'Reports', roles: ['ADMIN'] },
  { key: 'courses', to: '/courses', icon: 'ti ti-book', label: 'Courses', roles: 'all' },
  { key: 'profile', to: '/profile', icon: 'ti ti-user', label: 'Profile', roles: 'all' },
];

export default function Sidebar({ user, onLogout, loggingOut, active }) {
  const role = user?.role;

  const isVisible = (item) => {
    if (item.roles === 'all') return true;
    return item.roles.includes(role);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo-area">
        <Link to="/" className="nav-logo">
          <img src="/favicon.jpeg" alt="EduPath Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
          <span className="nav-logo-text">Edu<span>Path</span></span>
        </Link>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.filter(isVisible).map((item) => {
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              to={item.to}
              className={`sidebar-nav-item${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <i className={item.icon} /> {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? <><span className="loading-spinner loading-spinner-sm" />Signing out…</> : <><i className="ti ti-logout" />Sign out</>}
        </button>
      </div>
    </aside>
  );
}
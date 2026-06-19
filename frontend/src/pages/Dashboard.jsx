import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import './Dashboard.css';

// Icons
const BookOpenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const TrendingUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);
const AwardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6"/>
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);
const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" x2="9" y1="12" y2="12"/>
  </svg>
);
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19"/>
    <line x1="5" x2="19" y1="12" y2="12"/>
  </svg>
);

// Placeholder data for dashboard
const STUDENT_STATS = [
  { icon: <BookOpenIcon />, label: 'Enrolled Courses', value: '0', color: 'blue' },
  { icon: <TrendingUpIcon />, label: 'In Progress',    value: '0', color: 'purple' },
  { icon: <AwardIcon />,     label: 'Completed',       value: '0', color: 'green' },
  { icon: <ClockIcon />,     label: 'Hours Learned',   value: '0', color: 'pink' },
];
const MENTOR_STATS = [
  { icon: <BookOpenIcon />, label: 'My Courses',      value: '0', color: 'purple' },
  { icon: <UserIcon />,     label: 'Total Students',  value: '0', color: 'blue' },
  { icon: <TrendingUpIcon />,label: 'Published',      value: '0', color: 'green' },
  { icon: <ClockIcon />,    label: 'Avg. Rating',     value: '—', color: 'pink' },
];

function getInitials(user) {
  if (!user) return '?';
  if (user.username) return user.username.slice(0, 2).toUpperCase();
  return user.email?.slice(0, 2).toUpperCase() || '??';
}

function getRoleBadgeClass(role) {
  if (!role) return 'badge-student';
  return `badge-${role.toLowerCase()}`;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const stats = user?.role === 'MENTOR' ? MENTOR_STATS : STUDENT_STATS;
  const isMentor = user?.role === 'MENTOR';
  const isAdmin  = user?.role === 'ADMIN';

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-page">
      {/* Sidebar */}
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="dash-logo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7c3aed"/>
                <stop offset="1" stopColor="#ec4899"/>
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="10" fill="url(#dash-logo)"/>
            <path d="M8 22 L12 10 L16 18 L20 12 L24 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          <span className="sidebar-logo-text">EduPath</span>
        </div>

        <nav className="sidebar-nav">
          <Link to="/dashboard" className="sidebar-nav-item active" id="nav-dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
            Dashboard
          </Link>
          {(isMentor || isAdmin) && (
            <Link to="/mentor/dashboard" className="sidebar-nav-item" id="nav-mentor">
              <AwardIcon />
              Mentor Portal
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin/portal" className="sidebar-nav-item" id="nav-admin-panel">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              Admin Portal
            </Link>
          )}
          <Link to="/courses" className="sidebar-nav-item" id="nav-courses">
            <BookOpenIcon />
            Courses
          </Link>
          <Link to="/profile" className="sidebar-nav-item" id="nav-profile">
            <UserIcon />
            Profile
          </Link>
        </nav>

        <div className="sidebar-footer">
          <button
            id="logout-btn"
            className="sidebar-logout-btn"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? <span className="loading-spinner loading-spinner-sm" /> : <LogoutIcon />}
            {loggingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        {/* Top bar */}
        <header className="dashboard-topbar">
          <div className="topbar-greeting">
            <h1 className="topbar-title">
              {isAdmin ? 'Admin Panel' : isMentor ? 'Mentor Dashboard' : 'My Learning'}
            </h1>
            <p className="topbar-subtitle">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="topbar-actions">
            <button className="topbar-icon-btn" id="notifications-btn" aria-label="Notifications">
              <BellIcon />
              <span className="notif-dot" />
            </button>
            <Link to="/profile" className="topbar-user" id="profile-quick-link">
              <div className="avatar-initials" style={{ width: 36, height: 36, fontSize: '0.85rem' }}>
                {getInitials(user)}
              </div>
              <div className="topbar-user-info">
                <span className="topbar-user-name">{user?.username || 'User'}</span>
                <span className={`badge ${getRoleBadgeClass(user?.role)}`}>{user?.role || 'Student'}</span>
              </div>
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="dashboard-content">

          {/* Welcome banner */}
          <section className="welcome-banner animate-fadeIn">
            <div className="welcome-text">
              <h2 className="welcome-heading">
                Welcome back, <span className="text-gradient">{user?.username || 'Learner'}</span> 👋
              </h2>
              <p className="welcome-body">
                {isMentor
                  ? 'Manage your courses, track student engagement, and grow your audience.'
                  : 'Pick up where you left off, explore new courses, and keep growing.'}
              </p>
              {isMentor && (
                <div className="banner-actions">
                  <button className="btn btn-primary btn-sm" id="create-course-btn">
                    <PlusIcon /> Create Course
                  </button>
                </div>
              )}
            </div>
            <div className="welcome-illustration" aria-hidden="true">
              {isMentor ? '🏆' : '🎓'}
            </div>
          </section>

          {/* Mentor approval notice */}
          {isMentor && !user?.is_approved && (
            <div className="alert alert-warning animate-fadeIn delay-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
              <div>
                <strong>Account pending approval.</strong> Your mentor account is under review. You'll be notified once approved by an admin.
              </div>
            </div>
          )}

          {/* Stats grid */}
          <section className="stats-grid animate-fadeIn delay-2">
            {stats.map((stat, i) => (
              <div key={stat.label} className={`stat-card stat-card-${stat.color} animate-fadeIn delay-${i + 1}`}>
                <div className="stat-icon">{stat.icon}</div>
                <div className="stat-info">
                  <span className="stat-value">{stat.value}</span>
                  <span className="stat-label">{stat.label}</span>
                </div>
              </div>
            ))}
          </section>

          {/* Content sections */}
          <div className="dashboard-sections">
            {/* Recent activity */}
            <section className="section-card animate-fadeIn delay-3">
              <div className="section-header">
                <h3 className="section-title">
                  {isMentor ? 'My Courses' : 'Continue Learning'}
                </h3>
                <Link to="/courses" className="section-link">View all →</Link>
              </div>
              <div className="empty-state">
                <div className="empty-icon">{isMentor ? '📚' : '🎯'}</div>
                <p className="empty-title">
                  {isMentor ? 'No courses yet' : 'No courses in progress'}
                </p>
                <p className="empty-desc">
                  {isMentor
                    ? 'Create your first course to start teaching students.'
                    : 'Browse our catalog and enroll in a course to get started.'}
                </p>
                <button className="btn btn-secondary btn-sm" id="explore-courses-btn">
                  {isMentor ? 'Create a course' : 'Explore courses'}
                </button>
              </div>
            </section>

            {/* Quick links */}
            <section className="section-card animate-fadeIn delay-4">
              <div className="section-header">
                <h3 className="section-title">Quick Access</h3>
              </div>
              <div className="quick-links">
                <Link to="/profile" className="quick-link-item" id="quick-profile-link">
                  <div className="quick-link-icon" style={{ background: 'rgba(124,58,237,0.15)', color: 'var(--brand-400)' }}>
                    <UserIcon />
                  </div>
                  <div>
                    <p className="quick-link-name">My Profile</p>
                    <p className="quick-link-desc">Update your info &amp; avatar</p>
                  </div>
                </Link>
                <Link to="/courses" className="quick-link-item" id="quick-courses-link">
                  <div className="quick-link-icon" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--info)' }}>
                    <BookOpenIcon />
                  </div>
                  <div>
                    <p className="quick-link-name">Course Catalog</p>
                    <p className="quick-link-desc">Browse all available courses</p>
                  </div>
                </Link>
                <div className="quick-link-item" id="quick-achievements-link" style={{ cursor: 'default' }}>
                  <div className="quick-link-icon" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}>
                    <AwardIcon />
                  </div>
                  <div>
                    <p className="quick-link-name">Achievements</p>
                    <p className="quick-link-desc">Coming in Phase 8</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

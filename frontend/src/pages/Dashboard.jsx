import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import './Dashboard.css';

function getInitials(user) {
  if (!user) return '?';
  return (user.username || user.email || '?').slice(0, 2).toUpperCase();
}

const STUDENT_STATS = [
  { icon: 'ti-book', label: 'Enrolled',  value: '0', color: '#309D8E', bg: 'rgba(48,157,142,0.1)' },
  { icon: 'ti-player-play', label: 'In Progress', value: '0', color: '#2563eb', bg: '#eff4fe' },
  { icon: 'ti-award', label: 'Completed', value: '0', color: '#2a9d6e', bg: '#edfaf4' },
  { icon: 'ti-clock', label: 'Hours Learned', value: '0', color: '#d97706', bg: '#fef9ec' },
];
const MENTOR_STATS = [
  { icon: 'ti-book', label: 'My Courses',     value: '0', color: '#309D8E', bg: 'rgba(48,157,142,0.1)' },
  { icon: 'ti-users', label: 'Total Students', value: '0', color: '#2563eb', bg: '#eff4fe' },
  { icon: 'ti-circle-check', label: 'Published', value: '0', color: '#2a9d6e', bg: '#edfaf4' },
  { icon: 'ti-star', label: 'Avg. Rating',     value: '—', color: '#d97706', bg: '#fef9ec' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const isMentor = user?.role === 'MENTOR';
  const isAdmin  = user?.role === 'ADMIN';
  const stats    = isMentor ? MENTOR_STATS : STUDENT_STATS;

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-page">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo-area">
          <Link to="/" className="nav-logo" style={{textDecoration:'none'}}>
            <div className="nav-logo-mark"><i className="ti ti-trending-up" /></div>
            <span className="nav-logo-text">Edu<span>Path</span></span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <Link to="/dashboard" className="sidebar-nav-item active">
            <i className="ti ti-layout-dashboard" /> Dashboard
          </Link>
          {(isMentor || isAdmin) && (
            <Link to="/mentor/dashboard" className="sidebar-nav-item">
              <i className="ti ti-award" /> Mentor Portal
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin/portal" className="sidebar-nav-item">
              <i className="ti ti-settings" /> Admin Portal
            </Link>
          )}
          <Link to="/courses" className="sidebar-nav-item">
            <i className="ti ti-book" /> Courses
          </Link>
          <Link to="/profile" className="sidebar-nav-item">
            <i className="ti ti-user" /> Profile
          </Link>
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut
              ? <><span className="loading-spinner loading-spinner-sm" /> Signing out…</>
              : <><i className="ti ti-logout" /> Sign out</>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="dashboard-main">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1>{isAdmin ? 'Admin Dashboard' : isMentor ? 'Mentor Dashboard' : 'My Learning'}</h1>
            <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="topbar-right">
            <button className="topbar-icon-btn">
              <i className="ti ti-bell" />
              <span className="notif-dot" />
            </button>
            <Link to="/profile" className="topbar-user">
              <div className="avatar-initials" style={{width:30,height:30,fontSize:12}}>
                {getInitials(user)}
              </div>
              <span className="topbar-user-name">{user?.username}</span>
              <span className={`badge badge-${(user?.role||'student').toLowerCase()}`}>{user?.role}</span>
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="inner-content">

          {/* Welcome banner */}
          <section className="welcome-banner animate-fadeIn">
            <div className="welcome-text">
              <h2 className="welcome-h">Welcome back, {user?.username} 👋</h2>
              <p className="welcome-p">
                {isMentor
                  ? 'Manage your courses, track student engagement, and grow your audience.'
                  : 'Pick up where you left off, explore new courses, and keep growing.'}
              </p>
              {isMentor ? (
                <button className="btn btn-primary btn-sm" style={{background:'#fff',color:'var(--brand)',borderColor:'transparent'}}
                  onClick={() => navigate('/mentor/dashboard')}>
                  <i className="ti ti-plus" /> Create Course
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" style={{background:'#fff',color:'var(--brand)',borderColor:'transparent'}}
                  onClick={() => navigate('/courses')}>
                  <i className="ti ti-compass" /> Explore Courses
                </button>
              )}
            </div>
            <div className="welcome-emoji">{isMentor ? '🏆' : '🎓'}</div>
          </section>

          {/* Mentor pending notice */}
          {isMentor && !user?.is_approved && (
            <div className="alert alert-warning animate-fadeIn">
              <i className="ti ti-alert-triangle" />
              <div><strong>Account pending approval.</strong> Your mentor account is under review. You'll be notified once approved.</div>
            </div>
          )}

          {/* Stats */}
          <div className="stats-grid">
            {stats.map((s, i) => (
              <div key={s.label} className={`stat-card animate-fadeIn delay-${i+1}`}>
                <div className="stat-card-icon" style={{background: s.bg, color: s.color}}>
                  <i className={`ti ${s.icon}`} style={{fontSize:20}} />
                </div>
                <div className="stat-card-num">{s.value}</div>
                <div className="stat-card-lbl">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Sections */}
          <div className="dash-sections">
            <div className="dash-section-card animate-fadeIn delay-3">
              <div className="dash-section-hd">
                <h3>{isMentor ? 'My Courses' : 'Continue Learning'}</h3>
                <Link to="/courses">View all →</Link>
              </div>
              <div className="empty-state">
                <i className={`ti ${isMentor ? 'ti-books' : 'ti-target'}`} />
                <h3>{isMentor ? 'No courses yet' : 'No courses in progress'}</h3>
                <p>{isMentor ? 'Create your first course to start teaching.' : 'Browse the catalog and enroll in a course to get started.'}</p>
                <button className="btn btn-secondary btn-sm"
                  onClick={() => navigate(isMentor ? '/mentor/dashboard' : '/courses')}>
                  {isMentor ? 'Create a course' : 'Explore courses'}
                </button>
              </div>
            </div>

            <div className="dash-section-card animate-fadeIn delay-4">
              <div className="dash-section-hd"><h3>Quick Access</h3></div>
              <div className="quick-links">
                {[
                  { to: '/profile', icon: 'ti-user', color: 'rgba(48,157,142,0.1)', iconColor: 'var(--brand)', name: 'My Profile', desc: 'Update your info & avatar' },
                  { to: '/courses', icon: 'ti-book', color: '#eff4fe', iconColor: '#2563eb', name: 'Course Catalog', desc: 'Browse all available courses' },
                  ...(isAdmin ? [{ to: '/admin/portal', icon: 'ti-settings', color: '#fef9ec', iconColor: '#d97706', name: 'Admin Portal', desc: 'Manage courses & mentors' }] : []),
                ].map(l => (
                  <Link key={l.to} to={l.to} className="quick-link-item">
                    <div className="quick-link-icon" style={{background: l.color, color: l.iconColor}}>
                      <i className={`ti ${l.icon}`} style={{fontSize:18}} />
                    </div>
                    <div>
                      <p className="quick-link-name">{l.name}</p>
                      <p className="quick-link-desc">{l.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

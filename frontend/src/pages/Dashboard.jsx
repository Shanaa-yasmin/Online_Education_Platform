import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../utils/api.js';
import NotificationBell from '../components/NotificationBell.jsx';
import ActivityCalendar from '../components/ActivityCalendar.jsx';
import './Dashboard.css';

function getInitials(user) {
  if (!user) return '?';
  return (user.username || user.email || '?').slice(0, 2).toUpperCase();
}

const STATUS_MAP = (course) => {
  if (course.is_approved && course.is_published) return { label: 'Live', cls: 'badge-live' };
  if (course.is_approved && !course.is_published) return { label: 'Approved', cls: 'badge-approved' };
  if (!course.is_approved && course.is_published) return { label: 'Pending', cls: 'badge-pending-mod' };
  return { label: 'Draft', cls: 'badge-draft' };
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isMentor = user?.role === 'MENTOR';
  const isAdmin = user?.role === 'ADMIN';
  const isStudent = !isMentor && !isAdmin;

  useEffect(() => {
    let active = true;
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const r = await api.get('/api/payments/dashboard-stats/');
        if (active) {
          setData(r.data);
          setError('');
        }
      } catch (err) {
        if (active) {
          setError('Failed to load dashboard statistics.');
          console.error(err);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    if (user) {
      fetchDashboard();
    }
    return () => { active = false; };
  }, [user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  // Stat colors pull from the shared token set (brand / info / success / warning)
  // so this card always matches the design system — no hardcoded hex.
  const stats = isAdmin
    ? [
      { icon: 'ti-book', label: 'Total Courses', value: data?.stats?.total_courses ?? 0, color: 'var(--brand)', bg: 'var(--brand-light)' },
      { icon: 'ti-alert-circle', label: 'Pending Approvals', value: data?.stats?.pending_courses ?? 0, color: 'var(--warning)', bg: 'var(--warning-bg)' },
      { icon: 'ti-users', label: 'Total Students', value: data?.stats?.total_students ?? 0, color: 'var(--info)', bg: 'var(--info-bg)' },
      { icon: 'ti-award', label: 'Total Mentors', value: data?.stats?.total_mentors ?? 0, color: 'var(--success)', bg: 'var(--success-bg)' },
    ]
    : isMentor
      ? [
        { icon: 'ti-book', label: 'My Courses', value: data?.stats?.courses_count ?? 0, color: 'var(--brand)', bg: 'var(--brand-light)' },
        { icon: 'ti-users', label: 'Total Students', value: data?.stats?.total_students ?? 0, color: 'var(--info)', bg: 'var(--info-bg)' },
        { icon: 'ti-circle-check', label: 'Published', value: data?.stats?.published_count ?? 0, color: 'var(--success)', bg: 'var(--success-bg)' },
        { icon: 'ti-star', label: 'Avg. Rating', value: data?.stats?.avg_rating !== undefined && data.stats.avg_rating > 0 ? data.stats.avg_rating.toFixed(1) : '—', color: 'var(--warning)', bg: 'var(--warning-bg)' },
      ]
      : [
        { icon: 'ti-book', label: 'Enrolled', value: data?.stats?.enrolled_count ?? 0, color: 'var(--brand)', bg: 'var(--brand-light)' },
        { icon: 'ti-player-play', label: 'In Progress', value: data?.stats?.in_progress_count ?? 0, color: 'var(--info)', bg: 'var(--info-bg)' },
        { icon: 'ti-award', label: 'Completed', value: data?.stats?.completed_count ?? 0, color: 'var(--success)', bg: 'var(--success-bg)' },
        { icon: 'ti-clock', label: 'Hours Learned', value: data?.stats?.hours_learned ?? 0, color: 'var(--warning)', bg: 'var(--warning-bg)' },
      ];

  const hasCourses = isMentor ? (data?.courses && data.courses.length > 0) : (data?.enrollments && data.enrollments.length > 0);

  const roleIcon = isAdmin ? 'ti-settings' : isMentor ? 'ti-award' : 'ti-books';
  const roleCtaIcon = isAdmin ? 'ti-settings' : isMentor ? 'ti-plus' : 'ti-compass';
  const roleCtaLabel = isAdmin ? 'Admin Panel' : isMentor ? 'Create Course' : 'Explore Courses';
  const roleCtaTarget = isAdmin ? '/admin/portal' : isMentor ? '/mentor/dashboard' : '/courses';

  return (
    <div className="dashboard-page">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo-area">
          <Link to="/" className="nav-logo" style={{ textDecoration: 'none' }}>
            <div className="nav-logo-mark"><i className="ti ti-trending-up" /></div>
            <span className="nav-logo-text">Edu<span>Path</span></span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <Link to="/dashboard" className="sidebar-nav-item active" aria-current="page">
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
            <NotificationBell user={user} />
            <Link to="/profile" className="topbar-user">
              <div className="avatar-initials" style={{ width: 30, height: 30, fontSize: 12 }}>
                {getInitials(user)}
              </div>
              <span className="topbar-user-name">{user?.username}</span>
              <span className={`badge badge-${(user?.role || 'student').toLowerCase()}`}>{user?.role}</span>
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="inner-content">

          {/* Welcome banner */}
          <section className="welcome-banner animate-fadeIn">
            <i className={`ti ${roleIcon} welcome-watermark`} aria-hidden="true" />
            <div className="welcome-text">
              <p className="welcome-eyebrow">
                {isAdmin ? 'Platform overview' : isMentor ? 'Mentor overview' : 'Your learning'}
              </p>
              <h2 className="welcome-h">Welcome back, {user?.username}</h2>
              <p className="welcome-p">
                {isAdmin
                  ? 'Manage system content, review course moderation requests, and monitor registrations.'
                  : isMentor
                    ? 'Manage your courses, track student engagement, and grow your audience.'
                    : 'Pick up where you left off, explore new courses, and keep growing.'}
              </p>
              <button className="welcome-cta" onClick={() => navigate(roleCtaTarget)}>
                <i className={`ti ${roleCtaIcon}`} /> {roleCtaLabel}
              </button>
            </div>
            <div className="welcome-icon-medallion" aria-hidden="true">
              <i className={`ti ${roleIcon}`} />
            </div>
          </section>

          {/* Mentor pending notice */}
          {isMentor && !user?.is_approved && (
            <div className="alert alert-warning animate-fadeIn">
              <i className="ti ti-alert-triangle" />
              <div><strong>Account pending approval.</strong> Your mentor account is under review. You'll be notified once approved.</div>
            </div>
          )}

          {error && !loading ? (
            <div className="alert alert-error animate-fadeIn" style={{ marginTop: 20 }}>
              <i className="ti ti-alert-triangle" />
              <div><strong>Error:</strong> {error}</div>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="stats-grid">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="stat-card stat-card-skeleton">
                      <div className="skeleton-block skeleton-icon" />
                      <div className="skeleton-block skeleton-num" />
                      <div className="skeleton-block skeleton-lbl" />
                    </div>
                  ))
                  : stats.map((s, i) => (
                    <div key={s.label} className={`stat-card animate-fadeIn delay-${i + 1}`}>
                      <div className="stat-card-icon" style={{ background: s.bg, color: s.color }}>
                        <i className={`ti ${s.icon}`} style={{ fontSize: 20 }} />
                      </div>
                      <div className="stat-card-num">{s.value}</div>
                      <div className="stat-card-lbl">{s.label}</div>
                    </div>
                  ))}
              </div>

              {/* Sections */}
              <div className="dash-sections">
                <div className="card dash-section-card animate-fadeIn delay-3">
                  <div className="dash-section-hd">
                    <h3>{isMentor ? 'My Courses' : 'Continue Learning'}</h3>
                    <Link to={isMentor ? '/mentor/dashboard' : '/courses'}>View all <i className="ti ti-arrow-right" /></Link>
                  </div>

                  {loading ? (
                    <div className="dash-courses-list">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="dash-course-item dash-course-item-skeleton">
                          <div className="dash-course-info">
                            <div className="skeleton-block skeleton-badge" />
                            <div className="skeleton-block skeleton-title" />
                            <div className="skeleton-block skeleton-meta" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !hasCourses ? (
                    <div className="empty-state">
                      <i className={`ti ${isMentor ? 'ti-books' : 'ti-target'}`} />
                      <h3>{isMentor ? 'No courses yet' : 'No courses in progress'}</h3>
                      <p>{isMentor ? 'Create your first course to start teaching.' : 'Browse the catalog and enroll in a course to get started.'}</p>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => navigate(isMentor ? '/mentor/dashboard' : '/courses')}>
                        {isMentor ? 'Create a course' : 'Explore courses'}
                      </button>
                    </div>
                  ) : isMentor ? (
                    <div className="dash-courses-list">
                      {data.courses.slice(0, 3).map(course => {
                        const st = STATUS_MAP(course);
                        return (
                          <div key={course.id} className="dash-course-item">
                            <div className="dash-course-info">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className={`badge badge-${course.level.toLowerCase()}`}>{course.level}</span>
                                <span className={`badge ${st.cls}`}>{st.label}</span>
                              </div>
                              <h4 className="dash-course-title">{course.title}</h4>
                              <p className="dash-course-meta">
                                <span><i className="ti ti-clock" /> {course.duration_hours}h</span>
                                <span style={{ marginLeft: 12 }}><i className="ti ti-world" /> {course.language}</span>
                              </p>
                            </div>
                            <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => navigate(`/mentor/courses/${course.id}/builder`)}>
                              Curriculum
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="dash-courses-list">
                      {data.enrollments.slice(0, 3).map(enr => {
                        const course = enr.course_details;
                        if (!course) return null;
                        return (
                          <div key={enr.id} className="dash-course-item">
                            <div className="dash-course-info">
                              <span className={`badge badge-${course.level.toLowerCase()}`}>{course.level}</span>
                              <h4 className="dash-course-title">{course.title}</h4>
                              <div className="dash-progress-container">
                                <div className="dash-progress-bar">
                                  <div className="dash-progress-fill" style={{ width: `${enr.progress_percent}%` }}></div>
                                </div>
                                <span className="dash-progress-text">{Math.round(enr.progress_percent)}% Complete</span>
                              </div>
                            </div>
                            <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => navigate(`/courses/${course.id}/learn`)}>
                              Resume
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right column: activity calendar (students) + quick access */}
                <div className="dash-right-col">
                  {isStudent && (
                    <div className="animate-fadeIn delay-4">
                      <ActivityCalendar activity={data?.activity_calendar ?? []} loading={loading} />
                    </div>
                  )}

                  <div className="card dash-section-card animate-fadeIn delay-4">
                    <div className="dash-section-hd"><h3>Quick Access</h3></div>
                    <div className="quick-links">
                      {[
                        { to: '/profile', icon: 'ti-user', color: 'var(--brand-light)', iconColor: 'var(--brand)', name: 'My Profile', desc: 'Update your info & avatar' },
                        { to: '/courses', icon: 'ti-book', color: 'var(--info-bg)', iconColor: 'var(--info)', name: 'Course Catalog', desc: 'Browse all available courses' },
                        ...(isAdmin ? [{ to: '/admin/portal', icon: 'ti-settings', color: 'var(--warning-bg)', iconColor: 'var(--warning)', name: 'Admin Portal', desc: 'Manage courses & mentors' }] : []),
                        ...(isMentor ? [{ to: '/mentor/dashboard', icon: 'ti-award', color: 'var(--success-bg)', iconColor: 'var(--success)', name: 'Mentor Portal', desc: 'Manage curriculum & view sales' }] : []),
                      ].map(l => (
                        <Link key={l.to} to={l.to} className="quick-link-item">
                          <div className="quick-link-icon" style={{ background: l.color, color: l.iconColor }}>
                            <i className={`ti ${l.icon}`} style={{ fontSize: 18 }} />
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
            </>
          )}

        </div>
      </div>
    </div>
  );
}
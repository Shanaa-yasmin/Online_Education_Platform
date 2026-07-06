import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../utils/api.js';
import NotificationBell from '../components/NotificationBell.jsx';
import ActivityCalendar from '../components/ActivityCalendar.jsx';
import Sidebar from '../components/Sidebar.jsx';
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

// Mirrors the fallback treatment used on CoursesPage.jsx when a course has no thumbnail
const LEVEL_ICON = { BEGINNER: 'ti-leaf', INTERMEDIATE: 'ti-flame', ADVANCED: 'ti-bolt' };
const LEVEL_ICON_BG = { BEGINNER: 'var(--brand-light)', INTERMEDIATE: 'var(--warning-bg)', ADVANCED: 'var(--info-bg)' };
const LEVEL_ICON_COLOR = { BEGINNER: 'var(--brand)', INTERMEDIATE: 'var(--warning)', ADVANCED: 'var(--info)' };

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
        { icon: 'ti-flame', label: 'Learning Streak', value: `${data?.stats?.streak ?? 0} days`, color: '#ea580c', bg: '#ffedd5' },
        { icon: 'ti-certificate', label: 'Certificates', value: data?.stats?.certificates_count ?? 0, color: '#9333ea', bg: '#f3e8ff' },
      ];

  const hasCourses = isMentor ? (data?.courses && data.courses.length > 0) : (data?.enrollments && data.enrollments.length > 0);

  const roleIcon = isAdmin ? 'ti-settings' : isMentor ? 'ti-award' : 'ti-books';
  const roleCtaIcon = isAdmin ? 'ti-settings' : isMentor ? 'ti-plus' : 'ti-compass';
  const roleCtaLabel = isAdmin ? 'Admin Panel' : isMentor ? 'Create Course' : 'Explore Courses';
  const roleCtaTarget = isAdmin ? '/admin/portal' : isMentor ? '/mentor/dashboard' : '/courses';

  return (
    <div className="dashboard-page">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} active="dashboard" />

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
                {/* For Students, render My Learning catalog cards */}
                {isStudent && (
                  <div className="card dash-section-card animate-fadeIn delay-3" style={{ gridColumn: 'span 2' }}>
                    <div className="dash-section-hd">
                      <h3>My Learning Courses</h3>
                      <Link to="/courses">Explore Catalog <i className="ti ti-arrow-right" /></Link>
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
                        <i className="ti ti-target" />
                        <h3>No courses in progress</h3>
                        <p>Browse the catalog and enroll in a course to get started.</p>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/courses')}>
                          Explore courses
                        </button>
                      </div>
                    ) : (
                      <div className="my-learning-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginTop: '15px' }}>
                        {data.enrollments.map(enr => {
                          const course = enr.course_details;
                          if (!course) return null;
                          const isComplete = parseFloat(enr.progress_percent) >= 100.0;
                          return (
                            <div
                              key={enr.id}
                              className="card my-learning-card"
                              role="link"
                              tabIndex={0}
                              onClick={() => navigate(`/courses/${course.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigate(`/courses/${course.id}`);
                                }
                              }}
                              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '15px', borderRadius: '4px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                            >
                              <div>
                                <div
                                  style={{
                                    width: '100%',
                                    height: '140px',
                                    borderRadius: '2px',
                                    marginBottom: '10px',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: LEVEL_ICON_BG[course.level] || 'var(--brand-light)',
                                  }}
                                >
                                  {course.thumbnail ? (
                                    <img
                                      src={course.thumbnail}
                                      alt={course.title}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <i
                                      className={`ti ${LEVEL_ICON[course.level] || 'ti-book'}`}
                                      style={{ fontSize: 40, color: LEVEL_ICON_COLOR[course.level] || 'var(--brand)' }}
                                    />
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  <span className={`badge badge-${course.level.toLowerCase()}`}>{course.level}</span>
                                  {isComplete && <span className="badge badge-success">🎓 Certificate Available</span>}
                                </div>
                                <h4 style={{ fontSize: '15px', fontWeight: '600', margin: '10px 0 5px 0' }}>{course.title}</h4>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                  by {course.mentor?.username || 'Instructor'}
                                </p>
                              </div>
                              <div>
                                <div className="dash-progress-container" style={{ margin: '8px 0' }}>
                                  <div className="dash-progress-bar" style={{ height: '6px', background: 'var(--bg-light)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div className="dash-progress-fill" style={{ height: '100%', background: 'var(--brand)', width: `${enr.progress_percent}%` }}></div>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    <span>{Math.round(enr.progress_percent)}% Complete</span>
                                  </div>
                                </div>
                                <button className="btn btn-primary btn-sm w-full" style={{ marginTop: '5px' }} onClick={(e) => { e.stopPropagation(); navigate(`/courses/${course.id}/learn`); }}>
                                  Continue Learning
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Student specific resume hero, upcoming lessons, notifications */}
                {isStudent && (
                  <div className="student-dashboard-layout" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {data?.continue_learning && (
                        <div className="card continue-learning-hero" style={{ padding: '20px', background: 'linear-gradient(135deg, var(--brand-light), #fff)', border: '1px solid var(--brand)' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '1px' }}>Resume Learning</span>
                          <h3 style={{ margin: '8px 0', fontSize: '18px' }}>{data.continue_learning.course_title}</h3>
                          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '15px' }}>
                            Next Lesson: <strong>{data.continue_learning.lesson_title}</strong>
                          </p>
                          <button className="btn btn-primary" onClick={() => navigate(`/courses/${data.continue_learning.course_id}/learn`)}>
                            Resume Lesson
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      {data?.upcoming_lessons && data.upcoming_lessons.length > 0 && (
                        <div className="card upcoming-lessons-card" style={{ padding: '20px' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>Upcoming Lessons</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {data.upcoming_lessons.map(l => (
                              <div key={l.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px' }}>
                                <i className="ti ti-book-open" style={{ color: 'var(--brand)', background: 'var(--brand-light)', padding: '5px', borderRadius: '2px' }} />
                                <div>
                                  <span style={{ fontWeight: '500', display: 'block' }}>{l.title}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.content_type}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mentor Dashboard Widgets */}
                {isMentor && (
                  <div className="mentor-dashboard-layout" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', width: '100%' }}>
                    <div className="card course-performance" style={{ padding: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>Course Performance</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {data?.course_performance?.map(c => (
                          <div
                            key={c.id}
                            role="link"
                            tabIndex={0}
                            onClick={() => navigate(`/courses/${c.id}`)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate(`/courses/${c.id}`);
                              }
                            }}
                            style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', cursor: 'pointer' }}
                          >
                            <span>{c.title}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              👤 {c.students} Students | 💰 ${c.revenue.toFixed(2)} | ⭐ {c.rating.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card pending-questions" style={{ padding: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>Pending Q&A Questions</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {!data?.pending_questions?.length ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No pending student questions.</p>
                        ) : (
                          data.pending_questions.map(q => (
                            <div key={q.id} style={{ paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong>@{q.student_username}</strong>
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{q.course_title}</span>
                              </div>
                              <p style={{ margin: '4px 0', color: 'var(--text-muted)' }}>"{q.message_text}"</p>
                              <Link to={`/courses/${q.course_id}/learn?tab=qa`} style={{ fontSize: '12px', color: 'var(--brand)' }}>Reply &rarr;</Link>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="card recent-enrollments" style={{ padding: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>Recent Enrollments</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {data?.recent_enrollments?.map((e, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                            <span><strong>@{e.student_username}</strong> enrolled in {e.course_title}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{new Date(e.enrolled_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card recent-reviews" style={{ padding: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>Recent Reviews</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {data?.recent_reviews?.map(r => (
                          <div key={r.id} style={{ fontSize: '13px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#f59e0b' }}>{'★'.repeat(r.rating)}</span>
                              <span style={{ color: 'var(--text-muted)' }}>{r.student?.username}</span>
                            </div>
                            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>"{r.comment}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin Dashboard Widgets */}
                {isAdmin && (
                  <div className="admin-dashboard-layout" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', width: '100%' }}>
                    <div className="card pending-courses" style={{ padding: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>Pending Course Approvals</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {!data?.pending_course_approvals?.length ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No courses pending approval.</p>
                        ) : (
                          data.pending_course_approvals.map(c => (
                            <div
                              key={c.id}
                              role="link"
                              tabIndex={0}
                              onClick={() => navigate(`/courses/${c.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigate(`/courses/${c.id}`);
                                }
                              }}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', cursor: 'pointer' }}
                            >
                              <div>
                                <strong>{c.title}</strong>
                                <br />
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>by @{c.mentor} | ${c.price.toFixed(2)}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-primary btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={async (e) => {
                                  e.stopPropagation();
                                  await api.post(`/api/courses/${c.id}/approve/`);
                                  alert('Course approved');
                                  window.location.reload();
                                }}>Approve</button>
                                <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={async (e) => {
                                  e.stopPropagation();
                                  await api.post(`/api/courses/${c.id}/reject/`);
                                  alert('Course rejected');
                                  window.location.reload();
                                }}>Reject</button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="card pending-mentors" style={{ padding: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>Pending Mentor Approvals</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {!data?.pending_mentor_approvals?.length ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No mentors pending approval.</p>
                        ) : (
                          data.pending_mentor_approvals.map(m => (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
                              <div>
                                <strong>@{m.username}</strong> ({m.email})
                                <br />
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{m.title || 'Instructor'} | Skills: {m.skills}</span>
                              </div>
                              <button className="btn btn-primary btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={async () => {
                                await api.post(`/api/auth/profiles/${m.id}/approve/`);
                                alert('Mentor approved');
                                window.location.reload();
                              }}>Approve</button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="card recent-registrations" style={{ padding: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>Recent Registrations</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data?.recent_registrations?.map(r => (
                          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                            <span><strong>@{r.username}</strong> ({r.role})</span>
                            <span style={{ color: 'var(--text-muted)' }}>{new Date(r.date_joined).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card recent-refunds" style={{ padding: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>Recent Refunds</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {!data?.recent_refunds?.length ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No recent refunds.</p>
                        ) : (
                          data.recent_refunds.map(r => (
                            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                              <span><strong>@{r.student_username}</strong> refunded {r.course_title}</span>
                              <span style={{ color: 'red' }}>-${r.amount.toFixed(2)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="card system-activity" style={{ gridColumn: 'span 2', padding: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>System Activity Log</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                        {data?.system_activity?.map(a => (
                          <div key={a.id} style={{ fontSize: '13px', padding: '12px', background: 'var(--bg-light)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            <strong style={{ display: 'block', marginBottom: '4px' }}>{a.title}</strong>
                            <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)' }}>{a.message}</p>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(a.created_at).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
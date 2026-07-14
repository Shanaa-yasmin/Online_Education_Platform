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
        { icon: 'ti-certificate', label: 'Certificates', value: data?.stats?.certificates_count ?? 0, color: '#9333ea', bg: '#f3e8ff' },
      ];

  const hasCourses = isMentor ? (data?.courses && data.courses.length > 0) : (data?.enrollments && data.enrollments.length > 0);

  const roleIcon = isAdmin ? 'ti-settings' : isMentor ? 'ti-award' : 'ti-books';
  const roleCtaIcon = isAdmin ? 'ti-settings' : isMentor ? 'ti-plus' : 'ti-compass';
  const roleCtaLabel = isAdmin ? 'Admin Panel' : isMentor ? 'Create Course' : 'Explore Courses';
  const roleCtaTarget = isAdmin ? '/admin/portal' : isMentor ? '/mentor/dashboard' : '/courses';

  const statsGrid = (
    <div className="stats-grid stats-grid-4">
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
              <i className={`ti ${s.icon}`} />
            </div>
            <div className="stat-card-num">{s.value}</div>
            <div className="stat-card-lbl">{s.label}</div>
          </div>
        ))}
    </div>
  );

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
              <div className="avatar-initials avatar-initials-sm">
                {getInitials(user)}
              </div>
              <span className="topbar-user-name">{user?.username}</span>
              <span className={`badge badge-${(user?.role || 'student').toLowerCase()}`}>{user?.role}</span>
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="inner-content">

          {/* Welcome banner (+ stats and activity calendar for students) */}
          <div className={`hero-row${isStudent ? ' hero-row-with-calendar' : ''}`}>
            <div className={isStudent ? 'hero-left' : 'hero-banner-only'}>
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

              {isStudent && !(error && !loading) && statsGrid}
            </div>

            {isStudent && (
              <ActivityCalendar activity={data?.activity ?? []} loading={loading} />
            )}
          </div>

          {/* Mentor pending notice */}
          {isMentor && !user?.is_approved && (
            <div className="alert alert-warning animate-fadeIn">
              <i className="ti ti-alert-triangle" />
              <div><strong>Account pending approval.</strong> Your mentor account is under review. You'll be notified once approved.</div>
            </div>
          )}

          {error && !loading ? (
            <div className="alert alert-error animate-fadeIn dashboard-error">
              <i className="ti ti-alert-triangle" />
              <div><strong>Error:</strong> {error}</div>
            </div>
          ) : (
            <>
              {/* Stats (mentor/admin only — students get theirs in the hero row above) */}
              {!isStudent && statsGrid}

              {/* Sections */}
              <div className="dash-sections">
                {/* For Students, render My Learning catalog cards */}
                {isStudent && (
                  <div className="card dash-section-card dash-section-card-wide animate-fadeIn delay-3">
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
                      <div className="my-learning-grid">
                        {data.enrollments.map(enr => {
                          const course = enr.course_details;
                          if (!course) return null;
                          const isComplete = parseFloat(enr.progress_percent) >= 100.0;
                          return (
                            <div
                              key={enr.id}
                              className="my-learning-card"
                              role="link"
                              tabIndex={0}
                              onClick={() => navigate(`/courses/${course.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigate(`/courses/${course.id}`);
                                }
                              }}
                            >
                              <div>
                                <div className="my-learning-thumb" style={{ background: LEVEL_ICON_BG[course.level] || 'var(--brand-light)' }}>
                                  {course.thumbnail ? (
                                    <img src={course.thumbnail} alt={course.title} loading="lazy" />
                                  ) : (
                                    <i
                                      className={`ti ${LEVEL_ICON[course.level] || 'ti-book'}`}
                                      style={{ color: LEVEL_ICON_COLOR[course.level] || 'var(--brand)' }}
                                    />
                                  )}
                                </div>
                                <div className="my-learning-badges">
                                  <span className={`badge badge-${course.level.toLowerCase()}`}>{course.level}</span>
                                  {isComplete && <span className="badge badge-success">Certificate available</span>}
                                </div>
                                <h4 className="my-learning-title">{course.title}</h4>
                                <p className="my-learning-mentor">by {course.mentor?.username || 'Instructor'}</p>
                              </div>
                              <div>
                                <div className="dash-progress-container">
                                  <div className="dash-progress-bar">
                                    <div className="dash-progress-fill" style={{ width: `${enr.progress_percent}%` }}></div>
                                  </div>
                                  <div className="my-learning-progress-text">
                                    <span>{Math.round(enr.progress_percent)}% complete</span>
                                  </div>
                                </div>
                                <button className="btn btn-primary btn-sm w-full my-learning-cta" onClick={(e) => { e.stopPropagation(); navigate(`/courses/${course.id}/learn`); }}>
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
                  <div className="student-dashboard-layout">
                    <div className="student-dashboard-col">
                      {data?.continue_learning && (
                        <div className="card continue-learning-hero">
                          <span className="continue-learning-eyebrow">Resume Learning</span>
                          <h3 className="continue-learning-title">{data.continue_learning.course_title}</h3>
                          <p className="continue-learning-sub">
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
                        <div className="card upcoming-lessons-card">
                          <h3 className="dash-widget-title">Upcoming Lessons</h3>
                          <div className="upcoming-lessons-list">
                            {data.upcoming_lessons.map(l => (
                              <div key={l.id} className="upcoming-lesson-item">
                                <i className="ti ti-book-open upcoming-lesson-icon" />
                                <div>
                                  <span className="upcoming-lesson-title">{l.title}</span>
                                  <span className="upcoming-lesson-type">{l.content_type}</span>
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
                  <div className="mentor-dashboard-layout">
                    <div className="card course-performance">
                      <h3 className="dash-widget-title">Course Performance</h3>
                      <div className="perf-list">
                        {data?.course_performance?.map(c => (
                          <div
                            key={c.id}
                            role="link"
                            tabIndex={0}
                            className="perf-item"
                            onClick={() => navigate(`/courses/${c.id}`)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate(`/courses/${c.id}`);
                              }
                            }}
                          >
                            <span className="perf-name">{c.title}</span>
                            <span className="perf-meta">
                              {c.students} students &middot; ${c.revenue.toFixed(2)} &middot; {c.rating.toFixed(1)} rating
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card pending-questions">
                      <h3 className="dash-widget-title">Pending Q&amp;A Questions</h3>
                      <div className="qa-list">
                        {!data?.pending_questions?.length ? (
                          <p className="dash-empty-note">No pending student questions.</p>
                        ) : (
                          data.pending_questions.map(q => (
                            <div key={q.id} className="qa-item">
                              <div className="qa-item-head">
                                <strong>@{q.student_username}</strong>
                                <span className="qa-course">{q.course_title}</span>
                              </div>
                              <p className="qa-message">{q.message_text}</p>
                              <Link to={`/courses/${q.course_id}/learn?tab=qa`} className="qa-reply-link">Reply &rarr;</Link>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="card recent-enrollments">
                      <h3 className="dash-widget-title">Recent Enrollments</h3>
                      <div className="enroll-list">
                        {data?.recent_enrollments?.map((e, idx) => (
                          <div key={idx} className="enroll-item">
                            <span><strong>@{e.student_username}</strong> enrolled in {e.course_title}</span>
                            <span className="enroll-date">{new Date(e.enrolled_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card recent-reviews">
                      <h3 className="dash-widget-title">Recent Reviews</h3>
                      <div className="review-list">
                        {data?.recent_reviews?.map(r => (
                          <div key={r.id} className="review-item">
                            <div className="review-item-head">
                              <span className="review-stars">{'★'.repeat(r.rating)}</span>
                              <span className="review-student">{r.student?.username}</span>
                            </div>
                            <p className="review-comment">{r.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin Dashboard Widgets */}
                {isAdmin && (
                  <div className="admin-dashboard-layout">
                    <div className="card pending-courses">
                      <h3 className="dash-widget-title">Pending Course Approvals</h3>
                      <div className="approval-list">
                        {!data?.pending_course_approvals?.length ? (
                          <p className="dash-empty-note">No courses pending approval.</p>
                        ) : (
                          data.pending_course_approvals.map(c => (
                            <div
                              key={c.id}
                              role="link"
                              tabIndex={0}
                              className="approval-item"
                              onClick={() => navigate(`/courses/${c.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigate(`/courses/${c.id}`);
                                }
                              }}
                            >
                              <div className="approval-info">
                                <strong>{c.title}</strong>
                                <span className="approval-meta">by @{c.mentor} &middot; ${c.price.toFixed(2)}</span>
                              </div>
                              <div className="approval-actions">
                                <button className="btn btn-primary btn-xs" onClick={async (e) => {
                                  e.stopPropagation();
                                  await api.post(`/api/courses/${c.id}/approve/`);
                                  alert('Course approved');
                                  window.location.reload();
                                }}>Approve</button>
                                <button className="btn btn-secondary btn-xs" onClick={async (e) => {
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

                    <div className="card pending-mentors">
                      <h3 className="dash-widget-title">Pending Mentor Approvals</h3>
                      <div className="approval-list">
                        {!data?.pending_mentor_approvals?.length ? (
                          <p className="dash-empty-note">No mentors pending approval.</p>
                        ) : (
                          data.pending_mentor_approvals.map(m => (
                            <div key={m.id} className="approval-item">
                              <div className="approval-info">
                                <strong>@{m.username}</strong> <span className="approval-meta-inline">({m.email})</span>
                                <span className="approval-meta">{m.title || 'Instructor'} &middot; Skills: {m.skills}</span>
                              </div>
                              <button className="btn btn-primary btn-xs" onClick={async () => {
                                await api.post(`/api/auth/profiles/${m.id}/approve/`);
                                alert('Mentor approved');
                                window.location.reload();
                              }}>Approve</button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="card recent-registrations">
                      <h3 className="dash-widget-title">Recent Registrations</h3>
                      <div className="registration-list">
                        {data?.recent_registrations?.map(r => (
                          <div key={r.id} className="registration-item">
                            <span><strong>@{r.username}</strong> ({r.role})</span>
                            <span className="registration-date">{new Date(r.date_joined).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card recent-refunds">
                      <h3 className="dash-widget-title">Recent Refunds</h3>
                      <div className="refund-list">
                        {!data?.recent_refunds?.length ? (
                          <p className="dash-empty-note">No recent refunds.</p>
                        ) : (
                          data.recent_refunds.map(r => (
                            <div key={r.id} className="refund-item">
                              <span><strong>@{r.student_username}</strong> refunded {r.course_title}</span>
                              <span className="refund-amount">-${r.amount.toFixed(2)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="card system-activity system-activity-wide">
                      <h3 className="dash-widget-title">System Activity Log</h3>
                      <div className="activity-grid">
                        {data?.system_activity?.map(a => (
                          <div key={a.id} className="activity-item">
                            <strong className="activity-title">{a.title}</strong>
                            <p className="activity-message">{a.message}</p>
                            <span className="activity-time">{new Date(a.created_at).toLocaleTimeString()}</span>
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
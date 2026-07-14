import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import Sidebar from '../components/Sidebar.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import './MyCourses.css';

function getInitials(user) {
  if (!user) return '?';
  return (user.username || user.email || '?').slice(0, 2).toUpperCase();
}

const LEVEL_ICON = { BEGINNER: 'ti-leaf', INTERMEDIATE: 'ti-flame', ADVANCED: 'ti-bolt' };
const LEVEL_ICON_BG = { BEGINNER: 'var(--brand-light)', INTERMEDIATE: 'var(--warning-bg)', ADVANCED: 'var(--info-bg)' };
const LEVEL_ICON_COLOR = { BEGINNER: 'var(--brand)', INTERMEDIATE: 'var(--warning)', ADVANCED: 'var(--info)' };

export default function MyCourses() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'in_progress', 'completed'
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchMyCourses = async () => {
      try {
        setLoading(true);
        const r = await api.get('/api/progress/');
        if (active) {
          setCourses(r.data);
          setError('');
        }
      } catch (err) {
        if (active) {
          setError('Failed to load your enrolled courses.');
          console.error(err);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (user) {
      fetchMyCourses();
    }
    return () => { active = false; };
  }, [user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  const filteredCourses = courses.filter(item => {
    const matchesSearch = item.course_title.toLowerCase().includes(searchQuery.toLowerCase());
    const progress = parseFloat(item.progress_percent || 0);
    
    if (filterTab === 'in_progress') {
      return matchesSearch && progress > 0 && progress < 100;
    }
    if (filterTab === 'completed') {
      return matchesSearch && progress >= 100;
    }
    return matchesSearch;
  });

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} active="my-courses" />

      <div className="inner-page">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1>My Learning Portal</h1>
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
          <div className="my-courses-header-section">
            <div className="page-header">
              <h1>My Courses</h1>
              <p>Keep track of your studies, review progress, and access class materials.</p>
            </div>

            {/* Filter controls */}
            <div className="my-courses-controls">
              <div className="my-courses-search">
                <i className="ti ti-search search-icon" />
                <input
                  type="text"
                  placeholder="Search your courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="my-courses-search-input"
                />
              </div>

              <div className="my-courses-tabs">
                <button
                  className={`tab-btn ${filterTab === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterTab('all')}
                >
                  All ({courses.length})
                </button>
                <button
                  className={`tab-btn ${filterTab === 'in_progress' ? 'active' : ''}`}
                  onClick={() => setFilterTab('in_progress')}
                >
                  In Progress ({courses.filter(c => parseFloat(c.progress_percent) > 0 && parseFloat(c.progress_percent) < 100).length})
                </button>
                <button
                  className={`tab-btn ${filterTab === 'completed' ? 'active' : ''}`}
                  onClick={() => setFilterTab('completed')}
                >
                  Completed ({courses.filter(c => parseFloat(c.progress_percent) >= 100).length})
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-error animate-fadeIn">
              <i className="ti ti-alert-triangle" />
              <div>{error}</div>
            </div>
          )}

          {loading ? (
            <div className="my-courses-grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="my-courses-card skeleton-card">
                  <div className="my-courses-thumb-skeleton" />
                  <div className="my-courses-content-skeleton">
                    <div className="skeleton-line title" />
                    <div className="skeleton-line text" />
                    <div className="skeleton-line progress" />
                    <div className="skeleton-line btn" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="card empty-state-box animate-fadeIn">
              <div className="empty-state">
                <i className="ti ti-notebook" />
                <h3>No courses found</h3>
                {courses.length === 0 ? (
                  <>
                    <p>You are not enrolled in any courses yet.</p>
                    <button className="btn btn-primary" onClick={() => navigate('/courses')}>
                      Browse Course Catalog
                    </button>
                  </>
                ) : (
                  <p>Try refining your search query or choosing another tab.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="my-courses-grid animate-fadeIn">
              {filteredCourses.map(item => {
                const progress = parseFloat(item.progress_percent || 0);
                const isComplete = progress >= 100.0;
                
                return (
                  <div
                    key={item.course_id}
                    className="my-courses-card"
                    onClick={() => navigate(`/courses/${item.course_id}`)}
                  >
                    <div className="my-courses-card-image-wrapper">
                      {item.course_thumbnail ? (
                        <img src={item.course_thumbnail} alt={item.course_title} loading="lazy" />
                      ) : (
                        <div className="my-courses-card-fallback-thumb" style={{ background: 'var(--brand-light)' }}>
                          <i className="ti ti-book" style={{ color: 'var(--brand)' }} />
                        </div>
                      )}
                    </div>

                    <div className="my-courses-card-content">
                      <div className="my-courses-card-badge-row">
                        <span className="badge badge-brand">Enrolled</span>
                        {isComplete ? (
                          <span className="badge badge-success">Completed</span>
                        ) : (
                          <span className="badge badge-beginner" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                            In Progress
                          </span>
                        )}
                      </div>

                      <h3 className="my-courses-card-title">{item.course_title}</h3>
                      <p className="my-courses-card-subtitle">
                        Lessons: {item.completed_lessons_count} / {item.total_lessons_count}
                      </p>

                      <div className="my-courses-card-progress-section">
                        <div className="my-courses-progress-bar">
                          <div className="my-courses-progress-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div className="my-courses-progress-lbl">
                          <span>{Math.round(progress)}% Complete</span>
                          {item.estimated_time_remaining && !isComplete && (
                            <span className="time-remaining">
                              <i className="ti ti-clock" /> {item.estimated_time_remaining} left
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="my-courses-card-actions">
                        <button
                          className="btn btn-primary w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/courses/${item.course_id}/learn`);
                          }}
                        >
                          {isComplete ? 'Review Course Material' : progress > 0 ? 'Continue Learning' : 'Start Learning'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

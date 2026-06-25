import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import './CoursesPage.css';

function Sidebar({ user, onLogout, loggingOut }) {
  const isMentor = user?.role === 'MENTOR';
  const isAdmin  = user?.role === 'ADMIN';
  return (
    <aside className="sidebar">
      <div className="sidebar-logo-area">
        <Link to="/" className="nav-logo">
          <div className="nav-logo-mark"><i className="ti ti-trending-up" /></div>
          <span className="nav-logo-text">Edu<span>Path</span></span>
        </Link>
      </div>
      <nav className="sidebar-nav">
        <Link to="/dashboard" className="sidebar-nav-item"><i className="ti ti-layout-dashboard" /> Dashboard</Link>
        {(isMentor||isAdmin) && <Link to="/mentor/dashboard" className="sidebar-nav-item"><i className="ti ti-award" /> Mentor Portal</Link>}
        {isAdmin && <Link to="/admin/portal" className="sidebar-nav-item"><i className="ti ti-settings" /> Admin Portal</Link>}
        <Link to="/courses" className="sidebar-nav-item active"><i className="ti ti-book" /> Courses</Link>
        <Link to="/profile" className="sidebar-nav-item"><i className="ti ti-user" /> Profile</Link>
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? <><span className="loading-spinner loading-spinner-sm"/>Signing out…</> : <><i className="ti ti-logout"/>Sign out</>}
        </button>
      </div>
    </aside>
  );
}

const THUMB = { BEGINNER:'cc-thumb-beg', INTERMEDIATE:'cc-thumb-int', ADVANCED:'cc-thumb-adv' };
const ICON  = { BEGINNER:'ti-leaf', INTERMEDIATE:'ti-flame', ADVANCED:'ti-bolt' };

export default function CoursesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [searchTerm, setSearchTerm]   = useState('');
  const [selectedLevel, setLevel]     = useState('ALL');
  const [loggingOut, setLoggingOut]   = useState(false);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const r = await api.get('/api/courses/');
      const isStudent = !user || user.role === 'STUDENT';
      setCourses(isStudent ? r.data.filter(c => c.is_approved && c.is_published) : r.data);
      setError('');
    } catch { setError('Failed to load courses. Please try again.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCourses(); }, []);

  const filtered = useMemo(() => courses.filter(c => {
    const q = searchTerm.toLowerCase();
    const matchSearch = c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    const matchLevel  = selectedLevel === 'ALL' || c.level === selectedLevel;
    return matchSearch && matchLevel;
  }), [courses, searchTerm, selectedLevel]);

  const handleLogout = async () => { setLoggingOut(true); await logout(); navigate('/login'); };

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} />
      <div className="inner-page">
        <header className="topbar">
          <div className="topbar-left">
            <h1>Course Catalog</h1>
            <p>Discover expert-led courses for your career</p>
          </div>
          <div className="topbar-right">
            <Link to="/profile" className="topbar-user">
              <div className="avatar-initials" style={{width:30,height:30,fontSize:12}}>
                {(user?.username||'U').slice(0,2).toUpperCase()}
              </div>
              <span className="topbar-user-name">{user?.username}</span>
            </Link>
          </div>
        </header>

        <div className="courses-page-wrap">
          <div className="page-header">
            <Link to="/dashboard" className="back-link"><i className="ti ti-arrow-left" /> Back to Dashboard</Link>
            <h1>Explore Courses</h1>
            <p>Acquire new skills from expert-led courses designed for your career progression.</p>
          </div>

          <div className="catalog-controls">
            <div className="search-wrap">
              <i className="ti ti-search" />
              <input placeholder="Search courses…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="filter-wrap">
              <label>Level:</label>
              <select value={selectedLevel} onChange={e => setLevel(e.target.value)}>
                <option value="ALL">All Levels</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
          </div>

          {error && <div className="alert alert-error">{error} <button className="btn btn-sm btn-secondary" onClick={fetchCourses}>Retry</button></div>}

          {loading ? (
            <div className="loading-container"><div className="loading-spinner" /><p>Loading courses…</p></div>
          ) : filtered.length === 0 ? (
            <div className="catalog-empty">
              <i className="ti ti-search-off" />
              <h3>No courses found</h3>
              <p>Try a different search term or level filter.</p>
            </div>
          ) : (
            <div className="courses-grid animate-fadeIn">
              {filtered.map(course => (
                <article key={course.id} className="course-card-catalog">
                  <div className={`cc-thumb ${THUMB[course.level] || 'cc-thumb-beg'}`}>
                    <i className={`ti ${ICON[course.level]||'ti-book'}`} style={{fontSize:44,opacity:0.5}} />
                    <span className={`badge badge-${course.level.toLowerCase()} cc-level-pill`} style={{position:'absolute',top:10,left:10}}>
                      {course.level}
                    </span>
                  </div>
                  <div className="cc-body">
                    <p className="cc-cat">{course.language}</p>
                    <h3 className="cc-title">{course.title}</h3>
                    <div className="cc-meta">
                      <span><i className="ti ti-clock" /> {course.duration_hours}h</span>
                      <span><i className="ti ti-user" /> {course.mentor?.username || 'Expert'}</span>
                    </div>
                  </div>
                  <div className="cc-footer">
                    <span className={`cc-price${course.price <= 0 ? ' free' : ''}`}>
                      {course.price > 0 ? `$${course.price}` : 'Free'}
                    </span>
                    <Link to={`/courses/${course.id}`} className="btn btn-primary btn-sm" style={{borderRadius:7}}>
                      {course.price > 0 ? 'View & Enroll' : 'Enroll Free'}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

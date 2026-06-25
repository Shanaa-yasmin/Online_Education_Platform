import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import './MentorDashboard.css';

function Sidebar({ user, onLogout, loggingOut }) {
  const isAdmin = user?.role === 'ADMIN';
  return (
    <aside className="sidebar">
      <div className="sidebar-logo-area">
        <Link to="/" className="nav-logo"><div className="nav-logo-mark"><i className="ti ti-trending-up" /></div><span className="nav-logo-text">Edu<span>Path</span></span></Link>
      </div>
      <nav className="sidebar-nav">
        <Link to="/dashboard" className="sidebar-nav-item"><i className="ti ti-layout-dashboard" /> Dashboard</Link>
        <Link to="/mentor/dashboard" className="sidebar-nav-item active"><i className="ti ti-award" /> Mentor Portal</Link>
        {isAdmin && <Link to="/admin/portal" className="sidebar-nav-item"><i className="ti ti-settings" /> Admin Portal</Link>}
        <Link to="/courses" className="sidebar-nav-item"><i className="ti ti-book" /> Courses</Link>
        <Link to="/profile" className="sidebar-nav-item"><i className="ti ti-user" /> Profile</Link>
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={onLogout} disabled={loggingOut}>
          {loggingOut?<><span className="loading-spinner loading-spinner-sm"/>Signing out…</>:<><i className="ti ti-logout"/>Sign out</>}
        </button>
      </div>
    </aside>
  );
}

const STATUS_MAP = (course) => {
  if (course.is_approved && course.is_published)  return { label:'Live',     cls:'badge-live' };
  if (course.is_approved && !course.is_published) return { label:'Approved', cls:'badge-approved' };
  if (!course.is_approved && course.is_published) return { label:'Pending',  cls:'badge-pending-mod' };
  return { label:'Draft', cls:'badge-draft' };
};

const EMPTY_FORM = { title:'', description:'', level:'BEGINNER', price:'0.00', language:'English', duration_hours:0 };

export default function MentorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loggingOut, setLoggingOut]   = useState(false);

  const fetchCourses = async () => {
    try { setLoading(true); const r = await api.get('/api/courses/'); setCourses(r.data.filter(c => c.mentor.id === user.id)); setError(''); }
    catch { setError('Failed to load courses.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchCourses(); }, [user]);

  const handleInput = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault(); setSubmitting(true); setSubmitError('');
    try {
      const payload = { ...form, price: parseFloat(form.price), duration_hours: parseInt(form.duration_hours)||0 };
      const r = await api.post('/api/courses/', payload);
      setCourses(p => [r.data, ...p]);
      setShowModal(false); setForm(EMPTY_FORM);
      navigate(`/mentor/courses/${r.data.id}/builder`);
    } catch (err) { setSubmitError(err.response?.data?.detail || 'Failed to create course.'); }
    finally { setSubmitting(false); }
  };

  const handleLogout = async () => { setLoggingOut(true); await logout(); navigate('/login'); };

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} />
      <div className="inner-page">
        <header className="topbar">
          <div className="topbar-left"><h1>Mentor Portal</h1><p>Manage your courses and curriculum</p></div>
          <div className="topbar-right">
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><i className="ti ti-plus" /> New Course</button>
          </div>
        </header>

        <div className="mentor-page-wrap">
          <div className="mentor-page-hd">
            <div>
              <Link to="/dashboard" className="back-link"><i className="ti ti-arrow-left" /> Back to Dashboard</Link>
              <h1 style={{fontFamily:'Fraunces,serif',fontSize:'clamp(1.4rem,2.5vw,1.9rem)',fontWeight:800,letterSpacing:'-0.02em',color:'var(--txt-1)'}}>Mentor Dashboard</h1>
              <p style={{fontSize:13.5,color:'var(--txt-3)',marginTop:3}}>Manage your catalog, build lessons, monitor publication status.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><i className="ti ti-plus" /> Create New Course</button>
          </div>

          {error && <div className="alert alert-error">{error} <button className="btn btn-sm btn-secondary" onClick={fetchCourses}>Retry</button></div>}

          {loading ? (
            <div className="loading-container"><div className="loading-spinner" /><p>Loading courses…</p></div>
          ) : courses.length === 0 ? (
            <div className="mentor-empty">
              <i className="ti ti-books" />
              <h3>Create your first course</h3>
              <p>Share your knowledge and start building modules, lessons, and interactive quizzes.</p>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create Course</button>
            </div>
          ) : (
            <div className="mentor-grid animate-fadeIn">
              {courses.map(course => {
                const st = STATUS_MAP(course);
                return (
                  <article key={course.id} className="mentor-course-card">
                    <div>
                      <div className="mc-header">
                        <span className={`badge badge-${course.level.toLowerCase()}`}>{course.level}</span>
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                      </div>
                      <h3 className="mc-title">{course.title}</h3>
                      <p className="mc-desc">{course.description}</p>
                      <div className="mc-meta">
                        <span className="mc-meta-item"><i className="ti ti-world" /> {course.language}</span>
                        <span className="mc-meta-item"><i className="ti ti-clock" /> {course.duration_hours}h</span>
                      </div>
                    </div>
                    <div className="mc-footer">
                      <span className={`mc-price${course.price<=0?' free':''}`}>{course.price>0?`$${course.price}`:'Free'}</span>
                      <Link to={`/mentor/courses/${course.id}/builder`} className="btn btn-secondary btn-sm">Manage Curriculum</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Course</h2>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}><i className="ti ti-x" /></button>
            </div>
            <form className="modal-form" onSubmit={handleCreate}>
              {submitError && <div className="alert alert-error">{submitError}</div>}
              <div className="form-group"><label>Course Title</label><input name="title" value={form.title} onChange={handleInput} placeholder="e.g. Intro to Data Science" required /></div>
              <div className="form-group"><label>Description</label><textarea name="description" value={form.description} onChange={handleInput} placeholder="What will students learn?" rows={3} required /></div>
              <div className="modal-form form-row-2">
                <div className="form-group"><label>Difficulty Level</label><select name="level" value={form.level} onChange={handleInput}><option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></div>
                <div className="form-group"><label>Price ($)</label><input name="price" type="number" value={form.price} onChange={handleInput} step="0.01" min="0" required /></div>
              </div>
              <div className="modal-form form-row-2">
                <div className="form-group"><label>Language</label><input name="language" value={form.language} onChange={handleInput} placeholder="English" required /></div>
                <div className="form-group"><label>Estimated Hours</label><input name="duration_hours" type="number" value={form.duration_hours} onChange={handleInput} min="0" required /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create Course'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

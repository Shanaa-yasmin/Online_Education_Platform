import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import { QAPanel } from './LearningPlayer.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
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
          {loggingOut ? <><span className="loading-spinner loading-spinner-sm" />Signing out…</> : <><i className="ti ti-logout" />Sign out</>}
        </button>
      </div>
    </aside>
  );
}

const STATUS_MAP = (course) => {
  if (course.is_approved && course.is_published) return { label: 'Live', cls: 'badge-live' };
  if (course.is_approved && !course.is_published) return { label: 'Approved', cls: 'badge-approved' };
  if (!course.is_approved && course.is_published) return { label: 'Pending', cls: 'badge-pending-mod' };
  return { label: 'Draft', cls: 'badge-draft' };
};

const EMPTY_FORM = { title: '', description: '', level: 'BEGINNER', price: '0.00', language: 'English', duration_hours: 0 };

export default function MentorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  // Thumbnail upload state
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setTabState] = useState(searchParams.get('tab') || 'courses');
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLP] = useState(true);
  const [paymentsError, setPE] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [selectedQACourse, setSelectedQACourse] = useState(null);

  const setTab = (tab) => {
    setTabState(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['courses', 'qa', 'payments'].includes(tabParam) && tabParam !== activeTab) {
      setTabState(tabParam);
    }
  }, [searchParams]);

  const fetchCourses = async () => {
    try { setLoading(true); const r = await api.get('/api/courses/'); setCourses(r.data.filter(c => String(c.mentor?.id || c.mentor) === String(user?.id))); setError(''); }
    catch { setError('Failed to load courses.'); }

    finally { setLoading(false); }
  };

  const fetchPayments = async () => {
    try { setLP(true); const r = await api.get('/api/payments/payments/'); setPayments(r.data); setPE(''); }
    catch { setPE('Failed to load payments logs.'); }
    finally { setLP(false); }
  };

  const actRefund = async (id) => {
    if (!window.confirm('Are you sure you want to refund this payment? The student will immediately lose access to the course.')) return;
    setActioningId(id);
    try {
      await api.post(`/api/payments/payments/${id}/refund/`);
      setPayments(p => p.map(pay => pay.id === id ? { ...pay, status: 'REFUNDED', refunded_at: new Date().toISOString() } : pay));
      alert('Payment refunded successfully. Student access revoked.');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to refund payment.');
    } finally {
      setActioningId(null);
    }
  };

  useEffect(() => { if (user) { fetchCourses(); fetchPayments(); } }, [user]);

  const handleInput = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  // ── Thumbnail handlers ──────────────────────────────────────────────
  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSubmitError('Please select a valid image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('Thumbnail image must be smaller than 5MB.');
      return;
    }

    setSubmitError('');
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const clearThumbnail = () => {
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(null);
    setThumbnailPreview(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setSubmitError('');
    clearThumbnail();
  };

  const handleCreate = async (e) => {
    e.preventDefault(); setSubmitting(true); setSubmitError('');
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('level', form.level);
      fd.append('price', parseFloat(form.price) || 0);
      fd.append('language', form.language);
      fd.append('duration_hours', parseInt(form.duration_hours) || 0);
      if (thumbnailFile) fd.append('thumbnail', thumbnailFile);

      const r = await api.post('/api/courses/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCourses(p => [r.data, ...p]);
      closeModal();
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
            <NotificationBell user={user} />
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><i className="ti ti-plus" /> New Course</button>
          </div>
        </header>

        <div className="mentor-page-wrap">
          <div className="mentor-page-hd">
            <div>
              <Link to="/dashboard" className="back-link"><i className="ti ti-arrow-left" /> Back to Dashboard</Link>
              <h1 style={{ fontFamily: 'Fraunces,serif', fontSize: 'clamp(1.4rem,2.5vw,1.9rem)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--txt-1)' }}>Mentor Dashboard</h1>
              <p style={{ fontSize: 13.5, color: 'var(--txt-3)', marginTop: 3 }}>Manage your catalog, build lessons, monitor publication status.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><i className="ti ti-plus" /> Create New Course</button>
          </div>

          {/* Tabs */}
          <div className="tab-row">
            <button className={`tab-btn${activeTab === 'courses' ? ' active' : ''}`} onClick={() => setTab('courses')}>
              My Courses ({courses.length})
            </button>
            <button className={`tab-btn${activeTab === 'qa' ? ' active' : ''}`} onClick={() => setTab('qa')}>
              Q&A Moderation
            </button>
            <button className={`tab-btn${activeTab === 'payments' ? ' active' : ''}`} onClick={() => setTab('payments')}>
              Course Sales ({payments.length})
            </button>
          </div>

          {activeTab === 'courses' && (
            <div>
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
                          {course.thumbnail && (
                            <div className="mc-thumb">
                              <img src={course.thumbnail} alt={course.title} />
                            </div>
                          )}
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
                          <span className={`mc-price${course.price <= 0 ? ' free' : ''}`}>{course.price > 0 ? `$${course.price}` : 'Free'}</span>
                          <Link to={`/mentor/courses/${course.id}/builder`} className="btn btn-secondary btn-sm">Manage Curriculum</Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'qa' && (
            <div className="qa-moderation-panel">
              <div className="qa-course-picker-header">
                <div>
                  <h3 style={{ fontFamily: 'Fraunces,serif', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Q&amp;A Moderation</h3>
                  <p style={{ fontSize: 13, color: 'var(--txt-3)', marginTop: 4 }}>Monitor, reply to, flag, hide, or delete student questions in real time.</p>
                </div>
                <div className="qa-course-picker-wrap">
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-3)' }}>Select Course</label>
                  <select
                    className="qa-course-select"
                    value={selectedQACourse ?? ''}
                    onChange={e => setSelectedQACourse(e.target.value || null)}
                  >
                    <option value="">— Pick a course —</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedQACourse ? (
                <div className="qa-embed-container">
                  <QAPanel courseId={selectedQACourse} user={user} />
                </div>
              ) : (
                <div className="qa-pick-prompt">
                  <span>💬</span>
                  <p>Select one of your courses above to open its live Q&amp;A chat.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              {paymentsError && <div className="alert alert-error">{paymentsError}</div>}
              {loadingPayments ? (
                <div className="loading-container"><div className="loading-spinner" /><p>Loading payments logs…</p></div>
              ) : payments.length === 0 ? (
                <div className="mentor-empty"><i className="ti ti-receipt" /><h3>No sales records found</h3><p>Payments for your courses will appear here.</p></div>
              ) : (
                <div className="payments-table-wrap">
                  <table className="payments-table">
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', height: 40, color: 'var(--txt-3)' }}>
                        <th style={{ padding: 8 }}>Student</th>
                        <th style={{ padding: 8 }}>Course</th>
                        <th style={{ padding: 8 }}>Amount</th>
                        <th style={{ padding: 8 }}>Gateway</th>
                        <th style={{ padding: 8 }}>Transaction ID</th>
                        <th style={{ padding: 8 }}>Status</th>
                        <th style={{ padding: 8 }}>Date</th>
                        <th style={{ padding: 8 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(pay => (
                        <tr key={pay.id} style={{ borderBottom: '1px solid var(--border)', height: 48 }}>
                          <td style={{ padding: 8 }}>
                            <div style={{ fontWeight: 600, color: 'var(--txt-1)' }}>@{pay.student?.username}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>{pay.student?.email}</div>
                          </td>
                          <td style={{ padding: 8, color: 'var(--txt-1)' }}>{pay.course_title}</td>
                          <td style={{ padding: 8, fontWeight: 600, color: 'var(--txt-1)' }}>${pay.amount}</td>
                          <td style={{ padding: 8 }}><span className="badge badge-beginner" style={{ background: '#edf2f7', color: '#4a5568' }}>{pay.gateway}</span></td>
                          <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 12, color: 'var(--txt-3)' }}>{pay.transaction_id}</td>
                          <td style={{ padding: 8 }}>
                            <span className={`badge ${pay.status === 'COMPLETED' ? 'badge-live' : pay.status === 'PENDING' ? 'badge-pending-mod' : 'badge-draft'}`}>
                              {pay.status}
                            </span>
                          </td>
                          <td style={{ padding: 8, color: 'var(--txt-3)' }}>{new Date(pay.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: 8 }}>
                            {pay.status === 'COMPLETED' ? (
                              <button
                                className="btn btn-danger btn-xs"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                onClick={() => actRefund(pay.id)}
                                disabled={actioningId !== null}
                              >
                                Refund
                              </button>
                            ) : pay.status === 'REFUNDED' ? (
                              <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>
                                Refunded
                              </span>
                            ) : (
                              <span style={{ color: 'var(--txt-3)' }}>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Course</h2>
              <button className="modal-close-btn" onClick={closeModal}><i className="ti ti-x" /></button>
            </div>
            <form className="modal-form" onSubmit={handleCreate}>
              {submitError && <div className="alert alert-error">{submitError}</div>}

              <div className="form-group"><label>Course Title</label><input name="title" value={form.title} onChange={handleInput} placeholder="e.g. Intro to Data Science" required /></div>
              <div className="form-group"><label>Description</label><textarea name="description" value={form.description} onChange={handleInput} placeholder="What will students learn?" rows={3} required /></div>

              {/* Thumbnail upload */}
              <div className="form-group">
                <label>Course Thumbnail</label>
                {thumbnailPreview ? (
                  <div className="thumbnail-preview-box">
                    <img src={thumbnailPreview} alt="Thumbnail preview" />
                    <button type="button" className="thumbnail-remove-btn" onClick={clearThumbnail} title="Remove image">
                      <i className="ti ti-x" />
                    </button>
                  </div>
                ) : (
                  <label className="thumbnail-dropzone">
                    <i className="ti ti-photo-plus" />
                    <span>Click to upload an image</span>
                    <small>PNG or JPG, up to 5MB</small>
                    <input type="file" accept="image/*" onChange={handleThumbnailChange} hidden />
                  </label>
                )}
              </div>

              <div className="modal-form form-row-2">
                <div className="form-group"><label>Difficulty Level</label><select name="level" value={form.level} onChange={handleInput}><option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></div>
                <div className="form-group"><label>Price ($)</label><input name="price" type="number" value={form.price} onChange={handleInput} step="0.01" min="0" required /></div>
              </div>
              <div className="modal-form form-row-2">
                <div className="form-group"><label>Language</label><input name="language" value={form.language} onChange={handleInput} placeholder="English" required /></div>
                <div className="form-group"><label>Estimated Hours</label><input name="duration_hours" type="number" value={form.duration_hours} onChange={handleInput} min="0" required /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create Course'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
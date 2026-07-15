import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import Sidebar from '../components/Sidebar.jsx';
import './AnnouncementsPage.css';

export default function AnnouncementsPage() {
  const { user, logout } = useAuth();
  const { announcementId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Creation States
  const [showModal, setShowModal] = useState(false);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    title: '',
    content: '',
    course: '',
    is_pinned: false,
    is_global: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // UI States
  const [expandedIds, setExpandedIds] = useState(new Set());
  const cardsRef = useRef({});

  const isMentor = user?.role === 'MENTOR';
  const isAdmin = user?.role === 'ADMIN';
  const canCreate = isMentor || isAdmin;

  // ── Fetch Announcements ──────────────────────────────────────────────────
  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/announcements/');
      setAnnouncements(res.data.results || res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // ── Fetch Courses for Create Dropdown ─────────────────────────────────────
  const fetchDropdownCourses = async () => {
    try {
      let res;
      if (isMentor) {
        // Mentors fetch their own courses
        res = await api.get('/api/courses/?created_by_me=true');
      } else if (isAdmin) {
        // Admins can select any course
        res = await api.get('/api/courses/');
      }
      setCourses(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load courses for selection', err);
    }
  };

  useEffect(() => {
    if (showModal && canCreate) {
      fetchDropdownCourses();
    }
  }, [showModal]);

  // ── Auto-Expand and Scroll to Deep-Linked Announcement ────────────────────
  useEffect(() => {
    if (!loading && announcementId && announcements.length > 0) {
      const targetId = parseInt(announcementId, 10);
      const targetExists = announcements.some(a => a.id === targetId);

      if (targetExists) {
        // Auto expand
        setExpandedIds(prev => {
          const next = new Set(prev);
          next.add(targetId);
          return next;
        });

        // Scroll to card
        setTimeout(() => {
          const cardEl = cardsRef.current[targetId];
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
      } else {
        // If not found in live announcements list, try retrieving it directly
        const fetchSingle = async () => {
          try {
            const res = await api.get(`/api/announcements/${targetId}/`);
            setAnnouncements(prev => [res.data, ...prev]);
            setExpandedIds(prev => {
              const next = new Set(prev);
              next.add(targetId);
              return next;
            });
            setTimeout(() => {
              const cardEl = cardsRef.current[targetId];
              if (cardEl) {
                cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 200);
          } catch (err) {
            setError('This announcement is no longer available.');
          }
        };
        fetchSingle();
      }
    }
  }, [announcementId, loading, announcements.length]);

  // ── Open creation modal from search query parameters if present ────────────
  useEffect(() => {
    if (searchParams.get('create') === 'true' && canCreate) {
      setShowModal(true);
      // Pre-fill course if provided
      const courseId = searchParams.get('courseId');
      if (courseId) {
        setForm(prev => ({
          ...prev,
          course: courseId,
          is_global: false
        }));
      }
    }
  }, [searchParams]);

  // ── Collapsible toggler ───────────────────────────────────────────────────
  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Handle Delete ────────────────────────────────────────────────────────
  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/api/announcements/${id}/`);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete announcement.');
    }
  };

  // ── Form input triggers ───────────────────────────────────────────────────
  const handleInput = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // ── Create Submission ─────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        title: form.title,
        content: form.content,
        is_pinned: form.is_pinned,
        course: (!form.is_global || isMentor) ? parseInt(form.course, 10) || null : null
      };

      const res = await api.post('/api/announcements/', payload);
      setAnnouncements(prev => [res.data, ...prev]);
      setShowModal(false);
      // Reset form
      setForm({
        title: '',
        content: '',
        course: '',
        is_pinned: false,
        is_global: true
      });
      // Clear query params if any
      if (searchParams.get('create')) {
        navigate('/announcements', { replace: true });
      }
    } catch (err) {
      setSubmitError(err.response?.data?.detail || err.response?.data?.course || 'Failed to publish announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Format Timestamp ─────────────────────────────────────────────────────
  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} active="announcements" />
      <div className="inner-content">
        <div className="announcements-container">
          
          <div className="announcements-header-row">
            <div className="announcements-title-section">
              <h1>Announcements</h1>
              <p>Stay updated with the latest news, updates, and course notices.</p>
            </div>
            {canCreate && (
              <button 
                className="new-announcement-btn"
                onClick={() => setShowModal(true)}
              >
                <i className="ti ti-plus" />
                <span>New Announcement</span>
              </button>
            )}
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

          {loading ? (
            <div className="flex-center" style={{ minHeight: '200px' }}>
              <span className="loading-spinner" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="announcements-empty">
              <i className="ti ti-speakerphone" />
              <p>No announcements posted yet.</p>
            </div>
          ) : (
            <div className="announcements-list">
              {announcements.map((a) => {
                const isExpanded = expandedIds.has(a.id);
                const isCreator = a.created_by === user?.id;
                const showDelete = isAdmin || (isMentor && isCreator);
                const isDeepLinked = parseInt(announcementId, 10) === a.id;

                return (
                  <div
                    key={a.id}
                    ref={el => cardsRef.current[a.id] = el}
                    className={`announcement-card ${a.is_pinned ? 'pinned-card' : ''} ${isDeepLinked ? 'highlighted-card' : ''}`}
                    onClick={() => toggleExpand(a.id)}
                  >
                    <div className="announcement-icon-wrap">
                      📢
                    </div>
                    
                    <div className="announcement-main">
                      <div className="announcement-top-row">
                        <div className="announcement-meta">
                          <span className="announcement-author">{a.created_by_name}</span>
                          <span className={`announcement-badge ${a.created_by_role === 'ADMIN' ? 'admin-badge' : 'mentor-badge'}`}>
                            {a.created_by_role}
                          </span>
                          {a.course_title && (
                            <span className="announcement-tag">
                              📚 {a.course_title}
                            </span>
                          )}
                          <span className="announcement-time">
                            {formatTimestamp(a.created_at)}
                          </span>
                        </div>
                        
                        <div className="announcement-pin-indicator">
                          {a.is_pinned && (
                            <>
                              <i className="ti ti-pin" />
                              <span>Pinned</span>
                            </>
                          )}
                        </div>
                      </div>

                      <h2 className="announcement-title">{a.title}</h2>
                      
                      <p className={`announcement-content ${isExpanded ? '' : 'collapsed'}`}>
                        {a.content}
                      </p>

                      <button 
                        className="announcement-read-more"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(a.id);
                        }}
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>

                      {showDelete && (
                        <div className="announcement-actions">
                          <button 
                            className="announcement-delete-btn"
                            onClick={(e) => handleDelete(e, a.id)}
                            title="Delete announcement"
                          >
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* ── CREATE ANNOUNCEMENT MODAL ───────────────────────────────────────── */}
      {showModal && (
        <div className="announcement-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="announcement-modal" onClick={e => e.stopPropagation()}>
            
            <div className="announcement-modal-header">
              <h2>Publish Announcement</h2>
              <button className="announcement-modal-close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="announcement-modal-body">
                <div className="announcement-form">
                  {submitError && <div className="alert alert-danger">{submitError}</div>}

                  <div className="announcement-form-group">
                    <label htmlFor="title">Announcement Title</label>
                    <input
                      id="title"
                      name="title"
                      type="text"
                      placeholder="e.g. Exam Schedule Release, Class Cancellation"
                      value={form.title}
                      onChange={handleInput}
                      required
                    />
                  </div>

                  <div className="announcement-form-group">
                    <label htmlFor="content">Content Details</label>
                    <textarea
                      id="content"
                      name="content"
                      placeholder="Write your announcement details here..."
                      value={form.content}
                      onChange={handleInput}
                      required
                    />
                  </div>

                  {isAdmin && (
                    <div className="announcement-form-group announcement-form-checkbox">
                      <input
                        id="is_global"
                        name="is_global"
                        type="checkbox"
                        checked={form.is_global}
                        onChange={handleInput}
                      />
                      <label htmlFor="is_global">Broadcast Globally (All students and mentors)</label>
                    </div>
                  )}

                  {/* Course Dropdown (Required for Mentors, Optional for Admins if not global) */}
                  {(isMentor || (isAdmin && !form.is_global)) && (
                    <div className="announcement-form-group">
                      <label htmlFor="course">Select Target Course</label>
                      <select
                        id="course"
                        name="course"
                        value={form.course}
                        onChange={handleInput}
                        required
                      >
                        <option value="">-- Choose a Course --</option>
                        {courses.map(c => (
                          <option key={c.id || c.course_id} value={c.id || c.course_id}>
                            {c.title || c.course_title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="announcement-form-group announcement-form-checkbox">
                    <input
                      id="is_pinned"
                      name="is_pinned"
                      type="checkbox"
                      checked={form.is_pinned}
                      onChange={handleInput}
                    />
                    <label htmlFor="is_pinned">Pin to the top of announcements</label>
                  </div>
                </div>
              </div>

              <div className="announcement-modal-footer">
                <button 
                  type="button" 
                  className="announcement-modal-cancel"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="announcement-modal-submit"
                  disabled={submitting}
                >
                  {submitting ? (
                    <><span className="loading-spinner loading-spinner-sm" /> Publishing...</>
                  ) : (
                    <>Publish Now</>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}

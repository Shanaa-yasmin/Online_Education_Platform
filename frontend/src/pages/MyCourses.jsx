import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import Sidebar from '../components/Sidebar.jsx';
import Footer from '../components/Footer.jsx';
import './MyCourses.css';

const LEVEL_ICON = { BEGINNER: 'ti-leaf', INTERMEDIATE: 'ti-flame', ADVANCED: 'ti-bolt' };
const LEVEL_ICON_BG = { BEGINNER: 'var(--brand-light)', INTERMEDIATE: 'var(--warning-bg)', ADVANCED: 'var(--info-bg)' };
const LEVEL_ICON_COLOR = { BEGINNER: 'var(--brand)', INTERMEDIATE: 'var(--warning)', ADVANCED: 'var(--info)' };

const EMPTY_FORM = { title: '', description: '', level: 'BEGINNER', price: '0.00', language: 'English', duration_hours: 0, category: 'Development' };

export default function MyCourses() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'in_progress', 'completed'
  const [loggingOut, setLoggingOut] = useState(false);

  // Course creation states
  const [showModal, setShowModal] = useState(false);
  const [showApprovalNotice, setShowApprovalNotice] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);

  const handleCreateCourseClick = () => {
    const isMentor = user?.role === 'MENTOR';
    const isAdmin = user?.is_staff || user?.role === 'ADMIN';
    const isApproved = user?.profile?.is_approved;

    if (isMentor && !isAdmin && !isApproved) {
      setShowApprovalNotice(true);
      return;
    }
    setShowModal(true);
  };

  const handleInput = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

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
      fd.append('category', form.category);
      if (thumbnailFile) fd.append('thumbnail', thumbnailFile);

      const r = await api.post('/api/courses/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const newCourseNormalized = {
        course_id: r.data.id,
        course_title: r.data.title,
        course_thumbnail: r.data.thumbnail,
        progress_percent: 0,
        completed_lessons_count: 0,
        total_lessons_count: 0,
        is_mentor_view: true,
        is_published: r.data.is_published,
        is_approved: r.data.is_approved
      };
      
      setCourses(p => [newCourseNormalized, ...p]);
      closeModal();
      navigate(`/mentor/courses/${r.data.id}/builder`);
    } catch (err) {
      setSubmitError(err.response?.data?.detail || 'Failed to create course.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchMyCourses = async () => {
      try {
        setLoading(true);
        let data = [];
        if (user && user.role === 'MENTOR') {
          const r = await api.get('/api/courses/?created_by_me=true');
          const results = r.data.results || r.data;
          data = results.map(c => ({
            course_id: c.id,
            course_title: c.title,
            course_thumbnail: c.thumbnail,
            progress_percent: 0,
            completed_lessons_count: 0,
            total_lessons_count: 0,
            is_mentor_view: true,
            is_published: c.is_published,
            is_approved: c.is_approved
          }));
        } else {
          const r = await api.get('/api/progress/');
          data = r.data;
        }
        if (active) {
          setCourses(data);
          setError('');
        }
      } catch (err) {
        if (active) {
          setError(user?.role === 'MENTOR' ? 'Failed to load your created courses.' : 'Failed to load your enrolled courses.');
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
    
    if (item.is_mentor_view) {
      if (filterTab === 'published') {
        return matchesSearch && item.is_published;
      }
      if (filterTab === 'draft') {
        return matchesSearch && !item.is_published;
      }
      return matchesSearch;
    }

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

        {/* Content */}
        <div className="inner-content">
          <div className="my-courses-header-section">
            <div className="my-courses-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
              <div className="page-header" style={{ margin: 0 }}>
                <h1>My Courses</h1>
                <p>{user?.role === 'MENTOR' ? 'Manage your course catalog, publication status, and curriculum.' : 'Keep track of your studies, review progress, and access class materials.'}</p>
              </div>
              {user?.role === 'MENTOR' && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-secondary" style={{ height: 42, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navigate('/announcements?create=true')}>
                    <i className="ti ti-speakerphone" /> Add Announcement
                  </button>
                  <button className="btn btn-primary" style={{ height: 42 }} onClick={handleCreateCourseClick}>
                    <i className="ti ti-plus" /> Create Course
                  </button>
                </div>
              )}
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
                {user?.role === 'MENTOR' ? (
                  <>
                    <button
                      className={`tab-btn ${filterTab === 'published' ? 'active' : ''}`}
                      onClick={() => setFilterTab('published')}
                    >
                      Published ({courses.filter(c => c.is_published).length})
                    </button>
                    <button
                      className={`tab-btn ${filterTab === 'draft' ? 'active' : ''}`}
                      onClick={() => setFilterTab('draft')}
                    >
                      Drafts ({courses.filter(c => !c.is_published).length})
                    </button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
                  user?.role === 'MENTOR' ? (
                    <>
                      <p>You have not created any courses yet.</p>
                      <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        Create Your First Course
                      </button>
                    </>
                  ) : (
                    <>
                      <p>You are not enrolled in any courses yet.</p>
                      <button className="btn btn-primary" onClick={() => navigate('/courses')}>
                        Browse Course Catalog
                      </button>
                    </>
                  )
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
                    onClick={() => navigate(item.is_mentor_view ? `/mentor/courses/${item.course_id}/builder` : `/courses/${item.course_id}`)}
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
                        {item.is_mentor_view ? (
                          <>
                            <span className="badge badge-brand">Created</span>
                            {item.is_published ? (
                              <span className="badge badge-success">Published</span>
                            ) : item.is_approved ? (
                              <span className="badge badge-beginner" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>Approved</span>
                            ) : (
                              <span className="badge badge-beginner" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>Draft</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="badge badge-brand">Enrolled</span>
                            {isComplete ? (
                              <span className="badge badge-success">Completed</span>
                            ) : (
                              <span className="badge badge-beginner" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                                In Progress
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      <h3 className="my-courses-card-title">{item.course_title}</h3>
                      {item.is_mentor_view ? (
                        <p className="my-courses-card-subtitle">
                          Role: Mentor (Creator)
                        </p>
                      ) : (
                        <p className="my-courses-card-subtitle">
                          Lessons: {item.completed_lessons_count} / {item.total_lessons_count}
                        </p>
                      )}

                      {!item.is_mentor_view && (
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
                      )}

                      <div className="my-courses-card-actions">
                        {item.is_mentor_view ? (
                          <button
                            className="btn btn-primary w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/mentor/courses/${item.course_id}/builder`);
                            }}
                          >
                            Manage Course
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/courses/${item.course_id}/learn`);
                            }}
                          >
                            {isComplete ? 'Review Course Material' : progress > 0 ? 'Continue Learning' : 'Start Learning'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <Footer />
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

              <div className="form-group">
                <label>Course Title</label>
                <input name="title" value={form.title} onChange={handleInput} placeholder="e.g. Intro to Data Science" required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea name="description" value={form.description} onChange={handleInput} placeholder="What will students learn?" rows={3} required />
              </div>

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
                <div className="form-group">
                  <label>Difficulty Level</label>
                  <select name="level" value={form.level} onChange={handleInput}>
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Price ($)</label>
                  <input name="price" type="number" value={form.price} onChange={handleInput} step="0.01" min="0" required />
                </div>
              </div>
              <div className="modal-form form-row-2">
                <div className="form-group">
                  <label>Language</label>
                  <input name="language" value={form.language} onChange={handleInput} placeholder="English" required />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select name="category" value={form.category} onChange={handleInput}>
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Business">Business</option>
                    <option value="Marketing">Marketing</option>
                    <option value="IT & Software">IT & Software</option>
                    <option value="Personal Development">Personal Development</option>
                    <option value="Data Science">Data Science</option>
                  </select>
                </div>
              </div>
              <div className="modal-form form-row-2">
                <div className="form-group">
                  <label>Estimated Hours</label>
                  <input name="duration_hours" type="number" value={form.duration_hours} onChange={handleInput} min="0" required />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create Course'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mentor Approval Required Modal */}
      {showApprovalNotice && (
        <div className="modal-overlay" onClick={() => setShowApprovalNotice(false)}>
          <div className="modal-content animate-scaleIn" style={{ maxWidth: 440, textAlign: 'center', padding: '32px 24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#FFFBE6', border: '1px solid #FFE58F', color: '#FAAD14', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 30 }}>
              <i className="ti ti-alert-circle" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>Approval Required</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              Administrator should approve to create course.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', height: 42 }} onClick={() => setShowApprovalNotice(false)}>
              Understand & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

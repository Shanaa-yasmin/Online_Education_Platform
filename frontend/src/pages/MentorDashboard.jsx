import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import './MentorDashboard.css';

// SVGs as inline components
const BookOpenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19" />
    <line x1="5" x2="19" y1="12" y2="12" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" x2="22" y1="12" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18" />
    <line x1="6" x2="18" y1="6" y2="18" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" x2="5" y1="12" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export default function MentorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create Course Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: 'BEGINNER',
    price: '0.00',
    language: 'English',
    duration_hours: 0
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchMentorCourses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/courses/');
      // Filter only mentor's created courses
      const ownedCourses = response.data.filter(c => c.mentor.id === user.id);
      setCourses(ownedCourses);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to fetch courses. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMentorCourses();
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        duration_hours: parseInt(formData.duration_hours, 10) || 0
      };
      const response = await api.post('/api/courses/', payload);
      setCourses(prev => [response.data, ...prev]);
      setShowCreateModal(false);
      // Reset form
      setFormData({
        title: '',
        description: '',
        level: 'BEGINNER',
        price: '0.00',
        language: 'English',
        duration_hours: 0
      });
      // Redirect to course builder
      navigate(`/mentor/courses/${response.data.id}/builder`);
    } catch (err) {
      console.error(err);
      setSubmitError(err.response?.data?.detail || 'Failed to create course. Ensure fields are valid.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (course) => {
    if (course.is_approved && course.is_published) {
      return <span className="status-badge live">Live</span>;
    } else if (course.is_approved && !course.is_published) {
      return <span className="status-badge approved">Approved (Draft)</span>;
    } else if (!course.is_approved && course.is_published) {
      return <span className="status-badge pending">Pending Approval</span>;
    } else {
      return <span className="status-badge draft">Draft</span>;
    }
  };

  return (
    <div className="mentor-dash-page">
      <div className="mentor-header">
        <div>
          <Link to="/dashboard" className="back-link">
            <ArrowLeftIcon /> Back to Student Dashboard
          </Link>
          <h1 className="mentor-title">Mentor Dashboard</h1>
          <p className="mentor-subtitle">Manage your catalog, build lessons, and monitor publication status.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <PlusIcon /> Create New Course
        </button>
      </div>

      {error && (
        <div className="alert alert-error max-w-1200">
          {error}
          <button className="btn btn-sm btn-secondary" onClick={fetchMentorCourses}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading courses...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="mentor-empty-state">
          <div className="empty-icon">📚</div>
          <h3>Create your first course</h3>
          <p>Share your knowledge and start building modules, text summaries, and interactive quizzes.</p>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            Create Course Shell
          </button>
        </div>
      ) : (
        <section className="mentor-courses-grid animate-fadeIn">
          {courses.map((course) => (
            <article key={course.id} className="mentor-course-card">
              <div className="card-top">
                <div className="card-header-row">
                  <span className={`level-tag ${course.level.toLowerCase()}`}>{course.level}</span>
                  {getStatusBadge(course)}
                </div>
                <h3 className="course-card-title">{course.title}</h3>
                <p className="course-card-desc">{course.description}</p>
              </div>

              <div className="card-details">
                <div className="details-row">
                  <span className="detail-item"><GlobeIcon /> {course.language}</span>
                  <span className="detail-item"><ClockIcon /> {course.duration_hours}h estimated</span>
                </div>
                <div className="card-footer-row">
                  <span className="course-price">
                    {course.price > 0 ? `$${course.price}` : 'Free'}
                  </span>
                  <Link to={`/mentor/courses/${course.id}/builder`} className="btn btn-secondary btn-sm">
                    Manage Curriculum
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Course Shell</h2>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="modal-form">
              {submitError && <div className="alert alert-error">{submitError}</div>}

              <div className="form-group">
                <label htmlFor="course-title">Course Title</label>
                <input
                  type="text"
                  id="course-title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g. Intro to Data Science"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="course-desc">Description</label>
                <textarea
                  id="course-desc"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Summarize what students will learn in this course..."
                  rows="4"
                  required
                />
              </div>

              <div className="form-row-grid">
                <div className="form-group">
                  <label htmlFor="course-level">Difficulty Level</label>
                  <select
                    id="course-level"
                    name="level"
                    value={formData.level}
                    onChange={handleInputChange}
                  >
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="course-price">Price ($)</label>
                  <input
                    type="number"
                    id="course-price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="form-row-grid">
                <div className="form-group">
                  <label htmlFor="course-lang">Language</label>
                  <input
                    type="text"
                    id="course-lang"
                    name="language"
                    value={formData.language}
                    onChange={handleInputChange}
                    placeholder="English, Spanish, etc."
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="course-duration">Estimated Hours</label>
                  <input
                    type="number"
                    id="course-duration"
                    name="duration_hours"
                    value={formData.duration_hours}
                    onChange={handleInputChange}
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
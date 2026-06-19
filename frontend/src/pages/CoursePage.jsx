import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import './CoursePage.css';

// SVG Icons
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const BookOpenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="6 3 20 12 6 21 6 3"/>
  </svg>
);
const FileTextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>
  </svg>
);
const QuizIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="m9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/>
  </svg>
);
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18"/>
    <line x1="6" x2="18" y1="6" y2="18"/>
  </svg>
);

export default function CoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Data States
  const [course, setCourse] = useState(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState({
    enrolled: false,
    is_active: false,
    progress_percent: 0.00
  });

  // Action States
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch course details
      const courseResponse = await api.get(`/api/courses/${courseId}/`);
      setCourse(courseResponse.data);

      // Fetch enrollment check
      if (user) {
        const enrollResponse = await api.get(`/api/payments/enrollments/check/?course_id=${courseId}`);
        setEnrollmentStatus(enrollResponse.data);
      }
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to load course details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [courseId, user]);

  const handleEnrollClick = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (course.price > 0) {
      setShowCheckoutModal(true);
    } else {
      processEnrollment();
    }
  };

  const processEnrollment = async (mockTransactionId = null) => {
    setEnrolling(true);
    setCheckoutError('');
    try {
      const payload = { course: courseId };
      if (mockTransactionId) {
        payload.transaction_id = mockTransactionId;
      }
      await api.post('/api/payments/enrollments/', payload);
      setEnrollmentStatus({
        enrolled: true,
        is_active: true,
        progress_percent: 0.00
      });
      setShowCheckoutModal(false);
      // Redirect directly to learning classroom
      navigate(`/courses/${courseId}/learn`);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || 'Failed to complete enrollment.';
      if (mockTransactionId) {
        setCheckoutError(detail);
      } else {
        alert(detail);
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleMockPaymentSubmit = (e) => {
    e.preventDefault();
    const mockTxId = 'ch_' + Math.random().toString(36).substring(2, 12).toUpperCase();
    processEnrollment(mockTxId);
  };

  const getLessonIcon = (type) => {
    switch (type) {
      case 'VIDEO': return <PlayIcon />;
      case 'PDF': return <FileTextIcon />;
      case 'QUIZ': return <QuizIcon />;
      default: return <FileTextIcon />;
    }
  };

  if (loading) {
    return (
      <div className="course-detail-loading">
        <div className="loading-spinner"></div>
        <p>Loading course content...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="course-detail-error">
        <h2>Error loading Course</h2>
        <p className="alert alert-error">{error || 'Course not found'}</p>
        <Link to="/courses" className="btn btn-primary">Back to Catalog</Link>
      </div>
    );
  }

  return (
    <div className="student-course-page">
      {/* Back button */}
      <Link to="/courses" className="back-link">
        <ArrowLeftIcon /> Back to Explore
      </Link>

      <div className="course-detail-layout">
        {/* Left Side: Course Info & Curriculum */}
        <div className="course-info-side">
          <span className={`difficulty-tag ${course.level.toLowerCase()}`}>{course.level} Level</span>
          <h1 className="course-detail-title">{course.title}</h1>
          <p className="mentor-row">
            Created by <strong>{course.mentor?.username || 'Expert'}</strong>
          </p>
          <div className="course-description-block">
            <h3>Course Overview</h3>
            <p>{course.description}</p>
          </div>

          {/* Curriculum Section */}
          <div className="course-curriculum-block">
            <h3>Course Curriculum</h3>
            {course.modules?.length === 0 ? (
              <p className="curriculum-empty">No curriculum sections have been published for this course yet.</p>
            ) : (
              <div className="curriculum-modules-list">
                {course.modules.map(module => (
                  <div key={module.id} className="curriculum-module-item">
                    <div className="module-title-row">
                      <h4>{module.title}</h4>
                      <span className="lesson-count-pill">{module.lessons?.length || 0} items</span>
                    </div>
                    <div className="module-lessons-bullets">
                      {module.lessons?.map(lesson => (
                        <div key={lesson.id} className="curriculum-lesson-bullet">
                          <span className="bullet-icon">{getLessonIcon(lesson.content_type)}</span>
                          <span className="bullet-title">{lesson.title}</span>
                          <span className="bullet-type">{lesson.content_type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Card Box with Price, Duration & CTA Action */}
        <aside className="course-enrollment-card">
          <div className="price-tag-row">
            <span className="price-lbl">Course Tuition</span>
            <span className="price-amount">{course.price > 0 ? `$${course.price}` : 'Free'}</span>
          </div>

          <div className="card-specs">
            <div className="spec-row">
              <GlobeIcon />
              <span>Language: <strong>{course.language}</strong></span>
            </div>
            <div className="spec-row">
              <ClockIcon />
              <span>Duration: <strong>{course.duration_hours}h estimated</strong></span>
            </div>
            <div className="spec-row">
              <BookOpenIcon />
              <span>Modules: <strong>{course.modules?.length || 0} sections</strong></span>
            </div>
          </div>

          {/* Enrollment CTA Block */}
          <div className="cta-action-block">
            {enrollmentStatus.enrolled && enrollmentStatus.is_active ? (
              <div className="enrolled-status-box">
                <div className="progress-bar-row">
                  <span>Course Progress</span>
                  <span>{enrollmentStatus.progress_percent}%</span>
                </div>
                <div className="progress-track-bg">
                  <div className="progress-track-fill" style={{ width: `${enrollmentStatus.progress_percent}%` }}></div>
                </div>
                <Link to={`/courses/${courseId}/learn`} className="btn btn-primary w-full text-center">
                  Go to Classroom
                </Link>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-lg w-full"
                onClick={handleEnrollClick}
                disabled={enrolling}
              >
                {enrolling ? 'Processing...' : course.price > 0 ? 'Buy & Enroll' : 'Enroll Now'}
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Mock Checkout Modal for Paid Courses */}
      {showCheckoutModal && (
        <div className="modal-overlay" onClick={() => setShowCheckoutModal(false)}>
          <div className="modal-content checkout-modal animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Secure Checkout (Mock Sandbox)</h2>
              <button className="modal-close-btn" onClick={() => setShowCheckoutModal(false)}>
                <CloseIcon />
              </button>
            </div>
            
            <form onSubmit={handleMockPaymentSubmit} className="modal-form">
              {checkoutError && <div className="alert alert-error">{checkoutError}</div>}
              
              <div className="order-summary-box">
                <p><strong>Item:</strong> {course.title} (Online Access)</p>
                <p><strong>Total Amount:</strong> <span className="price-tag-modal">${course.price}</span></p>
              </div>

              <div className="alert alert-warning">
                This is a mock sandbox checkout session. No real money will be charged. Click "Pay & Enroll" to complete.
              </div>

              <div className="form-group">
                <label>Cardholder Name</label>
                <input type="text" placeholder="e.g. Shanaa Yasmin" required defaultValue={user?.username || ''} />
              </div>

              <div className="form-group">
                <label>Mock Card Number</label>
                <input type="text" placeholder="XXXX-XXXX-XXXX-4242" required defaultValue="4242-4242-4242-4242" disabled />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCheckoutModal(false)}
                  disabled={enrolling}
                >
                  Cancel Order
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={enrolling}
                >
                  {enrolling ? 'Processing...' : 'Pay & Enroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

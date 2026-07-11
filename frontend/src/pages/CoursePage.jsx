import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import ReviewsList from '../components/reviews/ReviewsList';
import './CoursePage.css';

// ── Icons ──────────────────────────────────────────────────────────────────
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" x2="5" y1="12" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" x2="22" y1="12" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const BookOpenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);
const FileTextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </svg>
);
const QuizIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="m9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" x2="12.01" y1="17" y2="17" />
  </svg>
);
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18" />
    <line x1="6" x2="18" y1="6" y2="18" />
  </svg>
);
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// ── Component ──────────────────────────────────────────────────────────────
export default function CoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Data
  const [course, setCourse] = useState(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState({
    enrolled: false, is_active: false, progress_percent: 0,
  });

  // UI
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState('STRIPE');
  const [checkoutError, setCheckoutError] = useState('');
  const [pageError, setPageError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');

  // Scroll to reviews section if hash matches
  useEffect(() => {
    if (location.hash === '#reviews' && !loading) {
      const element = document.getElementById('reviews-section');
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      }
    }
  }, [location.hash, loading]);

  // ── Load course + enrollment ────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoading(true);
      const courseRes = await api.get(`/api/courses/${courseId}/`);
      setCourse(courseRes.data);

      if (user) {
        const enrollRes = await api.get(
          `/api/payments/enrollments/check/?course_id=${courseId}`
        );
        setEnrollmentStatus(enrollRes.data);
      }
      setPageError('');
    } catch (err) {
      console.error(err);
      setPageError('Failed to load course details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [courseId, user]);

  // ── Handle return from Stripe / PayPal ─────────────────────────────────
  useEffect(() => {
    const isSuccess = searchParams.get('payment_success') === 'true';
    const isCancel = searchParams.get('payment_cancel') === 'true';

    if (isCancel) {
      alert('Checkout was cancelled. You have not been charged.');
      setSearchParams({});
      return;
    }

    if (!isSuccess) return;

    const gateway = searchParams.get('gateway');
    const sessionId = searchParams.get('session_id');   // Stripe
    const orderId = searchParams.get('order_id');     // PayPal (not used — captured server-side)

    const verifyPayment = async () => {
      setVerifying(true);
      setVerifyMsg('Verifying your payment…');

      const payload = { gateway, course_id: courseId };
      if (gateway === 'stripe') payload.session_id = sessionId;
      if (gateway === 'paypal') payload.order_id = orderId;

      try {
        const res = await api.post('/api/payments/checkout/verify/', payload);
        if (res.data.verified) {
          setVerifyMsg('Payment confirmed! Launching classroom…');
          setTimeout(() => {
            setSearchParams({});
            navigate(`/courses/${courseId}/learn`);
          }, 1500);
        } else {
          alert(res.data.detail || 'Payment verification failed. Please contact support.');
          setSearchParams({});
        }
      } catch (err) {
        console.error(err);
        alert(
          err.response?.data?.detail ||
          'An error occurred during payment verification. Please contact support.'
        );
        setSearchParams({});
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [searchParams, courseId]);

  // ── Enroll (free courses) ───────────────────────────────────────────────
  const handleEnrollClick = () => {
    if (!user) { navigate('/login'); return; }
    if (parseFloat(course.price) > 0) {
      setShowCheckout(true);
    } else {
      enrollFree();
    }
  };

  const enrollFree = async () => {
    setEnrolling(true);
    try {
      await api.post('/api/payments/enrollments/', { course: courseId });
      setEnrollmentStatus({ enrolled: true, is_active: true, progress_percent: 0 });
      navigate(`/courses/${courseId}/learn`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Enrollment failed. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  // ── Checkout submit — redirect to Stripe or PayPal ─────────────────────
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    setEnrolling(true);
    setCheckoutError('');

    try {
      const res = await api.post('/api/payments/checkout/create-session/', {
        course_id: courseId,
        gateway: selectedGateway,
      });

      const { checkout_url } = res.data;
      if (!checkout_url) throw new Error('Server did not return a checkout URL.');

      // Full-page redirect to Stripe Checkout or PayPal approval page
      window.location.href = checkout_url;

    } catch (err) {
      console.error(err);
      setCheckoutError(
        err.response?.data?.detail || 'Failed to initialise checkout. Please try again.'
      );
      setEnrolling(false);
    }
    // Note: do NOT call setEnrolling(false) on success — the page is navigating away.
  };

  const getLessonIcon = (type) => {
    switch (type) {
      case 'VIDEO': return <PlayIcon />;
      case 'PDF': return <FileTextIcon />;
      case 'QUIZ': return <QuizIcon />;
      default: return <FileTextIcon />;
    }
  };

  // ── Render guards ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="course-detail-loading">
        <div className="loading-spinner"></div>
        <p>Loading course…</p>
      </div>
    );
  }

  if (pageError || !course) {
    return (
      <div className="course-detail-error">
        <h2>Error loading course</h2>
        <p className="alert alert-error">{pageError || 'Course not found.'}</p>
        <Link to="/courses" className="btn btn-primary">Back to Catalog</Link>
      </div>
    );
  }

  const isPaid = parseFloat(course.price) > 0;
  const isEnrolled = enrollmentStatus.enrolled && enrollmentStatus.is_active;
  const isOwnerMentor = user && course.mentor && user.id === course.mentor.id;

  return (
    <div className="student-course-page">
      <button onClick={() => navigate(-1)} className="back-link btn-link" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px', padding: 0 }}>
        <ArrowLeftIcon /> Back
      </button>

      <div className="course-detail-layout">
        {/* ── Left: Course Info ─────────────────────────────────────────── */}
        <div className="course-info-side">
          <span className={`difficulty-tag ${course.level?.toLowerCase()}`}>
            {course.level} Level
          </span>
          <div className="course-title-row">
            <h1 className="course-detail-title">{course.title}</h1>
            {isOwnerMentor && (
              <Link
                to={`/mentor/courses/${courseId}/builder`}
                className="btn btn-primary btn-sm"
              >
                Manage Curriculum
              </Link>
            )}
          </div>
          <p className="mentor-row">
            Created by <strong>{course.mentor?.username || 'Expert'}</strong>
          </p>

          <div className="course-description-block">
            <h3>Course Overview</h3>
            <p>{course.description}</p>
          </div>

          <div className="course-curriculum-block">
            <h3>Course Curriculum</h3>
            {!course.modules?.length ? (
              <p className="curriculum-empty">No curriculum has been published yet.</p>
            ) : (
              <div className="curriculum-modules-list">
                {course.modules.map(mod => (
                  <div key={mod.id} className="curriculum-module-item">
                    <div className="module-title-row">
                      <h4>{mod.title}</h4>
                      <span className="lesson-count-pill">
                        {mod.lessons?.length || 0} items
                      </span>
                    </div>
                    <div className="module-lessons-bullets">
                      {mod.lessons?.map(lesson => (
                        <div key={lesson.id} className="curriculum-lesson-bullet">
                          <span className="bullet-icon">{getLessonIcon(lesson.content_type)}</span>
                          <span className="bullet-title">
                            {(isEnrolled || isOwnerMentor) ? (
                              <Link to={`/courses/${courseId}/learn?lesson=${lesson.id}`} className="lesson-preview-link" style={{ color: 'inherit', textDecoration: 'none' }}>
                                {lesson.title}
                              </Link>
                            ) : (
                              lesson.title
                            )}
                          </span>
                          <span className="bullet-type">{lesson.content_type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Reviews Section ──────────────────────────────────────── */}
          <div id="reviews-section">
            <ReviewsList
              courseId={courseId}
              isEnrolled={isEnrolled}
              user={user}
            />
          </div>
        </div>

        {/* ── Right: Enrollment Card ───────────────────────────────────── */}
        <aside className="course-enrollment-card">
          <div className="price-tag-row">
            <span className="price-lbl">Course Tuition</span>
            <span className={`price-amount${isPaid ? '' : ' free'}`}>
              {isPaid ? `$${parseFloat(course.price).toFixed(2)}` : 'Free'}
            </span>
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

          <div className="cta-action-block">
            {isEnrolled ? (
              <div className="enrolled-status-box">
                <div className="progress-bar-row">
                  <span>Course Progress</span>
                  <span>{enrollmentStatus.progress_percent}%</span>
                </div>
                <div className="block-progress-visual" style={{ letterSpacing: '1px', fontSize: '18px', color: 'var(--brand)', margin: '5px 0 15px 0', fontFamily: 'monospace' }}>
                  {(() => {
                    const totalBlocks = 10;
                    const filled = Math.round((enrollmentStatus.progress_percent / 100) * totalBlocks);
                    return '█'.repeat(filled) + '░'.repeat(totalBlocks - filled);
                  })()}
                </div>
                <div className="progress-track-bg">
                  <div
                    className="progress-track-fill"
                    style={{ width: `${enrollmentStatus.progress_percent}%` }}
                  />
                </div>
                <Link
                  to={`/courses/${courseId}/learn`}
                  className="btn btn-primary w-full text-center"
                >
                  Go to Classroom
                </Link>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-lg w-full"
                onClick={handleEnrollClick}
                disabled={enrolling}
              >
                {enrolling
                  ? 'Processing…'
                  : isPaid
                    ? 'Buy & Enroll'
                    : 'Enroll Now — Free'}
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* ── Checkout Modal ─────────────────────────────────────────────── */}
      {showCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
          <div
            className="modal-content checkout-modal animate-scaleIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Secure Checkout</h2>
              <button className="modal-close-btn" onClick={() => setShowCheckout(false)}>
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="modal-form">
              {checkoutError && (
                <div className="alert alert-error">{checkoutError}</div>
              )}

              <div className="order-summary-box">
                <p><strong>Course:</strong> {course.title}</p>
                <p>
                  <strong>Total:</strong>{' '}
                  <span className="price-tag-modal">
                    ${parseFloat(course.price).toFixed(2)}
                  </span>
                </p>
              </div>

              {/* Gateway selector */}
              <div className="payment-gateway-selector">
                <label className="gateway-option-label">Select Payment Method</label>
                <div className="gateway-options-grid">
                  {/* Stripe */}
                  <div
                    className={`gateway-option${selectedGateway === 'STRIPE' ? ' selected' : ''}`}
                    onClick={() => setSelectedGateway('STRIPE')}
                  >
                    <div className="gateway-radio">
                      <div className="radio-circle" />
                    </div>
                    <span className="gateway-name">💳 Stripe</span>
                    <span className="gateway-desc">Credit / Debit card via Stripe Checkout</span>
                  </div>

                  {/* PayPal */}
                  <div
                    className={`gateway-option${selectedGateway === 'PAYPAL' ? ' selected' : ''}`}
                    onClick={() => setSelectedGateway('PAYPAL')}
                  >
                    <div className="gateway-radio">
                      <div className="radio-circle" />
                    </div>
                    <span className="gateway-name">🅿 PayPal</span>
                    <span className="gateway-desc">Pay via PayPal Sandbox account</span>
                  </div>
                </div>
              </div>

              {/* Test-mode reminder (remove before going live) */}
              <div className="alert alert-warning" style={{ fontSize: 12 }}>
                <strong>Test mode.</strong> Use Stripe card <code>4242 4242 4242 4242</code> or
                your PayPal Sandbox buyer account.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCheckout(false)}
                  disabled={enrolling}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={enrolling}
                >
                  {enrolling
                    ? 'Redirecting…'
                    : `Pay with ${selectedGateway === 'STRIPE' ? 'Stripe' : 'PayPal'}`}
                  {!enrolling && <LockIcon />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Payment Verification Overlay ───────────────────────────────── */}
      {verifying && (
        <div className="modal-overlay verifying-overlay">
          <div className="verification-card text-center animate-scaleIn">
            <div className="loading-spinner large" />
            <h3>Confirming Payment</h3>
            <p>{verifyMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api.js';
import './AdminPanel.css';

// SVG Icons
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
  </svg>
);

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'mentors'
  
  // Data States
  const [pendingCourses, setPendingCourses] = useState([]);
  const [pendingMentors, setPendingMentors] = useState([]);
  
  // Loading & Error States
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingMentors, setLoadingMentors] = useState(true);
  const [coursesError, setCoursesError] = useState('');
  const [mentorsError, setMentorsError] = useState('');
  
  // Action state
  const [actioningId, setActioningId] = useState(null);

  const fetchPendingCourses = async () => {
    try {
      setLoadingCourses(true);
      const response = await api.get('/api/courses/');
      // Filter for unapproved courses
      const unapproved = response.data.filter(c => !c.is_approved);
      setPendingCourses(unapproved);
      setCoursesError('');
    } catch (err) {
      console.error(err);
      setCoursesError('Failed to fetch pending courses.');
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchPendingMentors = async () => {
    try {
      setLoadingMentors(true);
      // Fetch users with MENTOR role that are not approved
      const response = await api.get('/api/auth/profiles/?role=MENTOR&is_approved=false');
      setPendingMentors(response.data);
      setMentorsError('');
    } catch (err) {
      console.error(err);
      setMentorsError('Failed to fetch pending mentors.');
    } finally {
      setLoadingMentors(false);
    }
  };

  useEffect(() => {
    fetchPendingCourses();
    fetchPendingMentors();
  }, []);

  // Course Actions
  const handleApproveCourse = async (courseId) => {
    setActioningId(courseId);
    try {
      await api.post(`/api/courses/${courseId}/approve/`);
      setPendingCourses(prev => prev.filter(c => c.id !== courseId));
    } catch (err) {
      console.error(err);
      alert('Failed to approve course.');
    } finally {
      setActioningId(null);
    }
  };

  const handleRejectCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to reject this course?')) return;
    setActioningId(courseId);
    try {
      await api.post(`/api/courses/${courseId}/reject/`);
      setPendingCourses(prev => prev.filter(c => c.id !== courseId));
    } catch (err) {
      console.error(err);
      alert('Failed to reject course.');
    } finally {
      setActioningId(null);
    }
  };

  // Mentor Actions
  const handleApproveMentor = async (userId) => {
    setActioningId(userId);
    try {
      await api.post(`/api/auth/profiles/${userId}/approve/`);
      setPendingMentors(prev => prev.filter(m => m.id !== userId));
    } catch (err) {
      console.error(err);
      alert('Failed to approve mentor.');
    } finally {
      setActioningId(null);
    }
  };

  const handleRejectMentor = async (userId) => {
    if (!window.confirm('Reject this mentor profile application?')) return;
    setActioningId(userId);
    try {
      await api.post(`/api/auth/profiles/${userId}/reject/`);
      setPendingMentors(prev => prev.filter(m => m.id !== userId));
    } catch (err) {
      console.error(err);
      alert('Failed to reject mentor.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="admin-panel-page">
      <header className="admin-header">
        <div>
          <Link to="/dashboard" className="back-link">
            <ArrowLeftIcon /> Back to Dashboard
          </Link>
          <h1 className="admin-title">Admin Moderation Portal</h1>
          <p className="admin-subtitle">Review course curriculum submissions and mentor credentials.</p>
        </div>
      </header>

      {/* Quick Statistics Row */}
      <section className="admin-stats-summary">
        <div className="stat-summary-card">
          <span className="stat-number purple">{pendingCourses.length}</span>
          <span className="stat-lbl">Courses Awaiting Review</span>
        </div>
        <div className="stat-summary-card">
          <span className="stat-number blue">{pendingMentors.length}</span>
          <span className="stat-lbl">Mentor Registrations Pending</span>
        </div>
      </section>

      {/* Tab Switcher */}
      <div className="admin-tab-row">
        <button
          className={`admin-tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          Course Moderation Queue ({pendingCourses.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'mentors' ? 'active' : ''}`}
          onClick={() => setActiveTab('mentors')}
        >
          Mentor Approvals Queue ({pendingMentors.length})
        </button>
      </div>

      {/* Content Area */}
      <main className="admin-content-area">
        {activeTab === 'courses' ? (
          <section className="moderation-queue-section">
            {coursesError && <div className="alert alert-error">{coursesError}</div>}
            
            {loadingCourses ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading course queue...</p>
              </div>
            ) : pendingCourses.length === 0 ? (
              <div className="admin-empty-state">
                <span className="icon">🛡️</span>
                <h3>Course moderation queue is clear</h3>
                <p>All submitted course curriculum updates are reviewed.</p>
              </div>
            ) : (
              <div className="moderation-items-list">
                {pendingCourses.map(course => (
                  <article key={course.id} className="moderation-card">
                    <div className="moderation-card-body">
                      <div className="card-top-info">
                        <span className={`level-tag-inline ${course.level.toLowerCase()}`}>{course.level}</span>
                        <span className="meta-info">Language: {course.language}</span>
                        <span className="meta-info">Duration: {course.duration_hours}h</span>
                      </div>
                      <h3 className="item-title">{course.title}</h3>
                      <p className="item-mentor">Submitted by: <strong>{course.mentor?.username}</strong> ({course.mentor?.email})</p>
                      <p className="item-desc">{course.description}</p>
                    </div>

                    <div className="moderation-actions">
                      <button
                        className="btn btn-primary btn-sm btn-approve"
                        onClick={() => handleApproveCourse(course.id)}
                        disabled={actioningId !== null}
                      >
                        <CheckIcon /> Approve & Make Live
                      </button>
                      <button
                        className="btn btn-secondary btn-sm btn-reject"
                        onClick={() => handleRejectCourse(course.id)}
                        disabled={actioningId !== null}
                      >
                        <XIcon /> Reject Draft
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="moderation-queue-section">
            {mentorsError && <div className="alert alert-error">{mentorsError}</div>}

            {loadingMentors ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading mentor queue...</p>
              </div>
            ) : pendingMentors.length === 0 ? (
              <div className="admin-empty-state">
                <span className="icon">🤝</span>
                <h3>Mentor registrations queue is clear</h3>
                <p>All registered mentors are moderated.</p>
              </div>
            ) : (
              <div className="moderation-items-list">
                {pendingMentors.map(mentor => (
                  <article key={mentor.id} className="moderation-card">
                    <div className="moderation-card-body">
                      <div className="card-top-info">
                        <span className="level-tag-inline mentor-role-tag">MENTOR</span>
                        <span className="meta-info">Email: {mentor.email}</span>
                      </div>
                      <h3 className="item-title">@{mentor.username}</h3>
                      
                      {mentor.profile && (
                        <div className="mentor-profile-review">
                          <p className="mentor-prof-title"><strong>Title:</strong> {mentor.profile.title || 'N/A'}</p>
                          <p className="mentor-prof-skills"><strong>Skills:</strong> {mentor.profile.skills || 'N/A'}</p>
                          <p className="mentor-prof-bio"><strong>Bio:</strong> {mentor.profile.bio || 'No bio provided.'}</p>
                        </div>
                      )}
                    </div>

                    <div className="moderation-actions">
                      <button
                        className="btn btn-primary btn-sm btn-approve"
                        onClick={() => handleApproveMentor(mentor.id)}
                        disabled={actioningId !== null}
                      >
                        <CheckIcon /> Approve Mentor
                      </button>
                      <button
                        className="btn btn-secondary btn-sm btn-reject"
                        onClick={() => handleRejectMentor(mentor.id)}
                        disabled={actioningId !== null}
                      >
                        <XIcon /> Reject Application
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
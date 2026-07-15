import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import { QAPanel } from './LearningPlayer.jsx';
import Sidebar from '../components/Sidebar.jsx';
import './MentorDashboard.css';

export default function QAPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedQACourse, setSelectedQACourse] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const r = await api.get('/api/courses/?created_by_me=true');
        if (active) {
          const results = r.data.results || r.data;
          setCourses(results);
          setError('');
          if (results.length > 0) {
            setSelectedQACourse(results[0].id);
          }
        }
      } catch {
        if (active) setError('Failed to load courses.');
      } finally {
        if (active) setLoading(false);
      }
    };
    if (user) {
      fetchCourses();
    }
    return () => { active = false; };
  }, [user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} active="mentor-qa" />
      <div className="inner-page">

        <div className="mentor-page-wrap">
          <div className="qa-moderation-panel animate-fadeIn">
            <div className="qa-course-picker-header">
              <div>
                <h3 style={{ fontFamily: 'Fraunces,serif', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Select Course for Chat</h3>
                <p style={{ fontSize: 13, color: 'var(--txt-3)', marginTop: 4 }}>Pick a course below to open its live Q&A moderation window.</p>
              </div>
              <div className="qa-course-picker-wrap">
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-3)' }}>Course</label>
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

            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner" />
                <p>Loading your courses...</p>
              </div>
            ) : error ? (
              <div className="alert alert-error">{error}</div>
            ) : selectedQACourse ? (
              <div className="qa-embed-container">
                <QAPanel courseId={selectedQACourse} user={user} />
              </div>
            ) : (
              <div className="qa-pick-prompt">
                <span>💬</span>
                <p>Select one of your courses above to open its live Q&A chat.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

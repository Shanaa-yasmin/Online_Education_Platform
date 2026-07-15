import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import CourseAnalytics from '../components/CourseAnalytics.jsx';
import Sidebar from '../components/Sidebar.jsx';
import './MentorDashboard.css';

export default function AnalyticsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const r = await api.get('/api/courses/?created_by_me=true');
        if (active) {
          setCourses(r.data.results || r.data);
          setError('');
        }
      } catch {
        if (active) setError('Failed to load course data for analytics.');
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
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} active="mentor-analytics" />
      <div className="inner-page">

        <div className="mentor-page-wrap">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p>Loading analytics data...</p>
            </div>
          ) : error ? (
            <div className="alert alert-error">{error}</div>
          ) : (
            <div className="animate-fadeIn">
              <CourseAnalytics courses={courses} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

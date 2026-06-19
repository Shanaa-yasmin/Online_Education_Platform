import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import './CoursesPage.css';

// SVG Icons
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
  </svg>
);
const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('ALL');

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/courses/');
      // For students, API already returns only approved + published courses.
      // But we can filter here as a safety measure.
      const isStudent = !user || user.role === 'STUDENT';
      const visibleCourses = isStudent
        ? response.data.filter(c => c.is_approved && c.is_published)
        : response.data;
      setCourses(visibleCourses);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to fetch the course list. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);



  // Memoized client-side search and level filtering
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const matchesSearch = 
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLevel = selectedLevel === 'ALL' || course.level === selectedLevel;

      return matchesSearch && matchesLevel;
    });
  }, [courses, searchTerm, selectedLevel]);

  return (
    <div className="courses-catalog-page">
      <header className="catalog-header">
        <div className="header-left-nav">
          <Link to="/dashboard" className="back-link">
            <ArrowLeftIcon /> Back to Dashboard
          </Link>
          <h1 className="catalog-title">Explore Courses</h1>
          <p className="catalog-subtitle">Acquire new skills from expert-led courses designed for your career progression.</p>
        </div>
      </header>

      {/* Search & Filter Controls */}
      <section className="catalog-controls">
        <div className="search-input-wrapper">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search courses by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-select-wrapper">
          <label htmlFor="level-filter">Level:</label>
          <select
            id="level-filter"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
          >
            <option value="ALL">All Levels</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>
      </section>

      {error && (
        <div className="alert alert-error max-w-1200">
          {error}
          <button className="btn btn-secondary btn-sm" onClick={fetchCourses}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading course catalog...</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="catalog-empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No courses found</h3>
          <p>Try adjusting your search criteria or selecting a different level filter.</p>
        </div>
      ) : (
        <section className="courses-grid animate-fadeIn">
          {filteredCourses.map((course) => (
            <article key={course.id} className="catalog-course-card">
              <div className="card-header-row">
                <span className={`level-tag ${course.level.toLowerCase()}`}>{course.level}</span>
                {user?.role === 'MENTOR' && (
                  <span className={`status-badge ${course.is_published ? 'live' : 'draft'}`}>
                    {course.is_published ? 'Live' : 'Draft'}
                  </span>
                )}
              </div>
              
              <Link to={`/courses/${course.id}`} className="card-top-content card-top-link">
                <h3 className="course-card-title">{course.title}</h3>
                <p className="course-card-desc">{course.description}</p>
              </Link>

              <div className="card-footer-info">
                <div className="meta-row">
                  <span className="meta-item"><UserIcon /> By {course.mentor?.username || 'Expert'}</span>
                  <span className="meta-item"><ClockIcon /> {course.duration_hours}h estimated</span>
                </div>
                <div className="enroll-action-row">
                  <span className="price-tag">
                    {course.price > 0 ? `$${course.price}` : 'Free'}
                  </span>
                  <Link
                    to={`/courses/${course.id}`}
                    className="btn btn-primary btn-sm"
                  >
                    {course.price > 0 ? 'View & Enroll' : 'Enroll Free'}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

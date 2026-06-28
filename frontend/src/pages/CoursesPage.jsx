import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import SearchAutocomplete from '../components/SearchAutocomplete.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import './CoursesPage.css';

// SVG Icons
const StarIcon = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#F59E0B' : 'none'} stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

function Sidebar({ user, onLogout, loggingOut }) {
  const isMentor = user?.role === 'MENTOR';
  const isAdmin  = user?.role === 'ADMIN';
  return (
    <aside className="sidebar">
      <div className="sidebar-logo-area">
        <Link to="/" className="nav-logo" style={{textDecoration:'none'}}>
          <div className="nav-logo-mark"><i className="ti ti-trending-up" /></div>
          <span className="nav-logo-text">Edu<span>Path</span></span>
        </Link>
      </div>
      <nav className="sidebar-nav">
        <Link to="/dashboard" className="sidebar-nav-item"><i className="ti ti-layout-dashboard" /> Dashboard</Link>
        {(isMentor||isAdmin) && <Link to="/mentor/dashboard" className="sidebar-nav-item"><i className="ti ti-award" /> Mentor Portal</Link>}
        {isAdmin && <Link to="/admin/portal" className="sidebar-nav-item"><i className="ti ti-settings" /> Admin Portal</Link>}
        <Link to="/courses" className="sidebar-nav-item active"><i className="ti ti-book" /> Courses</Link>
        <Link to="/profile" className="sidebar-nav-item"><i className="ti ti-user" /> Profile</Link>
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? <><span className="loading-spinner loading-spinner-sm"/>Signing out…</> : <><i className="ti ti-logout"/>Sign out</>}
        </button>
      </div>
    </aside>
  );
}

const THUMB = { BEGINNER:'cc-thumb-beg', INTERMEDIATE:'cc-thumb-int', ADVANCED:'cc-thumb-adv' };
const ICON  = { BEGINNER:'ti-leaf', INTERMEDIATE:'ti-flame', ADVANCED:'ti-bolt' };

export default function CoursesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  // URL search params
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const level = searchParams.get('level') || 'ALL';
  const language = searchParams.get('language') || 'ALL';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const isFree = searchParams.get('is_free') || 'ALL';
  const minRating = searchParams.get('min_rating') || 'ALL';
  const ordering = searchParams.get('ordering') || '-created_at';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Debounced input state
  const [searchInput, setSearchInput] = useState(query);

  // Data states
  const [courses, setCourses] = useState([]);
  const [facets, setFacets] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Debounce search query parameter
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        if (searchInput.trim()) {
          newParams.set('q', searchInput.trim());
        } else {
          newParams.delete('q');
        }
        newParams.set('page', '1');
        return newParams;
      });
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput, setSearchParams]);

  // Sync search input if query param changes directly (e.g. navigation link)
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  // Fetch search results
  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (query) params.set('search', query);
      if (level !== 'ALL') params.set('level', level);
      if (language !== 'ALL') params.set('language', language);
      if (minPrice) params.set('min_price', minPrice);
      if (maxPrice) params.set('max_price', maxPrice);
      if (ordering) params.set('ordering', ordering);
      if (page > 1) params.set('page', page);

      if (isFree === 'true') params.set('is_free', 'true');
      else if (isFree === 'false') params.set('is_free', 'false');

      if (minRating !== 'ALL') params.set('min_rating', minRating);

      const res = await api.get(`/api/courses/search/?${params.toString()}`);
      if (res.data.results) {
        setCourses(res.data.results);
        setTotalCount(res.data.count || 0);
      } else {
        setCourses(res.data || []);
        setTotalCount(res.data.length || 0);
      }

      if (res.data.facets) {
        setFacets(res.data.facets);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load courses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [query, level, language, minPrice, maxPrice, isFree, minRating, ordering, page]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  const updateFilter = (key, value) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (value === 'ALL' || value === '' || value === null || value === undefined) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
      newParams.set('page', '1');
      return newParams;
    });
  };

  const handleClearAll = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  // Pagination helpers
  const totalPages = Math.ceil(totalCount / 12);
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('page', newPage.toString());
      return newParams;
    });
  };

  // Build active chips
  const activeChips = useMemo(() => {
    const chips = [];
    if (query) chips.push({ label: `"${query}"`, key: 'q', clear: () => setSearchInput('') });
    if (level !== 'ALL') chips.push({ label: `Level: ${level}`, key: 'level', clear: () => updateFilter('level', 'ALL') });
    if (language !== 'ALL') chips.push({ label: `Lang: ${language}`, key: 'language', clear: () => updateFilter('language', 'ALL') });
    if (isFree === 'true') chips.push({ label: 'Free only', key: 'is_free', clear: () => updateFilter('is_free', 'ALL') });
    if (isFree === 'false') chips.push({ label: 'Paid only', key: 'is_free', clear: () => updateFilter('is_free', 'ALL') });
    if (minRating !== 'ALL') chips.push({ label: `${minRating}★ or above`, key: 'min_rating', clear: () => updateFilter('min_rating', 'ALL') });
    if (minPrice) chips.push({ label: `Min: $${minPrice}`, key: 'min_price', clear: () => updateFilter('min_price', '') });
    if (maxPrice) chips.push({ label: `Max: $${maxPrice}`, key: 'max_price', clear: () => updateFilter('max_price', '') });
    return chips;
  }, [query, level, language, isFree, minRating, minPrice, maxPrice]);

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} />

      <div className="inner-page">
        <header className="topbar">
          <div className="topbar-left">
            <h1>Course Catalog</h1>
            <p>Discover expert-led courses for your career</p>
          </div>
          <div className="topbar-right">
            <NotificationBell user={user} />
            <Link to="/profile" className="topbar-user">
              <div className="avatar-initials" style={{ width: 30, height: 30, fontSize: 12 }}>
                {(user?.username || 'U').slice(0, 2).toUpperCase()}
              </div>
              <span className="topbar-user-name">{user?.username}</span>
            </Link>
          </div>
        </header>

        <div className="courses-page-wrap">
          <div className="page-header">
            <Link to="/dashboard" className="back-link"><i className="ti ti-arrow-left" /> Back to Dashboard</Link>
            <h1>Explore Courses</h1>
            <p>Acquire new skills from expert-led courses designed for your career progression.</p>
          </div>

          {/* Main Rich Filtering System */}
          <div className="rich-catalog-controls">
            <div className="controls-row-top">
              <SearchAutocomplete
                value={searchInput}
                onChange={setSearchInput}
                onSelect={(suggestion) => {
                  // Fill input with the selected title — the debounce effect
                  // will push it to the URL param automatically
                  setSearchInput(suggestion.title);
                }}
                onSubmit={() => { /* search fires via debounce effect */ }}
                placeholder="Search title, description, or mentor..."
                className="courses-sac"
              />

              <div className="filter-select-wrap">
                <label>Sort by:</label>
                <select
                  value={ordering}
                  onChange={e => {
                    setSearchParams(prev => {
                      const newParams = new URLSearchParams(prev);
                      newParams.set('ordering', e.target.value);
                      return newParams;
                    });
                  }}
                >
                  <option value="-created_at">Newest</option>
                  <option value="created_at">Oldest</option>
                  <option value="price">Price: Low-High</option>
                  <option value="-price">Price: High-Low</option>
                  <option value="-avg_rating">Highest Rated</option>
                </select>
              </div>
            </div>

            <div className="controls-row-filters">
              <div className="filter-select-wrap">
                <label>Difficulty:</label>
                <select value={level} onChange={e => updateFilter('level', e.target.value)}>
                  <option value="ALL">All Levels</option>
                  {(facets?.levels || ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).map(lvl => (
                    <option key={lvl} value={lvl}>{lvl.charAt(0) + lvl.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>

              <div className="filter-select-wrap">
                <label>Price Tier:</label>
                <select value={isFree} onChange={e => updateFilter('is_free', e.target.value)}>
                  <option value="ALL">All Prices</option>
                  <option value="true">Free Only</option>
                  <option value="false">Paid Only</option>
                </select>
              </div>

              <div className="filter-select-wrap">
                <label>Language:</label>
                <select value={language} onChange={e => updateFilter('language', e.target.value)}>
                  <option value="ALL">All Languages</option>
                  {(facets?.languages || ['English', 'Spanish']).map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              <div className="filter-select-wrap">
                <label>Rating:</label>
                <select value={minRating} onChange={e => updateFilter('min_rating', e.target.value)}>
                  <option value="ALL">Any Rating</option>
                  <option value="4.5">4.5 ★ & above</option>
                  <option value="4.0">4.0 ★ & above</option>
                  <option value="3.5">3.5 ★ & above</option>
                  <option value="3.0">3.0 ★ & above</option>
                </select>
              </div>

              <button
                className={`advanced-toggle-btn ${showAdvanced ? 'active' : ''}`}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <i className="ti ti-adjustments" /> Range
              </button>
            </div>

            {/* Price range sliders */}
            {showAdvanced && isFree !== 'true' && (
              <div className="advanced-filters-panel animate-slideDown">
                <div className="price-range-inputs">
                  <span className="panel-label">Custom Price Range:</span>
                  <div className="price-input-box">
                    <span>$</span>
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={e => updateFilter('min_price', e.target.value)}
                    />
                  </div>
                  <span className="dash">—</span>
                  <div className="price-input-box">
                    <span>$</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={e => updateFilter('max_price', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active chips row */}
          {activeChips.length > 0 && (
            <div className="active-chips-row">
              {activeChips.map(chip => (
                <div key={chip.label} className="filter-chip">
                  <span>{chip.label}</span>
                  <button className="chip-remove-btn" onClick={chip.clear}>✕</button>
                </div>
              ))}
              <button className="clear-text-btn" onClick={handleClearAll}>Clear All</button>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              {error} <button className="btn btn-sm btn-secondary" onClick={fetchCourses}>Retry</button>
            </div>
          )}

          {/* Grid View */}
          {loading ? (
            <div className="skeletons-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-thumb pulse" />
                  <div className="skeleton-body">
                    <div className="skeleton-line w40 pulse" />
                    <div className="skeleton-line w90 pulse" style={{ height: 18 }} />
                    <div className="skeleton-line w70 pulse" />
                    <div className="skeleton-line-footer">
                      <div className="skeleton-line w30 pulse" />
                      <div className="skeleton-line w30 pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="catalog-empty">
              <i className="ti ti-search-off" />
              <h3>No courses found</h3>
              <p>Try matching other filters or clearing the active search keyword.</p>
              <button className="btn btn-secondary btn-sm" onClick={handleClearAll}>Reset Filters</button>
            </div>
          ) : (
            <>
              <div className="courses-grid animate-fadeIn">
                {courses.map(course => (
                  <article key={course.id} className="course-card-catalog">
                    <div className={`cc-thumb ${THUMB[course.level] || 'cc-thumb-beg'}`}>
                      <i className={`ti ${ICON[course.level]||'ti-book'}`} style={{fontSize:44,opacity:0.5}} />
                      <span className={`badge badge-${course.level.toLowerCase()} cc-level-pill`} style={{position:'absolute',top:10,left:10}}>
                        {course.level}
                      </span>
                    </div>
                    <div className="cc-body">
                      <div className="cc-rating-row">
                        <span className="cc-stars">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <StarIcon key={i} filled={i < Math.round(course.avg_rating || 0)} />
                          ))}
                        </span>
                        <span className="cc-rating-num">
                          {course.avg_rating > 0 ? course.avg_rating.toFixed(1) : 'No reviews'}
                        </span>
                      </div>
                      <p className="cc-cat">{course.language}</p>
                      <h3 className="cc-title">{course.title}</h3>
                      <div className="cc-meta">
                        <span><i className="ti ti-clock" /> {course.duration_hours}h</span>
                        <span><i className="ti ti-user" /> {course.mentor?.username || 'Expert'}</span>
                        <span><i className="ti ti-users" /> {course.enrollment_count || 0} enrolled</span>
                      </div>
                    </div>
                    <div className="cc-footer">
                      <span className={`cc-price${parseFloat(course.price) <= 0 ? ' free' : ''}`}>
                        {parseFloat(course.price) > 0 ? `$${course.price}` : 'Free'}
                      </span>
                      <Link to={`/courses/${course.id}`} className="btn btn-primary btn-sm" style={{borderRadius:7}}>
                        {parseFloat(course.price) > 0 ? 'View & Enroll' : 'Enroll Free'}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              {/* Pagination bar */}
              {totalPages > 1 && (
                <div className="pagination-bar">
                  <button
                    className="pagination-btn arrow"
                    disabled={page === 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    ◀ Prev
                  </button>
                  
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    return (
                      <button
                        key={pageNum}
                        className={`pagination-btn number ${page === pageNum ? 'active' : ''}`}
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    className="pagination-btn arrow"
                    disabled={page === totalPages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Next ▶
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import Sidebar from '../components/Sidebar.jsx';
import './AdminPanel.css';

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setTabState] = useState(searchParams.get('tab') || 'courses');
  const [pendingCourses, setPendingCourses] = useState([]);
  const [pendingMentors, setPendingMentors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingCourses, setLC] = useState(true);
  const [loadingMentors, setLM] = useState(true);
  const [loadingUsers, setLU] = useState(true);
  const [coursesError, setCE] = useState('');
  const [mentorsError, setME] = useState('');
  const [usersError, setUE] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLS] = useState(true);

  // User Management Filters & Details state
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [loadingUserDetail, setLUD] = useState(false);

  const setTab = (tab) => {
    setTabState(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['courses', 'mentors', 'users'].includes(tabParam) && tabParam !== activeTab) {
      setTabState(tabParam);
    }
  }, [searchParams]);

  const fetchCourses = async (active) => { try { setLC(true); const r = await api.get('/api/courses/'); if (active.current) { setPendingCourses((r.data.results || r.data).filter(c => !c.is_approved)); setCE(''); } } catch { if (active.current) setCE('Failed to fetch pending courses.'); } finally { if (active.current) setLC(false); } };
  const fetchMentors = async (active) => { try { setLM(true); const r = await api.get('/api/auth/profiles/?role=MENTOR&is_approved=false'); if (active.current) { setPendingMentors(r.data.results || r.data); setME(''); } } catch { if (active.current) setME('Failed to fetch pending mentors.'); } finally { if (active.current) setLM(false); } };
  const fetchStats = async (active) => {
    try {
      setLS(true);
      const r = await api.get('/api/payments/dashboard-stats/');
      if (active.current) {
        setStats(r.data.stats);
      }
    } catch {
      console.error('Failed to fetch admin stats.');
    } finally {
      if (active.current) setLS(false);
    }
  };

  useEffect(() => {
    const active = { current: true };
    fetchCourses(active);
    fetchMentors(active);
    fetchStats(active);
    return () => { active.current = false; };
  }, []);

  const fetchUsers = async (active = { current: true }) => {
    try {
      setLU(true);
      let url = '/api/auth/admin/users/';
      const params = [];
      if (userSearch) params.push(`search=${encodeURIComponent(userSearch)}`);
      if (userRoleFilter) params.push(`role=${userRoleFilter}`);
      if (userStatusFilter === 'active') params.push('is_active=true');
      if (userStatusFilter === 'inactive') params.push('is_active=false');
      if (userStatusFilter === 'suspended') params.push('is_suspended=true');
      if (params.length > 0) {
        url += '?' + params.join('&');
      }
      const r = await api.get(url);
      if (active.current) { setUsers(r.data.results || r.data); setUE(''); }
    } catch {
      if (active.current) setUE('Failed to fetch users list.');
    } finally {
      if (active.current) setLU(false);
    }
  };

  useEffect(() => {
    const active = { current: true };
    fetchCourses(active);
    fetchMentors(active);
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    const active = { current: true };
    if (activeTab === 'users') {
      fetchUsers(active);
    }
    return () => { active.current = false; };
  }, [activeTab, userRoleFilter, userStatusFilter]);

  const actCourse = async (id, action) => {
    setActioningId(id);
    try { await api.post(`/api/courses/${id}/${action}/`); setPendingCourses(p => p.filter(c => c.id !== id)); }
    catch { alert(`Failed to ${action} course.`); }
    finally { setActioningId(null); }
  };
  const actMentor = async (id, action) => {
    if (action === 'reject' && !window.confirm('Reject this mentor?')) return;
    setActioningId(id);
    try { await api.post(`/api/auth/profiles/${id}/${action}/`); setPendingMentors(p => p.filter(m => m.id !== id)); }
    catch { alert(`Failed to ${action} mentor.`); }
    finally { setActioningId(null); }
  };


  const viewUserDetails = async (id) => {
    try {
      setLUD(true);
      setSelectedUser(null);
      const r = await api.get(`/api/auth/admin/users/${id}/`);
      setSelectedUser(r.data);
    } catch {
      alert('Failed to fetch user details.');
    } finally {
      setLUD(false);
    }
  };



  const toggleUserSuspension = async (id, isSuspended) => {
    const act = isSuspended ? 'reactivate' : 'suspend';
    if (user.id === id && act === 'suspend') {
      alert("You cannot suspend your own account.");
      return;
    }
    setActioningId(id);
    try {
      const r = await api.post(`/api/auth/admin/users/${id}/${act}/`);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_suspended: r.data.is_suspended } : u));
      if (selectedUser && selectedUser.id === id) {
        setSelectedUser(prev => ({ ...prev, is_suspended: r.data.is_suspended }));
      }
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to ${act} user.`);
    } finally {
      setActioningId(null);
    }
  };

  const deleteUserAccount = async (id, username) => {
    if (user.id === id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!window.confirm(`Are you absolutely sure you want to permanently delete user @${username}? This action is irreversible and will delete all their data.`)) {
      return;
    }
    setActioningId(id);
    try {
      await api.delete(`/api/auth/admin/users/${id}/`);
      setUsers(prev => prev.filter(u => u.id !== id));
      if (selectedUser && selectedUser.id === id) {
        setSelectedUser(null);
      }
      alert(`User @${username} deleted successfully.`);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete user.");
    } finally {
      setActioningId(null);
    }
  };


  const handleLogout = async () => { setLoggingOut(true); await logout(); navigate('/login'); };

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} active="admin-portal" />
      <div className="inner-page">

        <div className="admin-page-wrap">
          <div>
            <Link to="/dashboard" className="back-link"><i className="ti ti-arrow-left" /> Back to Dashboard</Link>
            <h1 style={{ fontFamily: 'Fraunces,serif', fontSize: 'clamp(1.4rem,2.5vw,1.9rem)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--txt-1)' }}>Admin Moderation Portal</h1>
            <p style={{ fontSize: 13.5, color: 'var(--txt-3)', marginTop: 3 }}>Review course submissions and mentor credentials.</p>
          </div>

          {/* Stats */}
          <div className="admin-stats animate-fadeIn">
            {loadingStats
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="stat-card stat-card-skeleton" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="skeleton-block skeleton-icon" style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-block skeleton-num" style={{ width: '45%', height: 20, marginBottom: 6 }} />
                      <div className="skeleton-block skeleton-lbl" style={{ width: '80%', height: 12 }} />
                    </div>
                  </div>
                ))
              : [
                  { label: 'Total Courses', value: stats?.total_courses ?? 0, icon: 'ti-book', color: 'var(--brand)', bg: 'var(--brand-light)' },
                  { label: 'Published Courses', value: stats?.published_count ?? 0, icon: 'ti-circle-check', color: 'var(--success)', bg: 'var(--success-bg)' },
                  { label: 'Courses Awaiting Review', value: stats?.pending_courses ?? pendingCourses.length, icon: 'ti-alert-circle', color: 'var(--warning)', bg: 'var(--warning-bg)' },
                  { label: 'Total Students', value: stats?.total_students ?? 0, icon: 'ti-users', color: 'var(--info)', bg: 'var(--info-bg)' },
                  { label: 'Total Mentors', value: stats?.total_mentors ?? 0, icon: 'ti-award', color: 'var(--success)', bg: 'var(--success-bg)' },
                  { label: 'Total Revenue', value: stats?.revenue !== undefined ? `$${stats.revenue.toFixed(2)}` : '—', icon: 'ti-wallet', color: '#16a34a', bg: '#dcfce7' },
                  { label: 'Total Enrollments', value: stats?.total_enrollments ?? 0, icon: 'ti-clipboard-list', color: 'var(--info)', bg: 'var(--info-bg)' },
                  { label: 'Total Reviews', value: stats?.total_reviews ?? 0, icon: 'ti-star', color: 'var(--warning)', bg: 'var(--warning-bg)' },
                ].map(s => (
                  <div key={s.label} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="stat-card-icon" style={{ background: s.bg, color: s.color, width: 44, height: 44, borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`ti ${s.icon}`} style={{ fontSize: 22 }} />
                    </div>
                    <div>
                      <div className="stat-card-num" style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
                      <div className="stat-card-lbl" style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 3 }}>{s.label}</div>
                    </div>
                  </div>
                ))}
          </div>

          {/* Tabs */}
          <div className="tab-row">
            <button className={`tab-btn${activeTab === 'courses' ? ' active' : ''}`} onClick={() => setTab('courses')}>
              Course Queue ({pendingCourses.length})
            </button>
            <button className={`tab-btn${activeTab === 'mentors' ? ' active' : ''}`} onClick={() => setTab('mentors')}>
              Mentor Queue ({pendingMentors.length})
            </button>
            <button className={`tab-btn${activeTab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>
              User Management
            </button>
          </div>

          {activeTab === 'courses' && (
            <div>
              {coursesError && <div className="alert alert-error">{coursesError}</div>}
              {loadingCourses ? <div className="loading-container"><div className="loading-spinner" /><p>Loading…</p></div>
                : pendingCourses.length === 0 ? (
                  <div className="admin-empty"><i className="ti ti-shield-check" /><h3>Queue is clear</h3><p>All submitted courses are reviewed.</p></div>
                ) : (
                  <div className="mod-list">
                    {pendingCourses.map(course => (
                      <article key={course.id} className="mod-card">
                        <div className="mod-card-body">
                          <div className="mod-card-tags">
                            <span className={`badge badge-${course.level.toLowerCase()}`}>{course.level}</span>
                            <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>{course.language} · {course.duration_hours}h</span>
                          </div>
                          <h3 className="mod-card-title">{course.title}</h3>
                          <p className="mod-card-sub">By <strong>{course.mentor?.username}</strong> ({course.mentor?.email})</p>
                          <p className="mod-card-desc">{course.description}</p>
                        </div>
                        <div className="mod-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => actCourse(course.id, 'approve')} disabled={actioningId !== null}><i className="ti ti-check" />Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => actCourse(course.id, 'reject')} disabled={actioningId !== null}><i className="ti ti-x" />Reject</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
            </div>
          )}

          {activeTab === 'mentors' && (
            <div>
              {mentorsError && <div className="alert alert-error">{mentorsError}</div>}
              {loadingMentors ? <div className="loading-container"><div className="loading-spinner" /><p>Loading…</p></div>
                : pendingMentors.length === 0 ? (
                  <div className="admin-empty"><i className="ti ti-users" /><h3>Queue is clear</h3><p>All mentor registrations are moderated.</p></div>
                ) : (
                  <div className="mod-list">
                    {pendingMentors.map(mentor => (
                      <article key={mentor.id} className="mod-card">
                        <div className="mod-card-body">
                          <div className="mod-card-tags">
                            <span className="badge badge-mentor">MENTOR</span>
                            <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>{mentor.email}</span>
                          </div>
                          <h3 className="mod-card-title">@{mentor.username}</h3>
                          {mentor.profile && (
                            <div className="mod-mentor-box">
                              <p><strong>Title:</strong> {mentor.profile.title || 'N/A'}</p>
                              <p><strong>Skills:</strong> {mentor.profile.skills || 'N/A'}</p>
                              <p><strong>Bio:</strong> {mentor.profile.bio || 'No bio provided.'}</p>
                            </div>
                          )}
                        </div>
                        <div className="mod-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => actMentor(mentor.id, 'approve')} disabled={actioningId !== null}><i className="ti ti-check" />Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => actMentor(mentor.id, 'reject')} disabled={actioningId !== null}><i className="ti ti-x" />Reject</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
            </div>
          )}



          {activeTab === 'users' && (
            <div className="admin-users-section">
              {/* Filter and Search Bar */}
              <div className="users-filter-bar">
                <div className="search-box-wrap">
                  <i className="ti ti-search search-icon" />
                  <input
                    type="text"
                    placeholder="Search name, email, username..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                    className="users-search-input"
                  />
                  <button onClick={fetchUsers} className="btn btn-primary btn-sm search-btn">
                    Search
                  </button>
                </div>

                <div className="filter-selects">
                  <div className="select-group">
                    <label>Role</label>
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="">All Roles</option>
                      <option value="STUDENT">Student</option>
                      <option value="MENTOR">Mentor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>

                  <div className="select-group">
                    <label>Status</label>
                    <select
                      value={userStatusFilter}
                      onChange={(e) => setUserStatusFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                      <option value="suspended">Suspended Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {usersError && <div className="alert alert-error">{usersError}</div>}

              <div className="users-layout-container">
                {/* Users List Table */}
                <div className="users-table-card">
                  {loadingUsers ? (
                    <div className="loading-container"><div className="loading-spinner" /><p>Loading users list...</p></div>
                  ) : users.length === 0 ? (
                    <div className="admin-empty">
                      <i className="ti ti-users" />
                      <h3>No users found</h3>
                      <p>Try resetting filters or changing search query.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="admin-users-table">
                        <thead>
                          <tr>
                            <th>User info</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th className="text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map(u => (
                            <tr key={u.id} className={selectedUser && selectedUser.id === u.id ? 'active-row' : ''}>
                              <td>
                                <div className="user-profile-cell">
                                  <div className="user-cell-avatar">
                                    {u.avatar ? (
                                      <img src={u.avatar} alt={u.username} />
                                    ) : (
                                      <div className="avatar-placeholder">{u.username.substring(0, 2).toUpperCase()}</div>
                                    )}
                                  </div>
                                  <div className="user-cell-meta">
                                    <span className="username">@{u.username}</span>
                                    <span className="fullname">{u.first_name} {u.last_name}</span>
                                    <span className="email">{u.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`badge badge-role badge-${u.role.toLowerCase()}`}>
                                  {u.role}
                                </span>
                              </td>
                              <td>
                                <div className="status-badges-cell">
                                  {u.is_suspended ? (
                                    <span className="badge badge-suspended">Suspended</span>
                                  ) : u.is_active ? (
                                    <span className="badge badge-active-user">Active</span>
                                  ) : (
                                    <span className="badge badge-inactive-user">Inactive</span>
                                  )}
                                  {u.role === 'MENTOR' && (
                                    u.is_approved ? (
                                      <span className="badge badge-approved-mentor">Approved</span>
                                    ) : (
                                      <span className="badge badge-pending-mentor">Pending</span>
                                    )
                                  )}
                                </div>
                              </td>
                              <td className="date-cell">
                                {new Date(u.date_joined).toLocaleDateString()}
                              </td>
                              <td className="text-right">
                                <div className="user-action-btns">
                                  <button
                                    onClick={() => viewUserDetails(u.id)}
                                    className="btn btn-secondary btn-xs btn-action"
                                    title="View Full Profile Details & Stats"
                                  >
                                    <i className="ti ti-eye" /> Details
                                  </button>

                                  <button
                                    onClick={() => toggleUserSuspension(u.id, u.is_suspended)}
                                    className={`btn btn-xs btn-action ${u.is_suspended ? 'btn-success-outline' : 'btn-warning'}`}
                                    disabled={actioningId !== null}
                                    title={u.is_suspended ? "Lift Suspension" : "Suspend Account"}
                                  >
                                    <i className={u.is_suspended ? "ti ti-player-play" : "ti ti-player-pause"} /> {u.is_suspended ? "Reactivate" : "Suspend"}
                                  </button>
                                  <button
                                    onClick={() => deleteUserAccount(u.id, u.username)}
                                    className="btn btn-danger btn-xs btn-action"
                                    disabled={actioningId !== null}
                                    title="Permanently Delete Account"
                                  >
                                    <i className="ti ti-trash" /> Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Details Side Panel / Details Card */}
                {(selectedUser || loadingUserDetail) && (
                  <div className="user-details-card animate-fade-in">
                    <div className="card-header-with-close">
                      <h3>User Profile Details</h3>
                      <button onClick={() => setSelectedUser(null)} className="close-panel-btn">
                        <i className="ti ti-x" />
                      </button>
                    </div>

                    {loadingUserDetail ? (
                      <div className="loading-container" style={{ margin: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <div className="loading-spinner" />
                        <p style={{ color: 'var(--txt-3)', fontSize: 13.5 }}>Loading user details…</p>
                      </div>
                    ) : (
                      <>
                        <div className="detail-avatar-section">
                          {selectedUser.avatar ? (
                            <img src={selectedUser.avatar} alt={selectedUser.username} className="detail-avatar-img" />
                          ) : (
                            <div className="detail-avatar-placeholder">{selectedUser.username.substring(0, 2).toUpperCase()}</div>
                          )}
                          <h4>{selectedUser.first_name} {selectedUser.last_name}</h4>
                          <p className="detail-sub">@{selectedUser.username} · {selectedUser.email}</p>
                          <span className={`badge badge-${selectedUser.role.toLowerCase()}`}>{selectedUser.role}</span>
                        </div>

                        <div className="detail-info-grid">
                          <div className="info-item">
                            <span className="info-lbl">Location</span>
                            <span className="info-val">{selectedUser.location || 'Not specified'}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-lbl">Website</span>
                            <span className="info-val">
                              {selectedUser.website ? (
                                <a href={selectedUser.website} target="_blank" rel="noopener noreferrer">{selectedUser.website}</a>
                              ) : 'Not specified'}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-lbl">Phone</span>
                            <span className="info-val">{selectedUser.phone_number || 'Not specified'}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-lbl">Title / Headline</span>
                            <span className="info-val">{selectedUser.title || 'Not specified'}</span>
                          </div>

                          {selectedUser.skills && (
                            <div className="info-item full-width">
                              <span className="info-lbl">Skills</span>
                              <span className="info-val">{selectedUser.skills}</span>
                            </div>
                          )}

                          {selectedUser.bio && (
                            <div className="info-item full-width">
                              <span className="info-lbl">Biography</span>
                              <p className="info-val-bio">{selectedUser.bio}</p>
                            </div>
                          )}
                        </div>

                        {selectedUser.extra_stats && Object.keys(selectedUser.extra_stats).length > 0 && (
                          <div className="detail-stats-section">
                            <h5>Activity Summary</h5>
                            <div className="detail-stats-grid">
                              {selectedUser.role === 'STUDENT' && (
                                <>
                                  <div className="sub-stat-card">
                                    <span className="lbl">Enrolled</span>
                                    <span className="val">{selectedUser.extra_stats.courses_enrolled}</span>
                                  </div>
                                  <div className="sub-stat-card">
                                    <span className="lbl">Certificates</span>
                                    <span className="val">{selectedUser.extra_stats.certificates_earned}</span>
                                  </div>
                                </>
                              )}
                              {selectedUser.role === 'MENTOR' && (
                                <>
                                  <div className="sub-stat-card">
                                    <span className="lbl">Courses</span>
                                    <span className="val">{selectedUser.extra_stats.courses_created}</span>
                                  </div>
                                  <div className="sub-stat-card">
                                    <span className="lbl">Students</span>
                                    <span className="val">{selectedUser.extra_stats.students_enrolled}</span>
                                  </div>
                                  <div className="sub-stat-card">
                                    <span className="lbl">Rating</span>
                                    <span className="val">{selectedUser.extra_stats.avg_rating} ★</span>
                                  </div>
                                  <div className="sub-stat-card">
                                    <span className="lbl">Earnings</span>
                                    <span className="val">${selectedUser.extra_stats.total_earnings}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="detail-actions-section">
                          <h5>Quick Status Management</h5>
                          <div className="detail-action-buttons">

                            <button
                              onClick={() => toggleUserSuspension(selectedUser.id, selectedUser.is_suspended)}
                              className={`btn btn-sm ${selectedUser.is_suspended ? 'btn-success-outline' : 'btn-warning'}`}
                            >
                              <i className={selectedUser.is_suspended ? "ti ti-player-play" : "ti ti-player-pause"} /> {selectedUser.is_suspended ? "Lift Suspension" : "Suspend Account"}
                            </button>
                            <button
                              onClick={() => deleteUserAccount(selectedUser.id, selectedUser.username)}
                              className="btn btn-sm btn-danger"
                            >
                              <i className="ti ti-trash" /> Delete Account
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

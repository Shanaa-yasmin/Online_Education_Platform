import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell.jsx';
import api from '../utils/api.js';
import Sidebar from '../components/Sidebar.jsx';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  // ── Tab State ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview'); // overview, settings, security

  // ── Profile Form State ─────────────────────────────────────────────
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    profile: {
      bio: '',
      title: '',
      skills: '',
      phone_number: '',
      website: '',
      location: '',
      avatar: null,
    }
  });

  // ── Password Form State ────────────────────────────────────────────
  const [pwdData, setPwdData] = useState({
    current_password: '',
    new_password: '',
    new_password_confirm: ''
  });

  // ── Stats and Loading States ───────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const { logout } = useAuth();

  // ── Load full profile and stats on mount ────────────────────────────
  const loadProfile = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.get('/api/profile/');
      const data = res.data;

      setFormData({
        username: data.username || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        profile: {
          bio: data.profile?.bio || '',
          title: data.profile?.title || '',
          skills: data.profile?.skills || '',
          phone_number: data.profile?.phone_number || '',
          website: data.profile?.website || '',
          location: data.profile?.location || '',
          avatar: data.profile?.avatar || null,
        }
      });
      setStats(data.stats || {});
      // Sync local user settings
      updateUser(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfileInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        [name]: value
      }
    }));
  };

  const handlePwdChange = (e) => {
    const { name, value } = e.target;
    setPwdData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  // ── Update Profile Action ──────────────────────────────────────────
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await api.put('/api/profile/', formData);
      updateUser(res.data);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error(err);
      const errs = err?.response?.data;
      if (errs) {
        setErrorMsg(Object.entries(errs).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | '));
      } else {
        setErrorMsg('Failed to save profile changes.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Change Password Action ──────────────────────────────────────────
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSavingPwd(true);
    setSuccessMsg('');
    setErrorMsg('');

    if (pwdData.new_password !== pwdData.new_password_confirm) {
      setErrorMsg('New passwords do not match.');
      setSavingPwd(false);
      return;
    }

    try {
      await api.post('/api/profile/change-password/', pwdData);
      setSuccessMsg('Password changed successfully!');
      setPwdData({
        current_password: '',
        new_password: '',
        new_password_confirm: ''
      });
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error(err);
      const errs = err?.response?.data;
      if (errs) {
        setErrorMsg(Object.entries(errs).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | '));
      } else {
        setErrorMsg('Failed to update password.');
      }
    } finally {
      setSavingPwd(false);
    }
  };

  const getInitials = () => {
    const fn = formData.first_name || '';
    const ln = formData.last_name || '';
    if (fn && ln) return (fn[0] + ln[0]).toUpperCase();
    return (formData.username || user?.username || 'U').slice(0, 2).toUpperCase();
  };

  const getFullName = () => {
    const fn = formData.first_name || '';
    const ln = formData.last_name || '';
    if (fn || ln) return `${fn} ${ln}`.trim();
    return formData.username || user?.username || 'User';
  };

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} active="profile" />

      <div className="inner-page">
        <header className="topbar">
          <div className="topbar-left">
            <h1>Account Settings</h1>
            <p>Manage your profile, analytics and security preferences</p>
          </div>
          <div className="topbar-right">
            <NotificationBell user={user} />
            <div className="avatar-initials" style={{ width: 32, height: 32, fontSize: 13 }}>
              {getInitials()}
            </div>
          </div>
        </header>

        <div className="profile-page-wrap">
          <Link to="/dashboard" className="back-link"><i className="ti ti-arrow-left" /> Back to Dashboard</Link>

          {/* Toast Notification for Success/Error */}
          {successMsg && <div className="alert alert-success animate-fadeIn" style={{ marginBottom: 20 }}><i className="ti ti-check" /> {successMsg}</div>}
          {errorMsg && <div className="alert alert-error animate-fadeIn" style={{ marginBottom: 20 }}><i className="ti ti-alert-circle" /> {errorMsg}</div>}

          {loading ? (
            <div className="profile-loading">
              <span className="nb-spinner" />
              <p>Loading account details…</p>
            </div>
          ) : (
            <div className="profile-layout-new">
              {/* ── Left Sticky Panel: User Info & Tabs ─────────────────── */}
              <aside className="profile-aside-left">
                <div className="profile-meta-card">
                  <div className="profile-avatar-wrapper">
                    {formData.profile?.avatar ? (
                      <img src={formData.profile.avatar} alt="Avatar" className="profile-avatar-img" />
                    ) : (
                      <div className="profile-avatar-placeholder">{getInitials()}</div>
                    )}
                  </div>
                  <h2 className="profile-fullname">{getFullName()}</h2>
                  <p className="profile-username">@{formData.username}</p>
                  <span className={`badge badge-${(user?.role || 'student').toLowerCase()}`}>{user?.role}</span>

                  <div className="profile-meta-details">
                    {formData.profile.location && (
                      <div className="profile-meta-item">
                        <i className="ti ti-map-pin" />
                        <span>{formData.profile.location}</span>
                      </div>
                    )}
                    {formData.profile.website && (
                      <div className="profile-meta-item">
                        <i className="ti ti-world" />
                        <a href={formData.profile.website.startsWith('http') ? formData.profile.website : `https://${formData.profile.website}`} target="_blank" rel="noopener noreferrer">
                          {formData.profile.website.replace(/(^\w+:|^)\/\//, '')}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="profile-tabs-nav">
                  <button className={`tab-nav-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                    <i className="ti ti-chart-bar" />
                    <span>Overview & Analytics</span>
                  </button>
                  <button className={`tab-nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                    <i className="ti ti-edit" />
                    <span>Edit Profile Info</span>
                  </button>
                  <button className={`tab-nav-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
                    <i className="ti ti-lock" />
                    <span>Password & Security</span>
                  </button>
                </div>
              </aside>

              {/* ── Right Content Area: Active Tab View ──────────────────── */}
              <main className="profile-content-right">
                {/* ── OVERVIEW TAB ────────────────────────────────────────── */}
                {activeTab === 'overview' && (
                  <div className="tab-pane animate-fadeIn">
                    <h2 className="tab-pane-title">Performance Dashboard</h2>
                    <p className="tab-pane-desc">Calculated insights, performance analytics, and dynamic summaries.</p>

                    {/* Student Dashboard View */}
                    {user?.role === 'STUDENT' && stats && (
                      <div className="stats-dashboard-block">
                        <div className="stats-grid">
                          <div className="stat-card">
                            <span className="stat-card-label">Enrolled Courses</span>
                            <h3 className="stat-card-number">{stats.courses_enrolled}</h3>
                          </div>
                          <div className="stat-card">
                            <span className="stat-card-label">Completed Courses</span>
                            <h3 className="stat-card-number">{stats.courses_completed}</h3>
                          </div>
                          <div className="stat-card">
                            <span className="stat-card-label">Certificates Earned</span>
                            <h3 className="stat-card-number">{stats.certificates_earned}</h3>
                          </div>
                          <div className="stat-card">
                            <span className="stat-card-label">Avg. Progress</span>
                            <h3 className="stat-card-number">{stats.learning_progress}%</h3>
                          </div>
                        </div>

                        <div className="dashboard-section">
                          <h4 className="section-title">Recent Learning Progress</h4>
                          {(!stats.recent_learning || stats.recent_learning.length === 0) ? (
                            <div className="stats-empty-state">
                              <i className="ti ti-book-off" />
                              <p>No active course enrollments yet. Explore courses to begin!</p>
                            </div>
                          ) : (
                            <div className="learning-log-list">
                              {stats.recent_learning.map(log => (
                                <div key={log.id} className="learning-log-item">
                                  {log.thumbnail ? (
                                    <img src={log.thumbnail} alt={log.title} className="log-img" />
                                  ) : (
                                    <div className="log-img-fallback"><i className="ti ti-book" /></div>
                                  )}
                                  <div className="log-info">
                                    <h5>{log.title}</h5>
                                    <p>Mentor: {log.mentor_name} • {log.duration_hours}h • {log.level}</p>
                                    <div className="progress-bar-wrap">
                                      <div className="progress-bar-fill" style={{ width: `${log.progress_percent}%` }} />
                                    </div>
                                  </div>
                                  <div className="log-progress-text">{log.progress_percent}%</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="dashboard-section">
                          <h4 className="section-title">Issued Certificates</h4>
                          {(!stats.certificates || stats.certificates.length === 0) ? (
                            <div className="stats-empty-state">
                              <i className="ti ti-certificate-off" />
                              <p>No certificates earned yet. Complete courses to unlock achievements!</p>
                            </div>
                          ) : (
                            <div className="certificates-grid">
                              {stats.certificates.map(cert => (
                                <div key={cert.id} className="certificate-item-card">
                                  <div className="cert-badge-wrap"><i className="ti ti-award" /></div>
                                  <div className="cert-info">
                                    <h6>{cert.course_title}</h6>
                                    <p>Issued: {cert.issued_at}</p>
                                    <span className="cert-code">ID: {cert.certificate_code}</span>
                                  </div>
                                  {cert.pdf_url && (
                                    <a href={cert.pdf_url} className="btn btn-secondary btn-sm cert-download-btn" target="_blank" rel="noopener noreferrer">
                                      <i className="ti ti-download" /> PDF
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mentor Dashboard View */}
                    {user?.role === 'MENTOR' && stats && (
                      <div className="stats-dashboard-block">
                        <div className="stats-grid">
                          <div className="stat-card">
                            <span className="stat-card-label">Courses Created</span>
                            <h3 className="stat-card-number">{stats.courses_created}</h3>
                          </div>
                          <div className="stat-card">
                            <span className="stat-card-label">Active Students</span>
                            <h3 className="stat-card-number">{stats.students_enrolled}</h3>
                          </div>
                          <div className="stat-card">
                            <span className="stat-card-label">Average Rating</span>
                            <h3 className="stat-card-number">★ {stats.avg_rating}</h3>
                          </div>
                          <div className="stat-card">
                            <span className="stat-card-label">Total Earnings</span>
                            <h3 className="stat-card-number">${stats.total_earnings?.toFixed(2)}</h3>
                          </div>
                        </div>

                        <div className="dashboard-section">
                          <h4 className="section-title">Latest Courses Catalog</h4>
                          {(!stats.latest_courses || stats.latest_courses.length === 0) ? (
                            <div className="stats-empty-state">
                              <i className="ti ti-folder-off" />
                              <p>No courses created yet. Create a course to publish!</p>
                            </div>
                          ) : (
                            <div className="learning-log-list">
                              {stats.latest_courses.map(course => (
                                <div key={course.id} className="learning-log-item">
                                  {course.thumbnail ? (
                                    <img src={course.thumbnail} alt={course.title} className="log-img" />
                                  ) : (
                                    <div className="log-img-fallback"><i className="ti ti-book" /></div>
                                  )}
                                  <div className="log-info">
                                    <h5>{course.title}</h5>
                                    <p>Students: {course.students_count} • Rating: ★ {course.rating_average}</p>
                                  </div>
                                  <div>
                                    <span className={`badge badge-${course.status?.toLowerCase().replace(' ', '-')}`}>{course.status}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="dashboard-section">
                          <h4 className="section-title">Recent Sales Registry</h4>
                          {(!stats.recent_sales || stats.recent_sales.length === 0) ? (
                            <div className="stats-empty-state">
                              <i className="ti ti-receipt-off" />
                              <p>No enrollments processed yet.</p>
                            </div>
                          ) : (
                            <div className="sales-registry-list">
                              <table className="sales-table">
                                <thead>
                                  <tr>
                                    <th>Course</th>
                                    <th>Student</th>
                                    <th>Paid</th>
                                    <th>Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stats.recent_sales.map(sale => (
                                    <tr key={sale.id}>
                                      <td>{sale.course_title}</td>
                                      <td>{sale.student_name}</td>
                                      <td className="sale-amount">${sale.amount?.toFixed(2)}</td>
                                      <td>{sale.created_at}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Admin Dashboard View */}
                    {user?.role === 'ADMIN' && stats && (
                      <div className="stats-dashboard-block">
                        <div className="stats-grid">
                          <div className="stat-card">
                            <span className="stat-card-label">Total Users</span>
                            <h3 className="stat-card-number">{stats.total_users}</h3>
                          </div>
                          <div className="stat-card">
                            <span className="stat-card-label">Pending Mentors</span>
                            <h3 className="stat-card-number">{stats.pending_mentor_requests}</h3>
                          </div>
                          <div className="stat-card">
                            <span className="stat-card-label">Pending Courses</span>
                            <h3 className="stat-card-number">{stats.pending_course_approvals}</h3>
                          </div>
                          <div className="stat-card">
                            <span className="stat-card-label">Reported Abuse</span>
                            <h3 className="stat-card-number">{stats.reported_messages}</h3>
                          </div>
                        </div>

                        <div className="dashboard-section">
                          <h4 className="section-title">Recent System Activities</h4>
                          {(!stats.recent_activities || stats.recent_activities.length === 0) ? (
                            <div className="stats-empty-state">
                              <i className="ti ti-checklist" />
                              <p>No system activity logs found.</p>
                            </div>
                          ) : (
                            <div className="activity-timeline">
                              {stats.recent_activities.map((act, index) => (
                                <div key={index} className="activity-timeline-item">
                                  <div className="timeline-dot" />
                                  <div className="timeline-body">
                                    <span className="timeline-tag">{act.type}</span>
                                    <p className="timeline-msg">{act.message}</p>
                                    <span className="timeline-time">{act.time}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── EDIT SETTINGS TAB ──────────────────────────────────── */}
                {activeTab === 'settings' && (
                  <div className="tab-pane animate-fadeIn">
                    <h2 className="tab-pane-title">Account Preferences</h2>
                    <p className="tab-pane-desc">Update your personal contact details, bio statements, and profile identifiers.</p>

                    <form onSubmit={handleProfileSubmit} className="profile-edit-form">
                      <div className="form-section-header">Core Details</div>
                      <div className="form-grid-row">
                        <div className="form-control-wrap">
                          <label>Username</label>
                          <input type="text" name="username" value={formData.username} onChange={handleInputChange} required />
                        </div>
                        <div className="form-control-wrap">
                          <label>Email Address (Immutable)</label>
                          <input type="email" value={formData.email} disabled className="disabled-input" />
                        </div>
                      </div>

                      <div className="form-grid-row">
                        <div className="form-control-wrap">
                          <label>First Name</label>
                          <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} />
                        </div>
                        <div className="form-control-wrap">
                          <label>Last Name</label>
                          <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} />
                        </div>
                      </div>

                      <div className="form-section-header">Contact & Links</div>
                      <div className="form-grid-row">
                        <div className="form-control-wrap">
                          <label>Phone Number</label>
                          <input type="text" name="phone_number" placeholder="+1234567890" value={formData.profile.phone_number} onChange={handleProfileInputChange} />
                        </div>
                        <div className="form-control-wrap">
                          <label>Personal Website</label>
                          <input type="text" name="website" placeholder="www.myportfolio.com" value={formData.profile.website} onChange={handleProfileInputChange} />
                        </div>
                        <div className="form-control-wrap">
                          <label>Location</label>
                          <input type="text" name="location" placeholder="San Francisco, CA" value={formData.profile.location} onChange={handleProfileInputChange} />
                        </div>
                      </div>

                      {user?.role === 'MENTOR' && (
                        <>
                          <div className="form-section-header">Mentor Professional Details</div>
                          <div className="form-grid-row">
                            <div className="form-control-wrap">
                              <label>Professional Title</label>
                              <input type="text" name="title" placeholder="Senior Educator / Full Stack Specialist" value={formData.profile.title} onChange={handleProfileInputChange} />
                            </div>
                            <div className="form-control-wrap">
                              <label>Core Skills (comma-separated)</label>
                              <input type="text" name="skills" placeholder="React, Node.js, Teaching" value={formData.profile.skills} onChange={handleProfileInputChange} />
                            </div>
                          </div>
                        </>
                      )}

                      <div className="form-control-wrap full-width">
                        <label>Public Biography</label>
                        <textarea rows={5} name="bio" placeholder="Tell the community about your background, career, or target milestones…" value={formData.profile.bio} onChange={handleProfileInputChange} />
                      </div>

                      <button type="submit" className="btn btn-primary btn-save" disabled={saving}>
                        {saving ? <><span className="loading-spinner loading-spinner-sm" /> Saving…</> : 'Save Changes'}
                      </button>
                    </form>
                  </div>
                )}

                {/* ── SECURITY TAB ───────────────────────────────────────── */}
                {activeTab === 'security' && (
                  <div className="tab-pane animate-fadeIn">
                    <h2 className="tab-pane-title">Access Security</h2>
                    <p className="tab-pane-desc">Maintain login safety by updating your password credentials.</p>

                    <form onSubmit={handlePasswordSubmit} className="profile-security-form">
                      <div className="form-control-wrap">
                        <label>Current Password</label>
                        <input type="password" name="current_password" value={pwdData.current_password} onChange={handlePwdChange} required />
                      </div>

                      <div className="form-control-wrap">
                        <label>New Password</label>
                        <input type="password" name="new_password" value={pwdData.new_password} onChange={handlePwdChange} required />
                      </div>

                      <div className="form-control-wrap">
                        <label>Confirm New Password</label>
                        <input type="password" name="new_password_confirm" value={pwdData.new_password_confirm} onChange={handlePwdChange} required />
                      </div>

                      <button type="submit" className="btn btn-primary btn-save" disabled={savingPwd}>
                        {savingPwd ? <><span className="loading-spinner loading-spinner-sm" /> Updating…</> : 'Update Password'}
                      </button>
                    </form>
                  </div>
                )}
              </main>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

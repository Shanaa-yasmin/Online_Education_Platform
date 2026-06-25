import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';
import './ProfilePage.css';

function Sidebar({ user, onLogout, loggingOut }) {
  const isMentor = user?.role === 'MENTOR', isAdmin = user?.role === 'ADMIN';
  return (
    <aside className="sidebar">
      <div className="sidebar-logo-area">
        <Link to="/" className="nav-logo"><div className="nav-logo-mark"><i className="ti ti-trending-up" /></div><span className="nav-logo-text">Edu<span>Path</span></span></Link>
      </div>
      <nav className="sidebar-nav">
        <Link to="/dashboard" className="sidebar-nav-item"><i className="ti ti-layout-dashboard" /> Dashboard</Link>
        {(isMentor||isAdmin) && <Link to="/mentor/dashboard" className="sidebar-nav-item"><i className="ti ti-award" /> Mentor Portal</Link>}
        {isAdmin && <Link to="/admin/portal" className="sidebar-nav-item"><i className="ti ti-settings" /> Admin Portal</Link>}
        <Link to="/courses" className="sidebar-nav-item"><i className="ti ti-book" /> Courses</Link>
        <Link to="/profile" className="sidebar-nav-item active"><i className="ti ti-user" /> Profile</Link>
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={onLogout} disabled={loggingOut}>
          {loggingOut?<><span className="loading-spinner loading-spinner-sm"/>Signing out…</>:<><i className="ti ti-logout"/>Sign out</>}
        </button>
      </div>
    </aside>
  );
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username:'', email:'', profile:{ bio:'', title:'', skills:'' } });
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState('');
  const [error, setError]       = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    if (user) setFormData({ username: user.username||'', email: user.email||'', profile:{ bio: user.profile?.bio||'', title: user.profile?.title||'', skills: user.profile?.skills||'' } });
  }, [user]);

  const handleUser    = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleProfile = e => setFormData(p => ({ ...p, profile: { ...p.profile, [e.target.name]: e.target.value } }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setSuccess(''); setError('');
    try {
      const api = (await import('../utils/api.js')).default;
      const r = await api.put('/api/auth/profile/', formData);
      updateUser(r.data); setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      const errs = err?.response?.data;
      if (errs) setError(Object.entries(errs).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(' '):v}`).join(' | '));
      else setError('Failed to update profile.');
    } finally { setLoading(false); }
  };

  const handleLogout = async () => { setLoggingOut(true); await logout(); navigate('/login'); };
  const initials = (user?.username||'U').slice(0,2).toUpperCase();

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} />
      <div className="inner-page">
        <header className="topbar">
          <div className="topbar-left"><h1>Account Settings</h1><p>Manage your profile and preferences</p></div>
          <div className="topbar-right">
            <div className="avatar-initials" style={{width:32,height:32,fontSize:13}}>{initials}</div>
          </div>
        </header>

        <div className="profile-page-wrap">
          <Link to="/dashboard" className="back-link"><i className="ti ti-arrow-left" /> Back to Dashboard</Link>

          <div className="profile-layout">
            {/* Left card */}
            <aside className="profile-card-left">
              <div className="profile-avatar-big">{initials}</div>
              <h2 className="profile-name">{user?.username}</h2>
              <p className="profile-email">{user?.email}</p>
              <span className={`badge badge-${(user?.role||'student').toLowerCase()}`}>{user?.role}</span>
              <div className="profile-meta">
                <div className="profile-meta-row">
                  <span className="profile-meta-lbl">Status</span>
                  <span className="profile-meta-val">
                    {user?.role === 'MENTOR'
                      ? user?.profile?.is_approved
                        ? <span className="badge badge-approved">Approved</span>
                        : <span className="badge badge-pending">Pending</span>
                      : <span className="badge badge-approved">Active</span>}
                  </span>
                </div>
              </div>
            </aside>

            {/* Right form */}
            <main className="profile-card-right">
              <h1 className="profile-right-title">Edit Profile</h1>
              <p className="profile-right-sub">Update your personal information and public profile details.</p>

              {success && <div className="alert alert-success" style={{marginBottom:18}}><i className="ti ti-check" /> {success}</div>}
              {error   && <div className="alert alert-error"   style={{marginBottom:18}}>{error}</div>}

              <form onSubmit={handleSubmit} className="profile-form" noValidate>
                <div className="profile-form-section">
                  <p className="profile-section-label">Core Information</p>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Username</label>
                      <div className="input-with-icon">
                        <i className="ti ti-user" />
                        <input name="username" type="text" value={formData.username} onChange={handleUser} required />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <div className="input-with-icon">
                        <i className="ti ti-mail" />
                        <input name="email" type="email" value={formData.email} onChange={handleUser} required />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="profile-form-section">
                  <p className="profile-section-label">Public Bio & Professional Details</p>
                  {user?.role === 'MENTOR' && (
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Professional Title</label>
                        <input name="title" type="text" placeholder="e.g. Senior Software Engineer" value={formData.profile.title} onChange={handleProfile} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Skills (comma separated)</label>
                        <input name="skills" type="text" placeholder="React, Node.js, Python" value={formData.profile.skills} onChange={handleProfile} />
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Bio</label>
                    <textarea name="bio" placeholder="Tell us about yourself…" value={formData.profile.bio} onChange={handleProfile} rows={4} />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-lg" style={{alignSelf:'flex-start',borderRadius:'var(--r-md)'}} disabled={loading}>
                  {loading ? <><span className="loading-spinner loading-spinner-sm" /> Saving…</> : 'Save Changes'}
                </button>
              </form>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

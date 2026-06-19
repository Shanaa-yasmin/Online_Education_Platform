import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';
import './ProfilePage.css';

// Icons
const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);
const EmailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);
const BookOpenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

export default function ProfilePage() {
  const { user, updateUser, refreshProfile } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    profile: {
      bio: '',
      title: '',
      skills: ''
    }
  });

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state with user context when loaded
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        profile: {
          bio: user.profile?.bio || '',
          title: user.profile?.title || '',
          skills: user.profile?.skills || ''
        }
      });
    }
  }, [user]);

  const handleUserChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [name]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      // Import api utility dynamically or rely on context
      const api = (await import('../utils/api.js')).default;
      const response = await api.put('/api/auth/profile/', formData);
      updateUser(response.data);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      if (err?.response?.data) {
        const errors = err.response.data;
        const messages = [];
        Object.entries(errors).forEach(([key, val]) => {
          messages.push(`${key}: ${Array.isArray(val) ? val.join(' ') : val}`);
        });
        setErrorMsg(messages.join(' | '));
      } else {
        setErrorMsg('Failed to update profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (!user) return '?';
    return user.username ? user.username.slice(0, 2).toUpperCase() : 'U';
  };

  return (
    <div className="profile-page">
      <div className="auth-glow auth-glow-1" aria-hidden="true" />
      <div className="auth-glow auth-glow-2" aria-hidden="true" />

      <header className="profile-topbar animate-fadeIn">
        <Link to="/dashboard" className="back-btn" id="profile-back-dashboard">
          <BackIcon /> Back to Dashboard
        </Link>
        <span className="profile-topbar-title">Account Settings</span>
      </header>

      <div className="profile-container animate-scaleIn">
        {/* Profile Sidebar Info */}
        <aside className="profile-card-left">
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar-big">
              {getInitials()}
            </div>
            <h2 className="profile-name">{user?.username}</h2>
            <p className="profile-email">{user?.email}</p>
            <span className={`badge badge-${user?.role?.toLowerCase()}`} style={{ marginTop: '8px' }}>
              {user?.role}
            </span>
          </div>

          <div className="profile-meta-info">
            <div className="meta-item">
              <span className="meta-label">Status</span>
              <span className="meta-value">
                {user?.role === 'MENTOR' ? (
                  user?.profile?.is_approved ? (
                    <span className="badge badge-approved">Approved Mentor</span>
                  ) : (
                    <span className="badge badge-pending">Pending Approval</span>
                  )
                ) : (
                  <span className="badge badge-student">Active Student</span>
                )}
              </span>
            </div>
          </div>
        </aside>

        {/* Profile Editing Form */}
        <main className="profile-card-right">
          <h1 className="profile-heading">Edit Profile</h1>
          <p className="profile-subheading">Update your personal information and public profile details.</p>

          {successMsg && (
            <div className="alert alert-success animate-fadeIn" role="alert" id="profile-success-alert">
              <CheckIcon /> {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="alert alert-error animate-fadeIn" role="alert" id="profile-error-alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="profile-form" noValidate>
            <div className="form-section">
              <h3 className="form-section-title">Core Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-username">Username</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><UserIcon /></span>
                    <input
                      id="profile-username"
                      name="username"
                      type="text"
                      className="form-input"
                      value={formData.username}
                      onChange={handleUserChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="profile-email">Email Address</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><EmailIcon /></span>
                    <input
                      id="profile-email"
                      name="email"
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={handleUserChange}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mentor-specific or extended profile details */}
            <div className="form-section">
              <h3 className="form-section-title">Public Bio &amp; Professional Details</h3>
              
              {user?.role === 'MENTOR' && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="profile-title">Professional Title</label>
                    <input
                      id="profile-title"
                      name="title"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Senior Software Engineer / Physics Professor"
                      value={formData.profile.title}
                      onChange={handleProfileChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="profile-skills">Expertise / Skills (comma separated)</label>
                    <input
                      id="profile-skills"
                      name="skills"
                      type="text"
                      className="form-input"
                      placeholder="e.g. React, Node.js, Python"
                      value={formData.profile.skills}
                      onChange={handleProfileChange}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="profile-bio">Bio / Description</label>
                <textarea
                  id="profile-bio"
                  name="bio"
                  className="form-input form-textarea"
                  placeholder="Tell us about yourself..."
                  value={formData.profile.bio}
                  onChange={handleProfileChange}
                  rows={4}
                />
              </div>
            </div>

            <button
              id="profile-save-btn"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ alignSelf: 'flex-start' }}
            >
              {loading ? (
                <>
                  <span className="loading-spinner loading-spinner-sm" />
                  Saving changes…
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}

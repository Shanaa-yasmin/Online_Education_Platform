import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './AuthPages.css';

// Icons
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);
const EmailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const EyeIcon = ({ open }) => open ? (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
    <line x1="2" x2="22" y1="2" y2="22"/>
  </svg>
);
const LogoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logo-grad-reg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7c3aed"/>
        <stop offset="1" stopColor="#ec4899"/>
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="10" fill="url(#logo-grad-reg)"/>
    <path d="M8 22 L12 10 L16 18 L20 12 L24 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

const INITIAL_FORM = {
  username: '',
  email: '',
  password: '',
  password_confirm: '',
  role: 'STUDENT',
};

function PasswordStrength({ password }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  const strength = checks.filter((c) => c.ok).length;
  const colors = ['', '#f43f5e', '#f59e0b', '#10b981'];
  const labels = ['', 'Weak', 'Fair', 'Strong'];

  if (!password) return null;

  return (
    <div className="pw-strength">
      <div className="pw-bars">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="pw-bar"
            style={{ background: i <= strength ? colors[strength] : 'var(--border-subtle)' }}
          />
        ))}
      </div>
      <div className="pw-checks">
        {checks.map((c) => (
          <span key={c.label} className={`pw-check ${c.ok ? 'ok' : ''}`}>
            <CheckIcon /> {c.label}
          </span>
        ))}
      </div>
      <span className="pw-label" style={{ color: colors[strength] }}>{labels[strength]}</span>
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]       = useState(INITIAL_FORM);
  const [showPw, setShowPw]   = useState(false);
  const [showPwC, setShowPwC] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const handleChange = (e) => {
    setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRoleSelect = (role) => {
    setErrors((prev) => ({ ...prev, role: '' }));
    setForm((prev) => ({ ...prev, role }));
  };

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = 'Username is required.';
    else if (form.username.length < 3) errs.username = 'Username must be at least 3 characters.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email address.';
    if (!form.password) errs.password = 'Password is required.';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (form.password !== form.password_confirm) errs.password_confirm = 'Passwords do not match.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const userData = await register(form);
      navigate('/dashboard');
    } catch (err) {
      if (err?.response?.data) {
        const serverErrors = err.response.data;
        // Map server field errors
        const mapped = {};
        Object.entries(serverErrors).forEach(([key, val]) => {
          mapped[key] = Array.isArray(val) ? val.join(' ') : val;
        });
        setErrors(mapped);
      } else {
        setErrors({ non_field_errors: 'Registration failed. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-1" aria-hidden="true" />
      <div className="auth-glow auth-glow-2" aria-hidden="true" />

      <div className="auth-card auth-card-wide animate-scaleIn">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo">
            <LogoIcon />
          </div>
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">Start your learning journey today — it's free</p>
        </div>

        {/* Top-level error */}
        {errors.non_field_errors && (
          <div className="alert alert-error animate-fadeIn" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            {errors.non_field_errors}
          </div>
        )}

        {/* Role selector */}
        <div className="role-selector">
          <p className="form-label" style={{ marginBottom: '10px' }}>I want to join as</p>
          <div className="role-options">
            <button
              id="role-student-btn"
              type="button"
              className={`role-option ${form.role === 'STUDENT' ? 'active' : ''}`}
              onClick={() => handleRoleSelect('STUDENT')}
            >
              <span className="role-icon">🎓</span>
              <span className="role-name">Student</span>
              <span className="role-desc">Learn from expert mentors</span>
            </button>
            <button
              id="role-mentor-btn"
              type="button"
              className={`role-option ${form.role === 'MENTOR' ? 'active' : ''}`}
              onClick={() => handleRoleSelect('MENTOR')}
            >
              <span className="role-icon">🏆</span>
              <span className="role-name">Mentor</span>
              <span className="role-desc">Share your expertise</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-username">Username</label>
              <div className="input-wrapper">
                <span className="input-icon"><UserIcon /></span>
                <input
                  id="reg-username"
                  name="username"
                  type="text"
                  className={`form-input${errors.username ? ' error' : ''}`}
                  placeholder="your_username"
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                />
              </div>
              {errors.username && <span className="field-error">{errors.username}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email address</label>
              <div className="input-wrapper">
                <span className="input-icon"><EmailIcon /></span>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  className={`form-input${errors.email ? ' error' : ''}`}
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <div className="input-wrapper">
                <span className="input-icon"><LockIcon /></span>
                <input
                  id="reg-password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  className={`form-input${errors.password ? ' error' : ''}`}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="input-toggle-btn"
                  onClick={() => setShowPw((p) => !p)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
              <PasswordStrength password={form.password} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-password-confirm">Confirm password</label>
              <div className="input-wrapper">
                <span className="input-icon"><LockIcon /></span>
                <input
                  id="reg-password-confirm"
                  name="password_confirm"
                  type={showPwC ? 'text' : 'password'}
                  className={`form-input${errors.password_confirm ? ' error' : ''}`}
                  placeholder="••••••••"
                  value={form.password_confirm}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="input-toggle-btn"
                  onClick={() => setShowPwC((p) => !p)}
                  aria-label={showPwC ? 'Hide confirmation' : 'Show confirmation'}
                >
                  <EyeIcon open={showPwC} />
                </button>
              </div>
              {errors.password_confirm && <span className="field-error">{errors.password_confirm}</span>}
            </div>
          </div>

          <button
            id="register-submit-btn"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner loading-spinner-sm" />
                Creating account…
              </>
            ) : (
              'Create Account'
            )}
          </button>

          <p className="auth-terms">
            By creating an account, you agree to our{' '}
            <Link to="/terms" className="auth-link">Terms of Service</Link>{' '}
            and{' '}
            <Link to="/privacy" className="auth-link">Privacy Policy</Link>.
          </p>
        </form>

        {/* Footer */}
        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

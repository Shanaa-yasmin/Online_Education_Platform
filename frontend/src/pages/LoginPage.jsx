import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthLeftPanel from '../components/AuthLeftPanel.jsx';
import './AuthPages.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setError('');
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Invalid email or password.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <AuthLeftPanel 
        eyebrow="Learning Platform"
        title={<>Learn without<br /><em>limits.</em></>}
        description="Expert-led courses, hands-on projects, and mentors who've done it — all in one place."
      />

      {/* Right form panel */}
      <div className="auth-panel-right">
        <div className="auth-form-box">
          <Link to="/" className="auth-mobile-header" style={{ textDecoration: 'none' }}>
            <div className="auth-mobile-logo-circle">
              <img src="/favicon.jpeg" alt="EduPath Logo" className="auth-mobile-logo" />
            </div>
            <span className="auth-mobile-brand-name">EduPath</span>
          </Link>

          <div className="auth-form-header">
            <h2 className="auth-form-title">Sign in</h2>
            <p className="auth-form-sub">Welcome back — pick up where you left off.</p>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <div className="input-wrap">
                <i className="ti ti-mail input-icon" />
                <input className="form-input" name="email" type="email"
                  placeholder="you@example.com" value={form.email}
                  onChange={handleChange} autoComplete="off" required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrap">
                <i className="ti ti-lock input-icon" />
                <input className="form-input" name="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••" value={form.password}
                  onChange={handleChange} autoComplete="current-password" required />
                <button type="button" className="input-toggle" onClick={() => setShowPw(p => !p)}>
                  <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'}`} />
                </button>
              </div>
            </div>

            <Link to="/forgot-password" className="auth-forgot">Forgot password?</Link>

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? <><span className="loading-spinner loading-spinner-sm" /> Signing in…</> : 'Sign in'}
            </button>
          </form>

          <p className="auth-footer-txt">
            Don't have an account? <Link to="/register">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

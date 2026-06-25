import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './AuthPages.css';

const INITIAL = { username: '', email: '', password: '', password_confirm: '', role: 'STUDENT' };

function PwStrength({ password }) {
  const checks = [
    { label: '8+ chars', ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  const strength = checks.filter(c => c.ok).length;
  const colors = ['', '#f43f5e', '#f59e0b', '#10b981'];
  if (!password) return null;
  return (
    <div>
      <div className="pw-bars">
        {[1,2,3].map(i => (
          <div key={i} className="pw-bar"
            style={{ background: i <= strength ? colors[strength] : undefined }} />
        ))}
      </div>
      <div className="pw-checks">
        {checks.map(c => (
          <span key={c.label} className={`pw-check${c.ok ? ' ok' : ''}`}>
            <i className={`ti ${c.ok ? 'ti-check' : 'ti-circle'}`} /> {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]     = useState(INITIAL);
  const [showPw, setShowPw] = useState(false);
  const [showPwC, setShowPwC] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setErrors(p => ({ ...p, [e.target.name]: '' }));
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    const e = {};
    if (!form.username.trim())      e.username = 'Username is required.';
    else if (form.username.length < 3) e.username = 'Min 3 characters.';
    if (!form.email.trim())         e.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email.';
    if (!form.password)             e.password = 'Password is required.';
    else if (form.password.length < 8) e.password = 'Min 8 characters.';
    if (form.password !== form.password_confirm) e.password_confirm = 'Passwords do not match.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ve = validate();
    if (Object.keys(ve).length) { setErrors(ve); return; }
    setLoading(true); setErrors({});
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      if (err?.response?.data) {
        const mapped = {};
        Object.entries(err.response.data).forEach(([k,v]) => { mapped[k] = Array.isArray(v) ? v.join(' ') : v; });
        setErrors(mapped);
      } else { setErrors({ non_field_errors: 'Registration failed. Please try again.' }); }
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      {/* Left panel */}
      <div className="auth-panel-left">
        <div className="auth-brand">
          <div className="auth-brand-mark"><i className="ti ti-trending-up" /></div>
          <span className="auth-brand-name">EduPath</span>
        </div>
        <div className="auth-hero">
          <p className="auth-hero-eyebrow">Join EduPath</p>
          <h1 className="auth-hero-h">Your career,<br /><em>accelerated.</em></h1>
          <p className="auth-hero-p">Access 320+ courses, connect with industry mentors, and build skills that employers actually want.</p>
        </div>
        <div className="auth-stats">
          <div><span className="auth-stat-val">320+</span><span className="auth-stat-lbl">Courses</span></div>
          <div><span className="auth-stat-val">4.9★</span><span className="auth-stat-lbl">Rating</span></div>
          <div><span className="auth-stat-val">Free</span><span className="auth-stat-lbl">To start</span></div>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-panel-right">
        <div className="auth-form-box wide">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Create your account</h2>
            <p className="auth-form-sub">Start your learning journey today — it's free.</p>
          </div>

          {errors.non_field_errors && <div className="alert alert-error" style={{marginBottom:16}}>{errors.non_field_errors}</div>}

          {/* Role selector */}
          <div style={{marginBottom:20}}>
            <p className="form-label" style={{marginBottom:8}}>I want to join as</p>
            <div className="role-options">
              {[
                { role: 'STUDENT', icon: '🎓', name: 'Student', desc: 'Learn from experts' },
                { role: 'MENTOR',  icon: '🏆', name: 'Mentor',  desc: 'Share your expertise' },
              ].map(o => (
                <button key={o.role} type="button"
                  className={`role-option${form.role === o.role ? ' active' : ''}`}
                  onClick={() => setForm(p => ({ ...p, role: o.role }))}>
                  <span className="role-icon">{o.icon}</span>
                  <span className="role-name">{o.name}</span>
                  <span className="role-desc">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Username</label>
                <div className="input-wrap">
                  <i className="ti ti-user input-icon" />
                  <input className={`form-input${errors.username ? ' error' : ''}`}
                    name="username" type="text" placeholder="your_username"
                    value={form.username} onChange={handleChange} autoComplete="username" />
                </div>
                {errors.username && <span className="field-error">{errors.username}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Email address</label>
                <div className="input-wrap">
                  <i className="ti ti-mail input-icon" />
                  <input className={`form-input${errors.email ? ' error' : ''}`}
                    name="email" type="email" placeholder="you@example.com"
                    value={form.email} onChange={handleChange} autoComplete="email" />
                </div>
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-wrap">
                  <i className="ti ti-lock input-icon" />
                  <input className={`form-input${errors.password ? ' error' : ''}`}
                    name="password" type={showPw ? 'text' : 'password'}
                    placeholder="••••••••" value={form.password}
                    onChange={handleChange} autoComplete="new-password" />
                  <button type="button" className="input-toggle" onClick={() => setShowPw(p => !p)}>
                    <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'}`} />
                  </button>
                </div>
                {errors.password && <span className="field-error">{errors.password}</span>}
                <PwStrength password={form.password} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm password</label>
                <div className="input-wrap">
                  <i className="ti ti-lock input-icon" />
                  <input className={`form-input${errors.password_confirm ? ' error' : ''}`}
                    name="password_confirm" type={showPwC ? 'text' : 'password'}
                    placeholder="••••••••" value={form.password_confirm}
                    onChange={handleChange} autoComplete="new-password" />
                  <button type="button" className="input-toggle" onClick={() => setShowPwC(p => !p)}>
                    <i className={`ti ${showPwC ? 'ti-eye-off' : 'ti-eye'}`} />
                  </button>
                </div>
                {errors.password_confirm && <span className="field-error">{errors.password_confirm}</span>}
              </div>
            </div>

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? <><span className="loading-spinner loading-spinner-sm" /> Creating account…</> : 'Create Account'}
            </button>

            <p style={{fontSize:12,color:'var(--txt-3)',textAlign:'center'}}>
              By creating an account you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
            </p>
          </form>

          <p className="auth-footer-txt">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

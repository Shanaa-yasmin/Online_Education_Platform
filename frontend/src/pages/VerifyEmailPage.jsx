import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../utils/api.js';
import AuthLeftPanel from '../components/AuthLeftPanel.jsx';
import './AuthPages.css';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const uidb64 = searchParams.get('uidb64');
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [errorMsg, setErrorMsg] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    
    if (!uidb64 || !token) {
      setStatus('error');
      setErrorMsg('Invalid verification link. Missing parameters.');
      return;
    }

    const verify = async () => {
      hasVerified.current = true;
      try {
        await api.post('/api/auth/verify-email/', { uidb64, token });
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.response?.data?.detail || 'Verification failed. The link may be expired.');
      }
    };

    verify();
  }, [uidb64, token]);

  return (
    <div className="auth-page">
      <AuthLeftPanel 
        eyebrow="Verify Email"
        title="Almost there."
        description="Verifying your email gives you full access to EduPath."
      />

      <div className="auth-panel-right">
        <div className="auth-form-box">
          <div className="auth-mobile-header">
            <div className="auth-mobile-logo-circle">
              <img src="/favicon.jpeg" alt="EduPath Logo" className="auth-mobile-logo" />
            </div>
            <span className="auth-mobile-brand-name">EduPath</span>
          </div>

          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            
            {status === 'verifying' && (
              <>
                <div style={{ fontSize: '48px', color: 'var(--txt-3)', marginBottom: '16px' }}>
                  <i className="ti ti-loader" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                </div>
                <h2 className="auth-form-title" style={{ marginBottom: '12px' }}>Verifying email...</h2>
                <p className="auth-form-sub">Please wait a moment while we verify your account.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div style={{ fontSize: '48px', color: 'var(--success, #10b981)', marginBottom: '16px' }}>
                  <i className="ti ti-circle-check-filled" />
                </div>
                <h2 className="auth-form-title" style={{ marginBottom: '12px' }}>Email Verified!</h2>
                <p className="auth-form-sub" style={{ marginBottom: '24px' }}>
                  Your account has been successfully verified. You can now log in.
                </p>
                <Link to="/login" className="btn btn-primary w-full" style={{ justifyContent: 'center' }}>
                  Go to Login
                </Link>
              </>
            )}

            {status === 'error' && (
              <>
                <div style={{ fontSize: '48px', color: 'var(--danger, #ef4444)', marginBottom: '16px' }}>
                  <i className="ti ti-alert-circle-filled" />
                </div>
                <h2 className="auth-form-title" style={{ marginBottom: '12px' }}>Verification Failed</h2>
                <p className="auth-form-sub" style={{ marginBottom: '24px', color: 'var(--danger, #ef4444)' }}>
                  {errorMsg}
                </p>
                <Link to="/login" className="btn btn-secondary w-full" style={{ justifyContent: 'center' }}>
                  Return to Login
                </Link>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

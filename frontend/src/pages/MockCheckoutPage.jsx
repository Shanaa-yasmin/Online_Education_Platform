import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import './MockCheckoutPage.css';

export default function MockCheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gateway = searchParams.get('gateway') || 'stripe';
  const courseId = searchParams.get('course_id');
  const transactionId = searchParams.get('transaction_id');

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');

  useEffect(() => {
    if (!courseId) {
      setError('Missing course_id parameter.');
      setLoading(false);
      return;
    }

    const fetchCourse = async () => {
      try {
        const res = await api.get(`/api/courses/${courseId}/`);
        setCourse(res.data);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch course details for checkout.');
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  const handleSuccess = () => {
    setProcessing(true);
    setProcessStatus('Authorizing mock credentials...');
    
    setTimeout(() => {
      setProcessStatus('Simulating transaction processing...');
      setTimeout(() => {
        setProcessStatus('Fulfilling course enrollment entitlements...');
        setTimeout(() => {
          const successUrl = `/courses/${courseId}?payment_success=true&gateway=${gateway}&` + 
            (gateway === 'stripe' ? `session_id=${transactionId}` : `order_id=${transactionId}`);
          navigate(successUrl);
        }, 600);
      }, 600);
    }, 600);
  };

  const handleCancel = () => {
    navigate(`/courses/${courseId}?payment_cancel=true`);
  };

  if (loading) {
    return (
      <div className="mock-checkout-page loading-screen">
        <div className="loading-card glass-card">
          <div className="spinner-large"></div>
          <p>Initializing Secure Sandbox Environment...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="mock-checkout-page loading-screen">
        <div className="glass-card error-card">
          <h2>Sandbox Initialization Failed</h2>
          <p className="error-msg">{error || 'Course not found.'}</p>
          <button className="btn btn-secondary" onClick={() => navigate('/courses')}>
            Return to Explore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mock-checkout-layout">
      <div className="sandbox-ribbon">
        ⚙️ PLATFORM SANDBOX — NO REAL CHARGES WILL BE MOCK ACCUMULATED
      </div>
      
      <div className="mock-checkout-container">
        <div className="glass-card checkout-card animate-scaleIn">
          <div className="checkout-header">
            <div className="sandbox-logo">
              Edu<span>Path</span> <span className="badge-sandbox">Sandbox</span>
            </div>
            <div className="gateway-badge">
              {gateway === 'stripe' ? '💳 Stripe Checkout' : 'PayPal Standard'}
            </div>
          </div>

          <div className="checkout-body">
            <div className="section-title">Order Summary</div>
            <div className="order-details">
              <div className="item-row">
                <span className="item-name">{course.title}</span>
                <span className="item-price">${parseFloat(course.price).toFixed(2)}</span>
              </div>
              <div className="item-sub">Mentor: {course.mentor?.username || 'Expert Instructor'}</div>
              <div className="divider"></div>
              <div className="total-row">
                <span>Total Due</span>
                <span className="total-price">${parseFloat(course.price).toFixed(2)}</span>
              </div>
            </div>

            <div className="section-title">Billing Details (Simulated)</div>
            <div className="billing-details">
              <p><strong>Customer:</strong> Demo Student</p>
              <p><strong>Email:</strong> student@example.com</p>
              <p><strong>Session/Order ID:</strong> <code className="tx-code">{transactionId}</code></p>
            </div>

            {processing ? (
              <div className="processing-overlay">
                <div className="spinner-large"></div>
                <h3>Processing Simulated checkout</h3>
                <p className="process-status-msg">{processStatus}</p>
              </div>
            ) : (
              <div className="checkout-actions">
                <button className="btn-simulate-success" onClick={handleSuccess}>
                  Simulate Successful Payment
                </button>
                <button className="btn-simulate-cancel" onClick={handleCancel}>
                  Cancel Transaction
                </button>
              </div>
            )}
          </div>
          
          <div className="checkout-footer">
            🛡️ SSL Secured Sandbox · Sandbox tokens are verified server-side
          </div>
        </div>
      </div>
    </div>
  );
}

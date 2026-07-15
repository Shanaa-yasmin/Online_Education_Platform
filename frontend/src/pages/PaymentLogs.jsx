import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import Sidebar from '../components/Sidebar.jsx';
import './MentorDashboard.css';

export default function PaymentLogs() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLP] = useState(true);
  const [paymentsError, setPE] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPayments = async (active) => {
    try {
      setLP(true);
      const r = await api.get('/api/payments/payments/');
      if (active.current) {
        setPayments(r.data.results || r.data);
        setPE('');
      }
    } catch {
      if (active.current) setPE('Failed to load payments logs.');
    } finally {
      if (active.current) setLP(false);
    }
  };

  useEffect(() => {
    const active = { current: true };
    if (user) {
      fetchPayments(active);
    }
    return () => { active.current = false; };
  }, [user]);

  const actRefund = async (id) => {
    if (!window.confirm('Are you sure you want to refund this payment? The student will immediately lose access to the course.')) return;
    setActioningId(id);
    try {
      await api.post(`/api/payments/payments/${id}/refund/`);
      setPayments(p => p.map(pay => pay.id === id ? { ...pay, status: 'REFUNDED', refunded_at: new Date().toISOString() } : pay));
      alert('Payment refunded successfully. Student access revoked.');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to refund payment.');
    } finally {
      setActioningId(null);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  const filteredPayments = payments.filter(pay => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (pay.student?.username || '').toLowerCase().includes(query) ||
      (pay.student?.email || '').toLowerCase().includes(query) ||
      (pay.course_title || '').toLowerCase().includes(query) ||
      (pay.transaction_id || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} active="mentor-payments" />
      <div className="inner-page">

        <div className="mentor-page-wrap">
          <div className="animate-fadeIn">
            {paymentsError && <div className="alert alert-error">{paymentsError}</div>}
            {loadingPayments ? (
              <div className="loading-container">
                <div className="loading-spinner" />
                <p>Loading payments logs…</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="mentor-empty">
                <i className="ti ti-receipt" />
                <h3>No sales records found</h3>
                <p>Payments for your courses will appear here.</p>
              </div>
            ) : (
              <>
                <div className="payment-logs-controls" style={{ marginBottom: 20 }}>
                  <div className="my-courses-search" style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
                    <i className="ti ti-search search-icon" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt-4)', fontSize: 16 }} />
                    <input
                      type="text"
                      placeholder="Search student, course, transaction ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="my-courses-search-input"
                      style={{ width: '100%', paddingLeft: 40, height: 42, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13.5, color: 'var(--txt-1)' }}
                    />
                  </div>
                </div>

                {filteredPayments.length === 0 ? (
                  <div className="mentor-empty">
                    <i className="ti ti-receipt" />
                    <h3>No transactions match your search</h3>
                    <p>Try refining your search query or check spelling.</p>
                  </div>
                ) : (
                  <div className="payments-table-wrap">
                    <table className="payments-table">
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', height: 40, color: 'var(--txt-3)' }}>
                          <th style={{ padding: 8 }}>Student</th>
                          <th style={{ padding: 8 }}>Course</th>
                          <th style={{ padding: 8 }}>Amount</th>
                          <th style={{ padding: 8 }}>Gateway</th>
                          <th style={{ padding: 8 }}>Transaction ID</th>
                          <th style={{ padding: 8 }}>Status</th>
                          <th style={{ padding: 8 }}>Date</th>
                          <th style={{ padding: 8 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map(pay => (
                          <tr key={pay.id} style={{ borderBottom: '1px solid var(--border)', height: 48 }}>
                            <td style={{ padding: 8 }}>
                              <div style={{ fontWeight: 600, color: 'var(--txt-1)' }}>@{pay.student?.username}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>{pay.student?.email}</div>
                            </td>
                            <td style={{ padding: 8, color: 'var(--txt-1)' }}>{pay.course_title}</td>
                            <td style={{ padding: 8, fontWeight: 600, color: 'var(--txt-1)' }}>${pay.amount}</td>
                            <td style={{ padding: 8 }}><span className="badge badge-beginner" style={{ background: '#edf2f7', color: '#4a5568' }}>{pay.gateway}</span></td>
                            <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 12, color: 'var(--txt-3)' }}>{pay.transaction_id}</td>
                            <td style={{ padding: 8 }}>
                              <span className={`badge ${pay.status === 'COMPLETED' ? 'badge-live' : pay.status === 'PENDING' ? 'badge-pending-mod' : 'badge-draft'}`}>
                                {pay.status}
                              </span>
                            </td>
                            <td style={{ padding: 8, color: 'var(--txt-3)' }}>{new Date(pay.created_at).toLocaleDateString()}</td>
                            <td style={{ padding: 8 }}>
                              {pay.status === 'COMPLETED' ? (
                                <button
                                  className="btn btn-danger btn-xs"
                                  style={{ padding: '4px 8px', fontSize: 11 }}
                                  onClick={() => actRefund(pay.id)}
                                  disabled={actioningId !== null}
                                >
                                  Refund
                                </button>
                              ) : pay.status === 'REFUNDED' ? (
                                <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>
                                  Refunded
                                </span>
                              ) : (
                                <span style={{ color: 'var(--txt-3)' }}>-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

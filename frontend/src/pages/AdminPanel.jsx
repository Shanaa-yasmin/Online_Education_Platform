import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import NotificationBell from '../components/NotificationBell.jsx';
import Sidebar from '../components/Sidebar.jsx';
import './AdminPanel.css';

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setTabState] = useState(searchParams.get('tab') || 'courses');
  const [pendingCourses, setPendingCourses] = useState([]);
  const [pendingMentors, setPendingMentors] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingCourses, setLC] = useState(true);
  const [loadingMentors, setLM] = useState(true);
  const [loadingPayments, setLP] = useState(true);
  const [coursesError, setCE] = useState('');
  const [mentorsError, setME] = useState('');
  const [paymentsError, setPE] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const setTab = (tab) => {
    setTabState(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['courses', 'mentors', 'payments'].includes(tabParam) && tabParam !== activeTab) {
      setTabState(tabParam);
    }
  }, [searchParams]);

  const fetchCourses = async () => { try { setLC(true); const r = await api.get('/api/courses/'); setPendingCourses(r.data.filter(c => !c.is_approved)); setCE(''); } catch { setCE('Failed to fetch pending courses.'); } finally { setLC(false); } };
  const fetchMentors = async () => { try { setLM(true); const r = await api.get('/api/auth/profiles/?role=MENTOR&is_approved=false'); setPendingMentors(r.data); setME(''); } catch { setME('Failed to fetch pending mentors.'); } finally { setLM(false); } };
  const fetchPayments = async () => { try { setLP(true); const r = await api.get('/api/payments/payments/'); setPayments(r.data); setPE(''); } catch { setPE('Failed to fetch payments logs.'); } finally { setLP(false); } };

  useEffect(() => { fetchCourses(); fetchMentors(); fetchPayments(); }, []);

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

  const handleLogout = async () => { setLoggingOut(true); await logout(); navigate('/login'); };

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} active="admin-portal" />
      <div className="inner-page">
        <header className="topbar">
          <div className="topbar-left"><h1>Admin Portal</h1><p>Review and moderate content submissions</p></div>
          <div className="topbar-right">
            <NotificationBell user={user} />
          </div>
        </header>

        <div className="admin-page-wrap">
          <div>
            <Link to="/dashboard" className="back-link"><i className="ti ti-arrow-left" /> Back to Dashboard</Link>
            <h1 style={{ fontFamily: 'Fraunces,serif', fontSize: 'clamp(1.4rem,2.5vw,1.9rem)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--txt-1)' }}>Admin Moderation Portal</h1>
            <p style={{ fontSize: 13.5, color: 'var(--txt-3)', marginTop: 3 }}>Review course submissions and mentor credentials.</p>
          </div>

          {/* Stats */}
          <div className="admin-stats">
            {[
              { label: 'Courses Awaiting Review', value: pendingCourses.length, icon: 'ti-books', color: '#309D8E', bg: 'rgba(48,157,142,0.1)' },
              { label: 'Mentor Registrations', value: pendingMentors.length, icon: 'ti-users', color: '#2563eb', bg: '#eff4fe' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="stat-card-icon" style={{ background: s.bg, color: s.color, width: 44, height: 44, borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`ti ${s.icon}`} style={{ fontSize: 22 }} />
                </div>
                <div>
                  <div className="stat-card-num">{s.value}</div>
                  <div className="stat-card-lbl">{s.label}</div>
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
            <button className={`tab-btn${activeTab === 'payments' ? ' active' : ''}`} onClick={() => setTab('payments')}>
              Payments Log ({payments.length})
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

          {activeTab === 'payments' && (
            <div>
              {paymentsError && <div className="alert alert-error">{paymentsError}</div>}
              {loadingPayments ? (
                <div className="loading-container"><div className="loading-spinner" /><p>Loading payments logs…</p></div>
              ) : payments.length === 0 ? (
                <div className="admin-empty"><i className="ti ti-receipt" /><h3>No payments found</h3><p>Transaction records will appear here.</p></div>
              ) : (
                <div className="mod-list">
                  <div className="payments-table-wrap" style={{ width: '100%', overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
                    <table className="payments-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-subtle)', height: 40, color: 'var(--txt-3)' }}>
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
                        {payments.map(pay => (
                          <tr key={pay.id} style={{ borderBottom: '1px solid var(--border-subtle)', height: 48 }}>
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

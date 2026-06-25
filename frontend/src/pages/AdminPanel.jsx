import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import './AdminPanel.css';

function Sidebar({ onLogout, loggingOut }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo-area">
        <Link to="/" className="nav-logo"><div className="nav-logo-mark"><i className="ti ti-trending-up" /></div><span className="nav-logo-text">Edu<span>Path</span></span></Link>
      </div>
      <nav className="sidebar-nav">
        <Link to="/dashboard" className="sidebar-nav-item"><i className="ti ti-layout-dashboard" /> Dashboard</Link>
        <Link to="/mentor/dashboard" className="sidebar-nav-item"><i className="ti ti-award" /> Mentor Portal</Link>
        <Link to="/admin/portal" className="sidebar-nav-item active"><i className="ti ti-settings" /> Admin Portal</Link>
        <Link to="/courses" className="sidebar-nav-item"><i className="ti ti-book" /> Courses</Link>
        <Link to="/profile" className="sidebar-nav-item"><i className="ti ti-user" /> Profile</Link>
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={onLogout} disabled={loggingOut}>
          {loggingOut?<><span className="loading-spinner loading-spinner-sm"/>Signing out…</>:<><i className="ti ti-logout"/>Sign out</>}
        </button>
      </div>
    </aside>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setTab]         = useState('courses');
  const [pendingCourses, setPendingCourses] = useState([]);
  const [pendingMentors, setPendingMentors] = useState([]);
  const [loadingCourses, setLC]     = useState(true);
  const [loadingMentors, setLM]     = useState(true);
  const [coursesError, setCE]       = useState('');
  const [mentorsError, setME]       = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const fetchCourses = async () => { try { setLC(true); const r = await api.get('/api/courses/'); setPendingCourses(r.data.filter(c=>!c.is_approved)); setCE(''); } catch { setCE('Failed to fetch pending courses.'); } finally { setLC(false); } };
  const fetchMentors = async () => { try { setLM(true); const r = await api.get('/api/auth/profiles/?role=MENTOR&is_approved=false'); setPendingMentors(r.data); setME(''); } catch { setME('Failed to fetch pending mentors.'); } finally { setLM(false); } };

  useEffect(() => { fetchCourses(); fetchMentors(); }, []);

  const actCourse = async (id, action) => {
    setActioningId(id);
    try { await api.post(`/api/courses/${id}/${action}/`); setPendingCourses(p=>p.filter(c=>c.id!==id)); }
    catch { alert(`Failed to ${action} course.`); }
    finally { setActioningId(null); }
  };
  const actMentor = async (id, action) => {
    if (action==='reject' && !window.confirm('Reject this mentor?')) return;
    setActioningId(id);
    try { await api.post(`/api/auth/profiles/${id}/${action}/`); setPendingMentors(p=>p.filter(m=>m.id!==id)); }
    catch { alert(`Failed to ${action} mentor.`); }
    finally { setActioningId(null); }
  };

  const handleLogout = async () => { setLoggingOut(true); const { useAuth } = await import('../context/AuthContext.jsx'); navigate('/login'); };

  return (
    <div className="page-shell">
      <Sidebar onLogout={handleLogout} loggingOut={loggingOut} />
      <div className="inner-page">
        <header className="topbar">
          <div className="topbar-left"><h1>Admin Portal</h1><p>Review and moderate content submissions</p></div>
        </header>

        <div className="admin-page-wrap">
          <div>
            <Link to="/dashboard" className="back-link"><i className="ti ti-arrow-left" /> Back to Dashboard</Link>
            <h1 style={{fontFamily:'Fraunces,serif',fontSize:'clamp(1.4rem,2.5vw,1.9rem)',fontWeight:800,letterSpacing:'-0.02em',color:'var(--txt-1)'}}>Admin Moderation Portal</h1>
            <p style={{fontSize:13.5,color:'var(--txt-3)',marginTop:3}}>Review course submissions and mentor credentials.</p>
          </div>

          {/* Stats */}
          <div className="admin-stats">
            {[
              { label:'Courses Awaiting Review', value: pendingCourses.length, icon:'ti-books',     color:'#309D8E', bg:'rgba(48,157,142,0.1)' },
              { label:'Mentor Registrations',    value: pendingMentors.length, icon:'ti-users',     color:'#2563eb', bg:'#eff4fe' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{display:'flex',alignItems:'center',gap:16}}>
                <div className="stat-card-icon" style={{background:s.bg,color:s.color,width:44,height:44,borderRadius:'var(--r-md)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <i className={`ti ${s.icon}`} style={{fontSize:22}} />
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
            <button className={`tab-btn${activeTab==='courses'?' active':''}`} onClick={()=>setTab('courses')}>
              Course Queue ({pendingCourses.length})
            </button>
            <button className={`tab-btn${activeTab==='mentors'?' active':''}`} onClick={()=>setTab('mentors')}>
              Mentor Queue ({pendingMentors.length})
            </button>
          </div>

          {activeTab === 'courses' ? (
            <div>
              {coursesError && <div className="alert alert-error">{coursesError}</div>}
              {loadingCourses ? <div className="loading-container"><div className="loading-spinner"/><p>Loading…</p></div>
              : pendingCourses.length === 0 ? (
                <div className="admin-empty"><i className="ti ti-shield-check"/><h3>Queue is clear</h3><p>All submitted courses are reviewed.</p></div>
              ) : (
                <div className="mod-list">
                  {pendingCourses.map(course => (
                    <article key={course.id} className="mod-card">
                      <div className="mod-card-body">
                        <div className="mod-card-tags">
                          <span className={`badge badge-${course.level.toLowerCase()}`}>{course.level}</span>
                          <span style={{fontSize:12,color:'var(--txt-3)'}}>{course.language} · {course.duration_hours}h</span>
                        </div>
                        <h3 className="mod-card-title">{course.title}</h3>
                        <p className="mod-card-sub">By <strong>{course.mentor?.username}</strong> ({course.mentor?.email})</p>
                        <p className="mod-card-desc">{course.description}</p>
                      </div>
                      <div className="mod-actions">
                        <button className="btn btn-primary btn-sm" onClick={()=>actCourse(course.id,'approve')} disabled={actioningId!==null}><i className="ti ti-check"/>Approve</button>
                        <button className="btn btn-danger btn-sm"  onClick={()=>actCourse(course.id,'reject')}  disabled={actioningId!==null}><i className="ti ti-x"/>Reject</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {mentorsError && <div className="alert alert-error">{mentorsError}</div>}
              {loadingMentors ? <div className="loading-container"><div className="loading-spinner"/><p>Loading…</p></div>
              : pendingMentors.length === 0 ? (
                <div className="admin-empty"><i className="ti ti-users"/><h3>Queue is clear</h3><p>All mentor registrations are moderated.</p></div>
              ) : (
                <div className="mod-list">
                  {pendingMentors.map(mentor => (
                    <article key={mentor.id} className="mod-card">
                      <div className="mod-card-body">
                        <div className="mod-card-tags">
                          <span className="badge badge-mentor">MENTOR</span>
                          <span style={{fontSize:12,color:'var(--txt-3)'}}>{mentor.email}</span>
                        </div>
                        <h3 className="mod-card-title">@{mentor.username}</h3>
                        {mentor.profile && (
                          <div className="mod-mentor-box">
                            <p><strong>Title:</strong> {mentor.profile.title||'N/A'}</p>
                            <p><strong>Skills:</strong> {mentor.profile.skills||'N/A'}</p>
                            <p><strong>Bio:</strong> {mentor.profile.bio||'No bio provided.'}</p>
                          </div>
                        )}
                      </div>
                      <div className="mod-actions">
                        <button className="btn btn-primary btn-sm" onClick={()=>actMentor(mentor.id,'approve')} disabled={actioningId!==null}><i className="ti ti-check"/>Approve</button>
                        <button className="btn btn-danger btn-sm"  onClick={()=>actMentor(mentor.id,'reject')}  disabled={actioningId!==null}><i className="ti ti-x"/>Reject</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

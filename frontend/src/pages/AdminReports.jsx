import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import NotificationBell from '../components/NotificationBell.jsx';
import Sidebar from '../components/Sidebar.jsx';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import './AdminReports.css';

const PIE_COLORS = ['#309d8e', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'];

export default function AdminReports() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [filterOptions, setFilterOptions] = useState({
    courses: [], mentors: [], students: [], categories: [],
  });

  // Filter state
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    course_id: '',
    mentor_id: '',
    student_id: '',
    category: '',
    min_revenue: '',
    max_revenue: '',
    completion_status: '',
  });

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    return params.toString();
  }, [filters]);

  const fetchReports = useCallback(async (active) => {
    try {
      setLoading(true);
      setError('');
      const qs = buildQueryString();
      const res = await api.get(`/api/admin-reports/${qs ? '?' + qs : ''}`);
      if (active.current) setData(res.data);
    } catch (err) {
      console.error(err);
      if (active.current) setError('Failed to load report data. Ensure you have admin permissions.');
    } finally {
      if (active.current) setLoading(false);
    }
  }, [buildQueryString]);

  const fetchFilterOptions = useCallback(async (active) => {
    try {
      const res = await api.get('/api/admin-reports/filter-options/');
      if (active.current) setFilterOptions(res.data);
    } catch (err) {
      console.error('Failed to load filter options', err);
    }
  }, []);

  useEffect(() => {
    const active = { current: true };
    if (user) {
      fetchReports(active);
      fetchFilterOptions(active);
    }
    return () => { active.current = false; };
  }, [user]);

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleApplyFilters = () => {
    fetchReports();
  };

  const handleClearFilters = () => {
    setFilters({
      start_date: '', end_date: '', course_id: '', mentor_id: '',
      student_id: '', category: '', min_revenue: '', max_revenue: '', completion_status: '',
    });
    setTimeout(() => fetchReports(), 50);
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const qs = buildQueryString();
      const res = await api.get(`/api/admin-reports/export/?export_format=${format}${qs ? '&' + qs : ''}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
      a.download = `platform_report_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => { setLoggingOut(true); await logout(); navigate('/login'); };

  return (
    <div className="page-shell">
      <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} active="admin-reports" />
      <div className="inner-page">
        <header className="topbar">
          <div className="topbar-left"><h1>Platform Reports</h1><p>Analytics and exports for all platform activity</p></div>
          <div className="topbar-right">
            <NotificationBell user={user} />
          </div>
        </header>

        <div className="reports-wrap">
          <div className="reports-hd">
            <Link to="/dashboard" className="back-link"><i className="ti ti-arrow-left" /> Back to Dashboard</Link>
            <h1 style={{ fontFamily: 'Fraunces,serif', fontSize: 'clamp(1.4rem,2.5vw,1.9rem)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--txt-1)' }}>Admin Reports & Analytics</h1>
            <p style={{ fontSize: 13.5, color: 'var(--txt-3)', marginTop: 3 }}>Overview of courses, enrollments, revenue, and user activity across the entire platform.</p>
          </div>

          {/* Filters Section */}
          <div className="card reports-filters-card" style={{ padding: 20, marginBottom: 25 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h3 style={{ fontSize: 15, fontWeight: 'bold', margin: 0 }}><i className="ti ti-filter" style={{ marginRight: 6 }} />Report Filters</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>Clear All</button>
                <button className="btn btn-primary btn-sm" onClick={handleApplyFilters}>Apply Filters</button>
              </div>
            </div>
            <div className="reports-filter-grid">
              <div className="form-group">
                <label>Date From</label>
                <input type="date" name="start_date" value={filters.start_date} onChange={handleFilterChange} />
              </div>
              <div className="form-group">
                <label>Date To</label>
                <input type="date" name="end_date" value={filters.end_date} onChange={handleFilterChange} />
              </div>
              <div className="form-group">
                <label>Course</label>
                <select name="course_id" value={filters.course_id} onChange={handleFilterChange}>
                  <option value="">All Courses</option>
                  {filterOptions.courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Mentor</label>
                <select name="mentor_id" value={filters.mentor_id} onChange={handleFilterChange}>
                  <option value="">All Mentors</option>
                  {filterOptions.mentors.map(m => (
                    <option key={m.id} value={m.id}>@{m.username}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Student</label>
                <select name="student_id" value={filters.student_id} onChange={handleFilterChange}>
                  <option value="">All Students</option>
                  {filterOptions.students.map(s => (
                    <option key={s.id} value={s.id}>@{s.username}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select name="category" value={filters.category} onChange={handleFilterChange}>
                  <option value="">All Categories</option>
                  {filterOptions.categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Min Revenue</label>
                <input type="number" name="min_revenue" value={filters.min_revenue} onChange={handleFilterChange} placeholder="0" min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label>Max Revenue</label>
                <input type="number" name="max_revenue" value={filters.max_revenue} onChange={handleFilterChange} placeholder="10000" min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label>Completion Status</label>
                <select name="completion_status" value={filters.completion_status} onChange={handleFilterChange}>
                  <option value="">All</option>
                  <option value="completed">Completed (100%)</option>
                  <option value="in_progress">In Progress</option>
                  <option value="not_started">Not Started</option>
                </select>
              </div>
            </div>
          </div>

          {/* Export Buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 25, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" disabled={exporting} onClick={() => handleExport('csv')}>
              {exporting ? 'Exporting…' : '📄 Export CSV'}
            </button>
            <button className="btn btn-secondary btn-sm" disabled={exporting} onClick={() => handleExport('xlsx')}>
              {exporting ? 'Exporting…' : '📊 Export Excel'}
            </button>
            <button className="btn btn-secondary btn-sm" disabled={exporting} onClick={() => handleExport('pdf')}>
              {exporting ? 'Exporting…' : '📕 Export PDF'}
            </button>
          </div>

          {loading ? (
            <div className="loading-container" style={{ minHeight: 300 }}><div className="loading-spinner" /><p>Loading platform reports…</p></div>
          ) : error ? (
            <div className="alert alert-error">{error} <button className="btn btn-sm btn-secondary" onClick={fetchReports}>Retry</button></div>
          ) : data ? (
            <div className="reports-content animate-fadeIn">
              {/* Stat Cards */}
              <div className="report-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 30 }}>
                {[
                  { label: 'Total Users', value: data.stats?.total_users ?? 0, icon: 'ti-users', bg: '#e0f2fe', color: '#0284c7' },
                  { label: 'Total Courses', value: data.stats?.total_courses ?? 0, icon: 'ti-book', bg: '#dcfce7', color: '#16a34a' },
                  { label: 'Active Enrollments', value: data.stats?.total_enrollments ?? 0, icon: 'ti-school', bg: '#fef3c7', color: '#d97706' },
                  { label: 'Platform Revenue', value: `$${(data.stats?.revenue ?? 0).toFixed(2)}`, icon: 'ti-cash', bg: '#f3e8ff', color: '#9333ea' },
                  { label: 'Avg Rating', value: `${data.stats?.avg_rating ?? 0}`, icon: 'ti-circle-check', bg: '#e0e7ff', color: '#4f46e5' },
                  { label: 'Certificates Issued', value: data.stats?.certificates_issued ?? 0, icon: 'ti-award', bg: '#ffedd5', color: '#ea580c' },
                ].map(s => (
                  <div key={s.label} className="stat-card" style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 6 }}>
                    <div style={{ background: s.bg, color: s.color, width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, fontSize: 18 }}>
                      <i className={`ti ${s.icon}`} />
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--txt-1)' }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--txt-3)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Monthly Enrollment Chart */}
              <div className="card" style={{ padding: 20, marginBottom: 25 }}>
                <h3 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 15 }}>Monthly Enrollment Trend</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={data.monthly_enrollments || []}>
                      <defs>
                        <linearGradient id="colorMonth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#309d8e" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#309d8e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="enrollments" stroke="#309d8e" fillOpacity={1} fill="url(#colorMonth)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Lists Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 25 }}>
                {/* Top Courses */}
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>Top Courses</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', height: 32, color: 'var(--txt-3)' }}>
                        <th style={{ textAlign: 'left' }}>Course</th>
                        <th style={{ textAlign: 'right' }}>Students</th>
                        <th style={{ textAlign: 'right' }}>Mentor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.top_courses || []).map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', height: 38 }}>
                          <td>{c.title}</td>
                          <td style={{ textAlign: 'right' }}>{c.students}</td>
                          <td style={{ textAlign: 'right' }}>@{c.mentor}</td>
                        </tr>
                      ))}
                      {!(data.top_courses?.length) && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 12, color: 'var(--txt-3)' }}>No data</td></tr>}
                    </tbody>
                  </table>
                </div>

                {/* Top Mentors */}
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>Top Mentors</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', height: 32, color: 'var(--txt-3)' }}>
                        <th style={{ textAlign: 'left' }}>Mentor</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.top_mentors || []).map(m => (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', height: 38 }}>
                          <td>@{m.username}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${(m.revenue || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      {!(data.top_mentors?.length) && <tr><td colSpan={2} style={{ textAlign: 'center', padding: 12, color: 'var(--txt-3)' }}>No data</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Active Students */}
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>Most Active Students</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', height: 32, color: 'var(--txt-3)' }}>
                        <th style={{ textAlign: 'left' }}>Student</th>
                        <th style={{ textAlign: 'right' }}>Completed Lessons</th>
                        <th style={{ textAlign: 'right' }}>Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.most_active_students || []).map(s => (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', height: 38 }}>
                          <td>@{s.username}</td>
                          <td style={{ textAlign: 'right' }}>{s.completed_lessons}</td>
                          <td style={{ textAlign: 'right' }}>—</td>
                        </tr>
                      ))}
                      {!(data.most_active_students?.length) && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 12, color: 'var(--txt-3)' }}>No data</td></tr>}
                    </tbody>
                  </table>
                </div>

                {/* Popular Categories */}
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>Popular Categories</h3>
                  {(data.most_popular_categories || []).length > 0 ? (
                    <div style={{ width: '100%', height: 220, display: 'flex', justifyContent: 'center' }}>
                      <ResponsiveContainer width="80%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.most_popular_categories}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="students"
                            nameKey="category"
                          >
                            {data.most_popular_categories.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--txt-3)', fontSize: 13, textAlign: 'center', padding: 20 }}>No category data available</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
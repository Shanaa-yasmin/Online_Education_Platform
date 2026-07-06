import { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';

export default function CourseAnalytics({ courses }) {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAnalytics = async (courseId) => {
    if (!courseId) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/api/courses/${courseId}/analytics/`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load course analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCourseId) {
      fetchAnalytics(selectedCourseId);
    }
  }, [selectedCourseId]);

  if (courses.length === 0) {
    return (
      <div className="mentor-empty">
        <i className="ti ti-chart-bar" />
        <h3>No courses available</h3>
        <p>Build and publish a course to view analytics.</p>
      </div>
    );
  }

  const PIE_COLORS = ['#cbd5e0', '#f59e0b', '#6366f1', '#309d8e'];

  return (
    <div className="course-analytics-wrap animate-fadeIn">
      {/* Header Selector */}
      <div className="qa-course-picker-header" style={{ marginBottom: 20 }}>
        <div>
          <h3 style={{ fontFamily: 'Fraunces,serif', fontWeight: 800, fontSize: '1.2rem', margin: 0 }}>Course Analytics &amp; Insights</h3>
          <p style={{ fontSize: 13, color: 'var(--txt-3)', marginTop: 4 }}>Monitor student engagement, watch percentages, quiz results, and sales trends.</p>
        </div>
        <div className="qa-course-picker-wrap">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-3)', marginRight: 8 }}>Select Course</label>
          <select
            className="qa-course-select"
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 4 }}
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-container" style={{ minHeight: 200 }}><div className="loading-spinner" /><p>Analyzing learning behavior…</p></div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : !data ? null : (
        <div>
          {/* Stat Cards */}
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 15, marginBottom: 25 }}>
            <div className="stat-card" style={{ padding: 15, border: '1px solid var(--border)', borderRadius: 4 }}>
              <div className="stat-card-icon" style={{ background: '#e0f2fe', color: '#0284c7', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><i className="ti ti-users" /></div>
              <div className="stat-card-num" style={{ fontSize: 22, fontWeight: 'bold' }}>{data.stats.total_students}</div>
              <div className="stat-card-lbl" style={{ fontSize: 12, color: 'var(--txt-3)' }}>Total Enrolled</div>
            </div>

            <div className="stat-card" style={{ padding: 15, border: '1px solid var(--border)', borderRadius: 4 }}>
              <div className="stat-card-icon" style={{ background: '#dcfce7', color: '#16a34a', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><i className="ti ti-circle-check" /></div>
              <div className="stat-card-num" style={{ fontSize: 22, fontWeight: 'bold' }}>{data.stats.active_students}</div>
              <div className="stat-card-lbl" style={{ fontSize: 12, color: 'var(--txt-3)' }}>Active Students</div>
            </div>

            <div className="stat-card" style={{ padding: 15, border: '1px solid var(--border)', borderRadius: 4 }}>
              <div className="stat-card-icon" style={{ background: '#fef3c7', color: '#d97706', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><i className="ti ti-activity" /></div>
              <div className="stat-card-num" style={{ fontSize: 22, fontWeight: 'bold' }}>{data.stats.avg_progress}%</div>
              <div className="stat-card-lbl" style={{ fontSize: 12, color: 'var(--txt-3)' }}>Average Progress</div>
            </div>

            <div className="stat-card" style={{ padding: 15, border: '1px solid var(--border)', borderRadius: 4 }}>
              <div className="stat-card-icon" style={{ background: '#f3e8ff', color: '#9333ea', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><i className="ti ti-award" /></div>
              <div className="stat-card-num" style={{ fontSize: 22, fontWeight: 'bold' }}>{data.stats.completion_rate}%</div>
              <div className="stat-card-lbl" style={{ fontSize: 12, color: 'var(--txt-3)' }}>Completion Rate</div>
            </div>

            <div className="stat-card" style={{ padding: 15, border: '1px solid var(--border)', borderRadius: 4 }}>
              <div className="stat-card-icon" style={{ background: '#e0e7ff', color: '#4f46e5', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><i className="ti ti-cash" /></div>
              <div className="stat-card-num" style={{ fontSize: 22, fontWeight: 'bold' }}>${data.stats.revenue.toFixed(2)}</div>
              <div className="stat-card-lbl" style={{ fontSize: 12, color: 'var(--txt-3)' }}>Revenue Generated</div>
            </div>

            <div className="stat-card" style={{ padding: 15, border: '1px solid var(--border)', borderRadius: 4 }}>
              <div className="stat-card-icon" style={{ background: '#ffedd5', color: '#ea580c', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><i className="ti ti-video" /></div>
              <div className="stat-card-num" style={{ fontSize: 22, fontWeight: 'bold' }}>{data.stats.avg_watch_percentage}%</div>
              <div className="stat-card-lbl" style={{ fontSize: 12, color: 'var(--txt-3)' }}>Average Watch %</div>
            </div>
          </div>

          {/* Charts Row 1: Enrollment Trend & Progress Distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, marginBottom: 25 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 15 }}>Enrollments Trend (Last 30 Days)</h3>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={data.charts.enrollment_trend}>
                    <defs>
                      <linearGradient id="colorEnroll" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#309d8e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#309d8e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="enrollments" stroke="#309d8e" fillOpacity={1} fill="url(#colorEnroll)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 15 }}>Syllabus Progress Distribution</h3>
              <div style={{ width: '100%', height: 260, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.progress_distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.charts.progress_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Lesson Completion */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 25 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 15 }}>Syllabus Lesson Completion Rate</h3>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={data.charts.lesson_completion}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="title" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="completed" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 15 }}>Watch / Quiz Rates</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 15 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span>Quiz Completion Rate</span>
                    <strong>{data.stats.quiz_completion_rate}%</strong>
                  </div>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#f59e0b', width: `${data.stats.quiz_completion_rate}%` }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span>Video Play Percentage</span>
                    <strong>{data.stats.avg_watch_percentage}%</strong>
                  </div>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#10b981', width: `${data.stats.avg_watch_percentage}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Viewed Tables */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>Most Viewed Syllabus Items</h3>
              <div className="table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', height: 32, color: 'var(--txt-3)' }}>
                      <th>Lesson Title</th>
                      <th style={{ textAlign: 'right' }}>Unique Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.most_viewed_lessons.map((l, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', height: 38 }}>
                        <td>{l.title}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{l.views}</td>
                      </tr>
                    ))}
                    {data.most_viewed_lessons.length === 0 && (
                      <tr><td colSpan={2} style={{ textAlign: 'center', padding: 10, color: 'var(--txt-3)' }}>No data available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>Least Viewed Syllabus Items</h3>
              <div className="table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', height: 32, color: 'var(--txt-3)' }}>
                      <th>Lesson Title</th>
                      <th style={{ textAlign: 'right' }}>Unique Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.least_viewed_lessons.map((l, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', height: 38 }}>
                        <td>{l.title}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{l.views}</td>
                      </tr>
                    ))}
                    {data.least_viewed_lessons.length === 0 && (
                      <tr><td colSpan={2} style={{ textAlign: 'center', padding: 10, color: 'var(--txt-3)' }}>No data available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

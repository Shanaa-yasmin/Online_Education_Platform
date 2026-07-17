// LandingPage.jsx — matches the uploaded homepage design exactly
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LandingPage.css';
import Footer from '../components/Footer.jsx';
import api from '../utils/api.js';

const getLevelCls = (level) => {
  if (!level) return 'cc-l-beg';
  const l = level.toLowerCase();
  if (l.includes('beg')) return 'cc-l-beg';
  if (l.includes('int')) return 'cc-l-int';
  return 'cc-l-adv';
};

const getCourseIcon = (category) => {
  if (!category) return 'ti-code';
  const c = category.toLowerCase();
  if (c.includes('web') || c.includes('code') || c.includes('dev')) return 'ti-code';
  if (c.includes('data') || c.includes('science') || c.includes('ai') || c.includes('brain')) return 'ti-brain';
  if (c.includes('design') || c.includes('art') || c.includes('ui')) return 'ti-palette';
  return 'ti-book';
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [heroSearch, setHeroSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ students: 0, mentors: 0, courses: 0, uplift: 70 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/api/landing/')
      .then(res => {
        if (active) {
          setCourses(res.data.courses || []);
          setMentors(res.data.mentors || []);
          setReviews(res.data.reviews || []);
          setStats(res.data.stats || { students: 0, mentors: 0, courses: 0, uplift: 70 });
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Error fetching landing data:", err);
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleHeroSearch = (e) => {
    e.preventDefault();
    const q = heroSearch.trim();
    if (q) {
      navigate(`/courses?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/courses');
    }
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div className="landing">

      <nav className="nav">
        <div className="logo">
          <img src="/favicon.jpeg" alt="EduPath Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
          <span className="logo-text">Edu<span>Path</span></span>
        </div>
        <div className="nav-links">
          <a className="nav-link" href="#programs">Programs</a>
          <a className="nav-link" href="#how">How it works</a>
          <a className="nav-link" href="#impact">Our Impact</a>
          <a className="nav-link" href="#mentors">Mentors</a>
        </div>
        <div className="nav-btns">
          <Link to="/login" className="btn-outline">Log In</Link>
          <Link to="/register" className="btn-fill">Sign Up</Link>
        </div>
        <button
          className="nav-burger"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileMenuOpen(o => !o)}
        >
          <i className={`ti ${mobileMenuOpen ? 'ti-x' : 'ti-menu-2'}`} />
        </button>

        <div className={`nav-mobile-panel${mobileMenuOpen ? ' open' : ''}`}>
          <a className="nav-link" href="#programs" onClick={closeMenu}>Programs</a>
          <a className="nav-link" href="#how" onClick={closeMenu}>How it works</a>
          <a className="nav-link" href="#impact" onClick={closeMenu}>Our Impact</a>
          <a className="nav-link" href="#mentors" onClick={closeMenu}>Mentors</a>
          <div className="nav-btns-mobile">
            <Link to="/login" className="btn-outline" onClick={closeMenu}>Log In</Link>
            <Link to="/register" className="btn-fill" onClick={closeMenu}>Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-eyebrow"><i className="ti ti-sparkles" /> #1 Rated EdTech Platform 2026</div>
          <h1 className="hero-h1">Bridge the gap between <em>skills and success</em></h1>
          <p className="hero-sub">Humans where it matters, technology where it scales. We help learners grow and turn learning outcomes into measurable career impact.</p>
          <form className="hero-search-form" onSubmit={handleHeroSearch}>
            <i className="ti ti-search" />
            <input
              type="text"
              placeholder="Search for courses, topics, or mentors..."
              value={heroSearch}
              onChange={e => setHeroSearch(e.target.value)}
            />
            <button type="submit" className="cta-primary">Search</button>
          </form>
          <div className="hero-cta">
            <button className="cta-primary" onClick={() => navigate('/register')}><i className="ti ti-compass" /> Explore Programs</button>
            <button className="cta-secondary" onClick={() => navigate('/register')}>Become a Partner</button>
          </div>
          <div className="hero-trust">
            <div className="trust-avatars">
              <div className="t-av av1">AK</div>
              <div className="t-av av2">SR</div>
              <div className="t-av av3">MJ</div>
              <div className="t-av av4">PR</div>
            </div>
            <p className="trust-text"><strong>{stats.students}+ learners</strong> already enrolled<br />and growing every week</p>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-img-wrap">
            <div className="hero-main-visual">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                  <div style={{ width: 100, height: 100, background: 'rgba(48,157,142,0.15)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="ti ti-user-circle" style={{ fontSize: 48, color: '#309D8E' }} />
                  </div>
                  <div className="visual-laptop">
                    <div className="visual-screen">
                      <div className="vs-line w85 accent" /><div className="vs-line w70" />
                      <div className="vs-line w50" /><div className="vs-line w85" /><div className="vs-line w40" />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[[`${stats.avg_progress || 94}%`, 'Completion'], [`${stats.courses || 10}+`, 'Courses'], [`${stats.avg_rating || 4.9}★`, 'Rating']].map(([n, l]) => (
                    <div key={l} style={{ background: 'rgba(48,157,142,0.1)', borderRadius: 10, padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Fraunces,serif', fontSize: '1.2rem', fontWeight: 800, color: '#309D8E' }}>{n}</div>
                      <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="hero-img-card">
              <div className="hic-icon"><i className="ti ti-award" /></div>
              <div><div className="hic-num">{stats.students || 10}+</div><div className="hic-lbl">Active students</div></div>
            </div>
            <div className="hero-img-card2">
              <div className="hic2-num">{stats.uplift || 70}%</div>
              <div className="hic2-lbl">Career uplift</div>
            </div>
          </div>
        </div>
      </section>

      {/* LOGOS */}
      <div className="logos-strip">
        <p className="logos-label">Trusted by learners from leading companies</p>
        <div className="logos-row">
          {[['ti-brand-google', 'Google'], ['ti-brand-amazon', 'Amazon'], ['ti-brand-microsoft', 'Microsoft'], ['ti-brand-meta', 'Meta'], ['ti-brand-apple', 'Apple'], ['ti-brand-netflix', 'Netflix']].map(([icon, name]) => (
            <div key={name} className="logo-item"><i className={`ti ${icon}`} /><span>{name}</span></div>
          ))}
        </div>
      </div>

      {/* STATS */}
      <section className="stats-section">
        <div className="stats-grid">
          {[
            ['Learners enrolled', `${stats.students || 0}`, 'Registered students'],
            ['Expert mentors', `${stats.mentors || 0}`, 'Approved active mentors'],
            ['Courses available', `${stats.courses || 0}`, 'Published study programs'],
            ['Career uplift rate', `${stats.uplift || 70}%`, 'Within 1 month'],
          ].map(([eyebrow, num, desc]) => (
            <div key={eyebrow} className="stat-box">
              <p className="sb-eyebrow">{eyebrow}</p>
              <p className="sb-num">{num}</p>
              <p className="sb-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section" id="how">
        <div className="section-header">
          <p className="sec-eyebrow">How it works</p>
          <h2 className="sec-title">Three steps to your next career move</h2>
          <p className="sec-sub">A structured path from where you are to where you want to be.</p>
        </div>
        <div className="steps-grid">
          {[
            ['ti-search', 'Discover', 'Browse 320+ expert-led courses across tech, design, data, and business.'],
            ['ti-users', 'Learn with a mentor', 'Get paired with an industry professional who guides your journey.'],
            ['ti-rocket', 'Land the role', 'Apply your new skills and showcase verified certificates to employers.'],
          ].map(([icon, title, desc], i) => (
            <div key={title} className="step-card">
              <span className="step-num">0{i + 1}</span>
              <div className="step-icon"><i className={`ti ${icon}`} /></div>
              <h3 className="step-title">{title}</h3>
              <p className="step-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COURSES */}
      <section className="courses-section" id="programs">
        <div className="courses-header">
          <div>
            <p className="sec-eyebrow">Featured courses</p>
            <h2 className="sec-title">Start learning today</h2>
          </div>
          <Link to="/register" className="view-all-link">View all courses <i className="ti ti-arrow-right" /></Link>
        </div>
        <div className="courses-grid">
          {(courses.length > 0 ? courses : [
            { id: 'm1', thumb: 'cc-t1', icon: 'ti-code', level: 'Beginner', category: 'Web Development', title: 'Full-Stack React & Node.js Bootcamp', duration_hours: 42, enrollment_count: 2400, price: 4999 },
            { id: 'm2', thumb: 'cc-t2', icon: 'ti-brain', level: 'Intermediate', category: 'Data Science', title: 'Machine Learning with Python — Applied', duration_hours: 38, enrollment_count: 1800, price: 5499 },
            { id: 'm3', thumb: 'cc-t3', icon: 'ti-palette', level: 'Beginner', category: 'UI/UX Design', title: 'Product Design Fundamentals + Figma', duration_hours: 24, enrollment_count: 3100, price: 0 },
          ]).map((c, idx) => {
            const levelCls = getLevelCls(c.level);
            const icon = c.icon || getCourseIcon(c.category);
            const formattedPrice = c.price === 0 || c.price === 'Free' ? 'Free' : `₹${parseFloat(c.price).toLocaleString()}`;

            return (
              <div key={c.id || idx} className="course-card" onClick={() => navigate('/register')}>
                <div className={`cc-thumb ${c.thumb || `cc-t${(idx % 3) + 1}`}`}>
                  {c.thumbnail ? (
                    <img src={c.thumbnail} alt={c.title} />
                  ) : (
                    <i className={`ti ${icon} cc-thumb-icon`} />
                  )}
                  <span className={`cc-level ${levelCls}`}>{c.level}</span>
                </div>
                <div className="cc-body">
                  <p className="cc-cat">{c.category}</p>
                  <h3 className="cc-title">{c.title}</h3>
                  <div className="cc-meta">
                    <span><i className="ti ti-clock" />{c.duration_hours}h</span>
                    <span><i className="ti ti-users" />{c.enrollment_count >= 1000 ? `${(c.enrollment_count / 1000).toFixed(1)}k` : c.enrollment_count} students</span>
                  </div>
                </div>
                <div className="cc-footer">
                  <span className={`cc-price${formattedPrice === 'Free' ? ' free' : ''}`}>{formattedPrice}</span>
                  <button className="cc-enroll" onClick={() => navigate('/register')}>Enroll →</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* IMPACT */}
      <section className="impact-section" id="impact">
        <div className="impact-inner">
          <div className="impact-left">
            <p className="sec-eyebrow">Why Choose EduPath</p>
            <h2 className="sec-title" style={{ fontSize: '2.4rem' }}>Why Choose EduPath</h2>
            <p className="sec-sub">A modern online learning platform designed to connect students with mentors through structured courses, progress tracking, interactive discussions, and seamless learning resources.</p>
            <button className="impact-cta" onClick={() => navigate('/register')}><i className="ti ti-rocket" /> Get Started →</button>
          </div>
          <div className="impact-right">
            {[
              { icon: 'ti-trending-up', title: 'Progress Tracking', desc: 'Monitor course completion and learning progress.' },
              { icon: 'ti-messages', title: 'Interactive Q&A', desc: 'Ask questions and receive mentor guidance.' },
              { icon: 'ti-award', title: 'Course Certificates', desc: 'Earn certificates after completing courses.' },
              { icon: 'ti-bell', title: 'Real-time Notifications', desc: 'Stay updated with announcements and course activities.' },
            ].map(item => (
              <div key={item.title} className="impact-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`ti ${item.icon}`} style={{ color: '#fff', fontSize: '20px' }} />
                  </div>
                  <h4 style={{ color: '#fff', fontSize: '15.5px', fontWeight: 600, margin: 0 }}>{item.title}</h4>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="test-section">
        <div className="section-header">
          <p className="sec-eyebrow">Learner stories</p>
          <h2 className="sec-title">What our students say</h2>
        </div>
        <div className="test-grid">
          {(reviews.length > 0 ? reviews : [
            { id: 't1', quote: "Landed a 42% salary hike after completing the React bootcamp. The mentorship made the difference — my mentor reviewed my code every week.", name: "Anjali Kumar", role: "Frontend Dev · Flipkart", initials: "AK", cls: "tp1", rating: 5 },
            { id: 't2', quote: "I switched from marketing to data analytics in 4 months. The structured curriculum and live projects gave me the confidence to make the leap.", name: "Suresh Rao", role: "Data Analyst · Infosys", initials: "SR", cls: "tp2", rating: 5 },
            { id: 't3', quote: "The ML course gave me skills I use every day at work. My mentor helped me navigate a complete career pivot — worth every rupee.", name: "Mohammed Jaleel", role: "Data Analyst · TCS", initials: "MJ", cls: "tp3", rating: 5 },
          ]).map((t, idx) => {
            const cls = t.cls || `tp${(idx % 3) + 1}`;
            return (
              <div key={t.id || idx} className="test-card">
                <div className="test-stars">
                  {[...Array(t.rating || 5)].map((_, i) => (
                    <i key={i} className="ti ti-star-filled" />
                  ))}
                </div>
                <p className="test-quote">"{t.quote}"</p>
                <div className="test-person">
                  <div className={`test-av ${cls}`}>
                    {t.avatar ? (
                      <img src={t.avatar} alt={t.name} />
                    ) : (
                      t.initials
                    )}
                  </div>
                  <div>
                    <div className="test-pname">{t.name}</div>
                    <div className="test-prole">{t.role}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* MENTORS */}
      <section className="mentors-section" id="mentors">
        <div className="section-header">
          <p className="sec-eyebrow">Expert mentors</p>
          <h2 className="sec-title">Learn from the best</h2>
          <p className="sec-sub">Our mentors are active industry professionals — not just teachers.</p>
        </div>
        <div className="mentors-grid">
          {(mentors.length > 0 ? mentors : [
            { id: 'me1', name: 'Rahul Kapoor', title: 'Senior Engineer · Amazon', skills: ['React', 'Node.js', 'AWS'], cls: 'ma1' },
            { id: 'me2', name: 'Priya Venkat', title: 'Data Scientist · Microsoft', skills: ['Python', 'ML', 'TensorFlow'], cls: 'ma2' },
            { id: 'me3', name: 'Dev Mehta', title: 'Product Lead · Razorpay', skills: ['Strategy', 'Figma', 'Growth'], cls: 'ma3' },
            { id: 'me4', name: 'Nadia Ahmed', title: 'UX Director · Swiggy', skills: ['UX Design', 'Research', 'Figma'], cls: 'ma4' },
          ]).map((m, idx) => {
            const initials = m.name ? m.name.split(/[\s_]+/).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'M';
            const cls = m.cls || `ma${(idx % 4) + 1}`;

            return (
              <div key={m.id || idx} className="mentor-card">
                <div className={`mentor-av ${cls}`}>
                  {m.avatar ? (
                    <img src={m.avatar} alt={m.name} />
                  ) : (
                    initials
                  )}
                </div>
                <div className="mentor-name">{m.name}</div>
                <div className="mentor-role">{m.title}</div>
                {m.skills && m.skills.length > 0 && (
                  <div className="mentor-skills">
                    {m.skills.slice(0, 3).map(s => (
                      <span key={s} className="skill-pill">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="cta-section">
        <div className="cta-inner">
          <div className="cta-left">
            <h2 className="cta-h">Ready to build skills<br />that get you hired?</h2>
            <p className="cta-p">Join 10+ who chose EduPath to accelerate their careers. Start for free — no credit card required.</p>
          </div>
          <div className="cta-right">
            <button className="cta-btn1" onClick={() => navigate('/register')}>Start Learning Free →</button>
            <button className="cta-btn2" onClick={() => navigate('/register')}>Talk to a Mentor</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
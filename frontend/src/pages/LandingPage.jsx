// LandingPage.jsx — matches the uploaded homepage design exactly
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LandingPage.css';
import Footer from '../components/Footer.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const [heroSearch, setHeroSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          <div className="hero-eyebrow"><i className="ti ti-sparkles" /> #1 Rated EdTech Platform 2025</div>
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
            <p className="trust-text"><strong>12,000+ learners</strong> already enrolled<br />and growing every week</p>
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
                  {[['94%', 'Completion'], ['320+', 'Courses'], ['4.9★', 'Rating']].map(([n, l]) => (
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
              <div><div className="hic-num">12k+</div><div className="hic-lbl">Active students</div></div>
            </div>
            <div className="hero-img-card2">
              <div className="hic2-num">70%</div>
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
            ['Learners enrolled', '12,000+', 'Growing every month'],
            ['Expert mentors', '840+', 'Active industry pros'],
            ['Courses available', '320+', 'Across 24 domains'],
            ['Career uplift rate', '70%', 'Within 6 months'],
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
          {[
            { thumb: 'cc-t1', icon: 'ti-code', level: 'Beginner', levelCls: 'cc-l-beg', cat: 'Web Development', title: 'Full-Stack React & Node.js Bootcamp', dur: '42h', students: '2.4k', price: '₹4,999' },
            { thumb: 'cc-t2', icon: 'ti-brain', level: 'Intermediate', levelCls: 'cc-l-int', cat: 'Data Science', title: 'Machine Learning with Python — Applied', dur: '38h', students: '1.8k', price: '₹5,499' },
            { thumb: 'cc-t3', icon: 'ti-palette', level: 'Beginner', levelCls: 'cc-l-beg', cat: 'UI/UX Design', title: 'Product Design Fundamentals + Figma', dur: '24h', students: '3.1k', price: 'Free' },
          ].map((c) => (
            <div key={c.title} className="course-card" onClick={() => navigate('/register')}>
              <div className={`cc-thumb ${c.thumb}`}>
                <i className={`ti ${c.icon} cc-thumb-icon`} />
                <span className={`cc-level ${c.levelCls}`}>{c.level}</span>
              </div>
              <div className="cc-body">
                <p className="cc-cat">{c.cat}</p>
                <h3 className="cc-title">{c.title}</h3>
                <div className="cc-meta">
                  <span><i className="ti ti-clock" />{c.dur}</span>
                  <span><i className="ti ti-users" />{c.students} students</span>
                </div>
              </div>
              <div className="cc-footer">
                <span className={`cc-price${c.price === 'Free' ? ' free' : ''}`}>{c.price}</span>
                <button className="cc-enroll" onClick={() => navigate('/register')}>Enroll →</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* IMPACT */}
      <section className="impact-section" id="impact">
        <div className="impact-inner">
          <div className="impact-left">
            <p className="sec-eyebrow">Our impact</p>
            <h2 className="sec-title">Real numbers. Real outcomes.</h2>
            <p className="sec-sub">We track every metric that matters — completion rates, placement rates, salary growth. Because outcomes are the only product.</p>
            <button className="impact-cta" onClick={() => navigate('/register')}><i className="ti ti-chart-bar" /> See full report →</button>
          </div>
          <div className="impact-right">
            {[
              { num: '94%', lbl: 'Course completion rate', fill: '94%' },
              { num: '₹8.2L', lbl: 'Average post-course salary', fill: '82%' },
              { num: '3.2×', lbl: 'ROI within 12 months', fill: '76%' },
              { num: '4.9★', lbl: 'Learner satisfaction score', fill: '98%' },
            ].map(c => (
              <div key={c.lbl} className="impact-card">
                <div className="ic-num">{c.num}</div>
                <div className="ic-label">{c.lbl}</div>
                <div className="ic-bar"><div className="ic-bar-fill" style={{ width: c.fill }} /></div>
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
          {[
            { quote: "Landed a 42% salary hike after completing the React bootcamp. The mentorship made the difference — my mentor reviewed my code every week.", name: "Anjali Kumar", role: "Frontend Dev · Flipkart", av: "AK", cls: "tp1" },
            { quote: "I switched from marketing to data analytics in 4 months. The structured curriculum and live projects gave me the confidence to make the leap.", name: "Suresh Rao", role: "Data Analyst · Infosys", av: "SR", cls: "tp2" },
            { quote: "The ML course gave me skills I use every day at work. My mentor helped me navigate a complete career pivot — worth every rupee.", name: "Mohammed Jaleel", role: "Data Analyst · TCS", av: "MJ", cls: "tp3" },
          ].map(t => (
            <div key={t.name} className="test-card">
              <div className="test-stars">{[...Array(5)].map((_, i) => <i key={i} className="ti ti-star-filled" />)}</div>
              <p className="test-quote">"{t.quote}"</p>
              <div className="test-person">
                <div className={`test-av ${t.cls}`}>{t.av}</div>
                <div><div className="test-pname">{t.name}</div><div className="test-prole">{t.role}</div></div>
              </div>
            </div>
          ))}
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
          {[
            { init: 'RK', name: 'Rahul Kapoor', role: 'Senior Engineer · Amazon', skills: ['React', 'Node.js', 'AWS'], cls: 'ma1' },
            { init: 'PV', name: 'Priya Venkat', role: 'Data Scientist · Microsoft', skills: ['Python', 'ML', 'TensorFlow'], cls: 'ma2' },
            { init: 'DM', name: 'Dev Mehta', role: 'Product Lead · Razorpay', skills: ['Strategy', 'Figma', 'Growth'], cls: 'ma3' },
            { init: 'NA', name: 'Nadia Ahmed', role: 'UX Director · Swiggy', skills: ['UX Design', 'Research', 'Figma'], cls: 'ma4' },
          ].map(m => (
            <div key={m.name} className="mentor-card">
              <div className={`mentor-av ${m.cls}`}>{m.init}</div>
              <div className="mentor-name">{m.name}</div>
              <div className="mentor-role">{m.role}</div>
              <div className="mentor-skills">{m.skills.map(s => <span key={s} className="skill-pill">{s}</span>)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="cta-section">
        <div className="cta-inner">
          <div className="cta-left">
            <h2 className="cta-h">Ready to build skills<br />that get you hired?</h2>
            <p className="cta-p">Join 12,000+ learners who chose EduPath to accelerate their careers. Start for free — no credit card required.</p>
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
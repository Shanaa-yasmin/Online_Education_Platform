import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import AuthLeftPanel from '../components/AuthLeftPanel.jsx';
import './AuthPages.css';

const CATEGORIES = [
  "Development", "Business", "Finance", "Design", 
  "Marketing", "IT & Software", "Photography", "Music"
];

const EDUCATION_LEVELS = [
  "High School", "Associate's Degree", "Bachelor's Degree", 
  "Master's Degree", "PhD", "Self-Taught / Other"
];

export default function CompleteProfilePage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  // Student fields
  const [dob, setDob] = useState('');
  const [edu, setEdu] = useState('');
  const [areas, setAreas] = useState([]);
  
  // Mentor fields
  const [title, setTitle] = useState('');
  const [years, setYears] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  
  // Mentor resume file
  const [resumeFile, setResumeFile] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!user) return null; // Let ProtectedRoute handle this

  const isStudent = user.role === 'STUDENT';
  const isMentor = user.role === 'MENTOR';

  const toggleArea = (cat) => {
    setAreas(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formData = new FormData();
    
    if (isStudent) {
      if (dob) formData.append('date_of_birth', dob);
      if (edu) formData.append('education_level', edu);
      formData.append('areas_of_interest', JSON.stringify(areas));
    } else if (isMentor) {
      if (!title.trim() || !years.trim() || !bio.trim()) {
        setError('Title, years of experience, and bio are required.');
        setLoading(false);
        return;
      }
      formData.append('title', title);
      formData.append('years_of_experience', years);
      formData.append('areas_of_expertise', JSON.stringify(areas));
      formData.append('bio', bio);
      formData.append('website', website);
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }
    }

    try {
      await api.patch('/api/auth/complete-profile/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await refreshProfile();
      // Redirect based on role
      navigate(isMentor ? '/my-courses' : '/dashboard');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthLeftPanel 
        eyebrow="Almost there"
        title={<>Complete your<br /><em>profile.</em></>}
        description={isStudent 
          ? "Tell us a bit about yourself so we can recommend the best courses for your journey."
          : "Set up your mentor profile to showcase your expertise to potential students."}
      />

      {/* Right panel */}
      <div className="auth-panel-right">
        <div className="auth-form-box wide">
          <div className="auth-mobile-header">
            <div className="auth-mobile-logo-circle">
              <img src="/favicon.jpeg" alt="EduPath Logo" className="auth-mobile-logo" />
            </div>
            <span className="auth-mobile-brand-name">EduPath</span>
          </div>

          <div className="auth-form-header">
            <h2 className="auth-form-title">
              {isStudent ? "Student Profile" : "Mentor Application"}
            </h2>
            <p className="auth-form-sub">
              {isStudent ? "Personalize your learning experience" : "Highlight your professional experience"}
            </p>
          </div>

          {error && <div className="alert alert-error" style={{marginBottom:16}}>{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            
            {/* ── STUDENT FIELDS ── */}
            {isStudent && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Date of Birth (Optional)</label>
                    <div className="input-wrap">
                      <i className="ti ti-calendar input-icon" />
                      <input className="form-input" type="date" value={dob} onChange={e => setDob(e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Education Level</label>
                    <div className="input-wrap">
                      <i className="ti ti-school input-icon" />
                      <select className="form-input" value={edu} onChange={e => setEdu(e.target.value)} style={{paddingLeft: '40px', appearance: 'none'}}>
                        <option value="">Select Level...</option>
                        {EDUCATION_LEVELS.map(lvl => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="form-group" style={{marginTop: 12}}>
                  <label className="form-label">Areas of Interest</label>
                  <p style={{fontSize: 12, color: 'var(--txt-3)', marginBottom: 8}}>Select the topics you want to learn about.</p>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
                    {CATEGORIES.map(cat => {
                      const active = areas.includes(cat);
                      return (
                        <button key={cat} type="button" onClick={() => toggleArea(cat)}
                          style={{
                            padding: '6px 12px', borderRadius: '20px', fontSize: 13, cursor: 'pointer',
                            border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                            background: active ? 'var(--brand-light)' : 'transparent',
                            color: active ? 'var(--brand)' : 'var(--txt-2)',
                            transition: 'all 0.2s'
                          }}>
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── MENTOR FIELDS ── */}
            {isMentor && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Professional Title *</label>
                    <div className="input-wrap">
                      <i className="ti ti-briefcase input-icon" />
                      <input className="form-input" type="text" placeholder="e.g. Senior Software Engineer" 
                        value={title} onChange={e => setTitle(e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Years of Experience *</label>
                    <div className="input-wrap">
                      <i className="ti ti-clock input-icon" />
                      <input className="form-input" type="number" min="0" placeholder="e.g. 5" 
                        value={years} onChange={e => setYears(e.target.value)} required />
                    </div>
                  </div>
                </div>
                
                <div className="form-group" style={{marginTop: 12}}>
                  <label className="form-label">Areas of Expertise</label>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8}}>
                    {CATEGORIES.map(cat => {
                      const active = areas.includes(cat);
                      return (
                        <button key={cat} type="button" onClick={() => toggleArea(cat)}
                          style={{
                            padding: '6px 12px', borderRadius: '20px', fontSize: 13, cursor: 'pointer',
                            border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                            background: active ? 'var(--brand-light)' : 'transparent',
                            color: active ? 'var(--brand)' : 'var(--txt-2)',
                            transition: 'all 0.2s'
                          }}>
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group" style={{marginTop: 16}}>
                  <label className="form-label">Short Bio *</label>
                  <textarea className="form-input" placeholder="Tell us about your background and teaching style..."
                    rows="3" value={bio} onChange={e => setBio(e.target.value)} required
                    style={{resize: 'none', padding: '12px'}} />
                </div>
                
                <div className="form-group" style={{marginTop: 16}}>
                  <label className="form-label">LinkedIn / Portfolio URL (Optional)</label>
                  <div className="input-wrap">
                    <i className="ti ti-link input-icon" />
                    <input className="form-input" type="url" placeholder="https://linkedin.com/in/..." 
                      value={website} onChange={e => setWebsite(e.target.value)} />
                  </div>
                </div>

                <div className="form-group" style={{marginTop: 16}}>
                  <label className="form-label">Resume / Certification (Optional)</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--border)', padding: '20px', borderRadius: '8px',
                      textAlign: 'center', cursor: 'pointer', background: 'var(--surface)',
                      transition: 'border-color 0.2s, background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--brand)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <i className="ti ti-upload" style={{fontSize: 24, color: 'var(--txt-3)', marginBottom: 8, display: 'block'}} />
                    <span style={{fontSize: 14, color: 'var(--txt-2)'}}>
                      {resumeFile ? resumeFile.name : "Click to upload a PDF or image"}
                    </span>
                    <input 
                      ref={fileInputRef} type="file" hidden 
                      accept=".pdf,image/*" onChange={handleFileChange} 
                    />
                  </div>
                </div>
              </>
            )}

            <div style={{marginTop: 32}}>
              <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? <><span className="loading-spinner loading-spinner-sm" /> Saving…</> : 'Complete Profile'}
              </button>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
}

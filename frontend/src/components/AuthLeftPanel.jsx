import React from 'react';
import './AuthLeftPanel.css';

export default function AuthLeftPanel({ 
  eyebrow = "Join EduPath", 
  title = <>Your career,<br /><em>accelerated.</em></>,
  description = "Access 320+ premium courses, connect with top industry mentors, and build skills that employers actually want."
}) {
  return (
    <div className="auth-panel-left">
      <div className="auth-brand">
        <img src="/favicon.jpeg" alt="EduPath Logo" style={{ width: 36, height: 36, borderRadius: 8 }} />
        <span className="auth-brand-name">EduPath</span>
      </div>
      
      <div className="auth-hero">
        <p className="auth-hero-eyebrow">{eyebrow}</p>
        <h1 className="auth-hero-h">{title}</h1>
        <p className="auth-hero-p">{description}</p>
        
        {/* New Feature Badges */}
        <div className="auth-features">
          <div className="auth-feature-badge">
            <i className="ti ti-certificate" /> <span>Verified Certificates</span>
          </div>
          <div className="auth-feature-badge">
            <i className="ti ti-users" /> <span>1-on-1 Mentorship</span>
          </div>
          <div className="auth-feature-badge">
            <i className="ti ti-briefcase" /> <span>Career Support</span>
          </div>
        </div>
      </div>

      {/* Floating Testimonial Card */}
      <div className="auth-testimonial">
        <div className="auth-testimonial-quote">
          "EduPath completely transformed my career trajectory. The mentorship I received was invaluable, landing me a role at a top tech company within 3 months."
        </div>
        <div className="auth-testimonial-author">
          <img src="https://ui-avatars.com/api/?name=Sarah+Chen&background=fff&color=309d8e&rounded=true&bold=true" alt="Sarah Chen" className="auth-testimonial-avatar" />
          <div>
            <div className="auth-testimonial-name">Sarah Chen</div>
            <div className="auth-testimonial-title">Frontend Engineer @ TechCorp</div>
          </div>
        </div>
        <div className="auth-testimonial-stars">
          <i className="ti ti-star-filled" />
          <i className="ti ti-star-filled" />
          <i className="ti ti-star-filled" />
          <i className="ti ti-star-filled" />
          <i className="ti ti-star-filled" />
        </div>
      </div>

      <div className="auth-stats-container">
        <div className="auth-stats">
          <div><span className="auth-stat-val">320+</span><span className="auth-stat-lbl">Courses</span></div>
          <div><span className="auth-stat-val">4.9★</span><span className="auth-stat-lbl">Rating</span></div>
          <div><span className="auth-stat-val">50k+</span><span className="auth-stat-lbl">Students</span></div>
        </div>
        
        {/* Trusted By Section */}
        <div className="auth-trusted">
          <span className="auth-trusted-lbl">Alumni at</span>
          <div className="auth-trusted-logos">
            <i className="ti ti-brand-google" />
            <i className="ti ti-brand-amazon" />
            <i className="ti ti-brand-meta" />
            <i className="ti ti-brand-netflix" />
          </div>
        </div>
      </div>
      
    </div>
  );
}

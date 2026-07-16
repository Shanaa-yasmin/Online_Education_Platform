import React from 'react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div>
          <div className="f-logo">
            <div className="f-logo-mark">
              <i className="ti ti-trending-up" />
            </div>
            <span className="f-logo-text">Edu<span>Path</span></span>
          </div>
          <p className="f-brand-desc">Empowering learners with skills that drive real careers. Expert mentors, structured paths, measurable outcomes.</p>
          <div className="socials">
            {['ti-brand-instagram', 'ti-brand-linkedin', 'ti-brand-twitter', 'ti-brand-facebook', 'ti-brand-youtube'].map(ic => (
              <div key={ic} className="sc-btn"><i className={`ti ${ic}`} /></div>
            ))}
          </div>
          <div className="f-cert">
            <div className="cert-pill"><i className="ti ti-shield-check" /> ISO 27001 Certified</div>
            <div className="cert-pill"><i className="ti ti-certificate" /> SOC 2 Type II Compliant</div>
            <div className="cert-pill"><i className="ti ti-lock" /> GDPR Ready</div>
          </div>
        </div>
        <div>
          <p className="f-col-h">Platform</p>
          <div className="f-links">
            {['Explore Courses', 'Become a Mentor', 'Partnerships', 'Our Impact', 'Enterprise'].map(l => (
              <a key={l} className="f-link" href="#">{l}</a>
            ))}
          </div>
        </div>
        <div>
          <p className="f-col-h">Company</p>
          <div className="f-links">
            {['About Us', 'Careers', 'Blog', 'Press', 'Contact'].map(l => (
              <a key={l} className="f-link" href="#">{l}</a>
            ))}
          </div>
        </div>
        <div>
          <p className="f-col-h">Support</p>
          <div className="f-links">
            {['Help Center', 'Student Support', 'Refund Policy', 'Privacy Policy', 'Terms of Use'].map(l => (
              <a key={l} className="f-link" href="#">{l}</a>
            ))}
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p className="f-copy">© 2026 EduPath Inc. All rights reserved.</p>
        <div className="f-legal">
          {['Privacy', 'Terms', 'Cookies', 'Sitemap'].map(l => (
            <a key={l} className="f-leg-link" href="#">{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

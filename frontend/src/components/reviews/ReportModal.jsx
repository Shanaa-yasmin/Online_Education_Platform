import { useState } from 'react';
import api from '../../utils/api.js';

export default function ReportModal({ review, onClose, onReportSuccess }) {
  const [reason, setReason] = useState('SPAM');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await api.post(`/api/reviews/${review.id}/report/`, {
        reason,
        details
      });
      onReportSuccess(review.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <h3>📢 Report Review</h3>
          <button className="report-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="report-modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            
            <p className="report-intro-text">
              You are reporting the review written by <strong>{review.student?.username}</strong>:
            </p>
            <blockquote className="report-quote">
              "{review.comment}"
            </blockquote>

            <div className="report-form-group">
              <label htmlFor="report-reason">Reason for Reporting</label>
              <select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              >
                <option value="SPAM">Spam</option>
                <option value="HARASSMENT">Harassment</option>
                <option value="OFFENSIVE_LANGUAGE">Offensive Language</option>
                <option value="FAKE_REVIEW">Fake Review</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="report-form-group">
              <label htmlFor="report-details">
                Additional Details {reason === 'OTHER' ? '(Required)' : '(Optional)'}
              </label>
              <textarea
                id="report-details"
                placeholder="Please describe why this review violates policies..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                required={reason === 'OTHER'}
                rows={3}
              />
            </div>
          </div>

          <div className="report-modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary report-cancel-btn" 
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary report-submit-btn" 
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

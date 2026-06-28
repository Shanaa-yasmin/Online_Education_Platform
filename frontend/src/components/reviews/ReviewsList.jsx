import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api.js';
import RatingDistribution from './RatingDistribution';
import ReviewCard from './ReviewCard';
import ReviewForm from './ReviewForm';
import ReviewSkeleton from './ReviewSkeleton';
import './Reviews.css';

/**
 * ReviewsList — Orchestrator for the entire reviews section.
 *
 * Props:
 *   courseId    – the course ID
 *   isEnrolled – whether the current user is enrolled
 *   user       – current user object (from AuthContext)
 */
export default function ReviewsList({ courseId, isEnrolled, user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingReview, setEditingReview] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const isStudent = user?.role === 'STUDENT';
  const isAdmin = user?.role === 'ADMIN' || user?.is_staff;

  const fetchReviews = useCallback(async () => {
    try {
      const res = await api.get(`/api/courses/${courseId}/reviews/`);
      setData(res.data);
    } catch {
      // silently fail — reviews are non-critical
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleSuccess = () => {
    setEditingReview(null);
    setShowForm(false);
    setLoading(true);
    fetchReviews();
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    setDeleting(reviewId);
    try {
      await api.delete(`/api/reviews/${reviewId}/`);
      setLoading(true);
      fetchReviews();
    } catch {
      alert('Failed to delete review.');
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (review) => {
    setEditingReview(review);
    setShowForm(true);
    // Scroll the form into view
    setTimeout(() => {
      document.querySelector('.review-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingReview(null);
    setShowForm(false);
  };

  // Determine if the current user already has a review
  const userReview = data?.user_review;
  const canReview = isStudent && isEnrolled && !userReview && !editingReview;

  return (
    <section className="reviews-section" id="reviews">
      <div className="reviews-section__header">
        <h3 className="reviews-section__title">Student Reviews</h3>
        {canReview && !showForm && (
          <button
            className="btn btn-primary reviews-section__write-btn"
            onClick={() => setShowForm(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
            Write a Review
          </button>
        )}
      </div>

      {loading ? (
        <ReviewSkeleton count={3} />
      ) : (
        <>
          {/* ── Distribution ─────────────────────────────────────── */}
          {data && data.total_reviews > 0 && (
            <RatingDistribution
              average={data.average_rating}
              total={data.total_reviews}
              distribution={data.distribution}
            />
          )}

          {/* ── Review Form ──────────────────────────────────────── */}
          {showForm && isStudent && isEnrolled && (
            <ReviewForm
              courseId={courseId}
              existingReview={editingReview || userReview}
              onSuccess={handleSuccess}
              onCancel={editingReview ? handleCancelEdit : () => setShowForm(false)}
            />
          )}

          {/* ── Already reviewed indicator ───────────────────────── */}
          {userReview && !editingReview && !showForm && isStudent && (
            <div className="reviews-section__your-review-note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              You've already reviewed this course. You can edit or delete it below.
            </div>
          )}

          {/* ── Review List ──────────────────────────────────────── */}
          {data?.results?.length > 0 ? (
            <div className="reviews-list">
              {data.results.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  isOwner={review.is_owner}
                  isAdmin={isAdmin}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="reviews-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="reviews-empty__icon">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="reviews-empty__text">No reviews yet.</p>
              <p className="reviews-empty__sub">
                {isStudent && isEnrolled
                  ? 'Be the first to share your experience!'
                  : isStudent
                    ? 'Enroll in this course to leave a review.'
                    : 'Reviews will appear here once students start sharing feedback.'}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

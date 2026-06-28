import { useState, useEffect } from 'react';
import RatingStars from './RatingStars';

/**
 * ReviewForm — Submit or edit a review.
 *
 * Props:
 *   courseId        – the course being reviewed
 *   existingReview  – prefill data when editing (null = create mode)
 *   onSuccess       – callback() after successful submit
 *   onCancel        – callback() to dismiss form (edit mode)
 */

const MAX_CHARS = 1000;

export default function ReviewForm({ courseId, existingReview, onSuccess, onCancel }) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!existingReview;
  const charsLeft = MAX_CHARS - comment.length;

  // Re-sync if existingReview changes (e.g. switching from create → edit)
  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setComment(existingReview.comment || '');
    } else {
      setRating(0);
      setComment('');
    }
  }, [existingReview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (rating === 0) {
      setError('Please select a star rating.');
      return;
    }

    setSubmitting(true);
    try {
      const { default: api } = await import('../../utils/api.js');

      if (isEdit) {
        // PATCH via ReviewViewSet
        await api.patch(`/api/reviews/${existingReview.id}/`, { rating, comment });
      } else {
        // POST to create-or-update action on CourseViewSet
        await api.post(`/api/courses/${courseId}/reviews/`, { rating, comment });
      }

      onSuccess?.();
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        'Something went wrong. Please try again.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <h4 className="review-form__title">
        {isEdit ? 'Update Your Review' : 'Write a Review'}
      </h4>

      {/* Star selector */}
      <div className="review-form__rating-row">
        <span className="review-form__rating-label">Your Rating</span>
        <RatingStars value={rating} onChange={setRating} interactive size="lg" />
        {rating > 0 && (
          <span className="review-form__rating-text">
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
          </span>
        )}
      </div>

      {/* Comment textarea */}
      <div className="review-form__textarea-wrapper">
        <textarea
          className="review-form__textarea"
          placeholder="Share your experience with this course…"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX_CHARS))}
          rows={4}
          maxLength={MAX_CHARS}
        />
        <span className={`review-form__char-count${charsLeft < 50 ? ' warning' : ''}`}>
          {charsLeft} characters remaining
        </span>
      </div>

      {error && <p className="review-form__error">{error}</p>}

      <div className="review-form__actions">
        {isEdit && (
          <button
            type="button"
            className="btn btn-secondary review-form__cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary review-form__submit"
          disabled={submitting || rating === 0}
        >
          {submitting
            ? (isEdit ? 'Updating…' : 'Submitting…')
            : (isEdit ? 'Update Review' : 'Submit Review')}
        </button>
      </div>
    </form>
  );
}

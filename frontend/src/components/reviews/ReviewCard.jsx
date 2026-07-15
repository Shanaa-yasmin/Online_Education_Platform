import RatingStars from './RatingStars';

/**
 * ReviewCard — Renders a single review entry.
 *
 * Props:
 *   review   – review object from API
 *   isOwner  – boolean, show edit/delete controls
 *   onEdit   – callback(review) when edit is clicked
 *   onDelete – callback(reviewId) when delete is clicked
 */

/* Friendly relative-time formatter */
function timeAgo(dateStr) {
  const now = new Date();
  const then = new Date(dateStr);
  const seconds = Math.floor((now - then) / 1000);

  const intervals = [
    { label: 'year', s: 31536000 },
    { label: 'month', s: 2592000 },
    { label: 'week', s: 604800 },
    { label: 'day', s: 86400 },
    { label: 'hour', s: 3600 },
    { label: 'minute', s: 60 },
  ];

  for (const { label, s } of intervals) {
    const count = Math.floor(seconds / s);
    if (count >= 1) return `${count} ${label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/* Avatar with initials fallback */
const Avatar = ({ name }) => {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return <div className="review-avatar">{initials}</div>;
};

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const FlagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" />
  </svg>
);

export default function ReviewCard({ review, isOwner, isAdmin, onEdit, onDelete, onReport }) {
  const wasEdited = review.updated_at && review.created_at !== review.updated_at;

  return (
    <article className="review-card">
      <div className="review-card__header">
        <Avatar name={review.student?.username} />
        <div className="review-card__meta">
          <span className="review-card__author">{review.student?.username || 'Student'}</span>
          <span className="review-card__date">
            {timeAgo(review.created_at)}
            {wasEdited && <span className="review-card__edited">(edited)</span>}
          </span>
        </div>
        <div className="review-card__rating">
          <RatingStars value={review.rating} size="sm" />
        </div>
      </div>

      {review.comment && (
        <p className="review-card__comment">{review.comment}</p>
      )}

      <div className="review-card__actions" style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
        {(isOwner || isAdmin) && (
          <div style={{ display: 'flex', gap: 12 }}>
            {isOwner && (
              <button
                className="review-action-btn review-action-btn--edit"
                onClick={() => onEdit?.(review)}
                aria-label="Edit review"
              >
                <EditIcon /> Edit
              </button>
            )}
            <button
              className="review-action-btn review-action-btn--delete"
              onClick={() => onDelete?.(review.id)}
              aria-label="Delete review"
            >
              <TrashIcon /> Delete
            </button>
          </div>
        )}

        {!isOwner && !isAdmin && (
          <button
            className={`review-card__report-btn ${review.has_reported ? 'review-card__report-btn--reported' : ''}`}
            onClick={() => !review.has_reported && onReport?.(review)}
            disabled={review.has_reported}
            aria-label={review.has_reported ? "Review reported" : "Report review for abuse"}
          >
            <FlagIcon /> {review.has_reported ? 'Reported' : 'Report'}
          </button>
        )}
      </div>
    </article>
  );
}


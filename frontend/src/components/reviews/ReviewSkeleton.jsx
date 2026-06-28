/**
 * ReviewSkeleton — Loading placeholder for ReviewCard.
 */
export default function ReviewSkeleton({ count = 3 }) {
  return (
    <div className="review-skeletons" aria-busy="true" aria-label="Loading reviews">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="review-skeleton">
          <div className="review-skeleton__header">
            <div className="skeleton-circle" />
            <div className="skeleton-lines">
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line skeleton-line--xs" />
            </div>
            <div className="skeleton-line skeleton-line--stars" />
          </div>
          <div className="skeleton-line skeleton-line--full" />
          <div className="skeleton-line skeleton-line--long" />
        </div>
      ))}
    </div>
  );
}

/**
 * NotificationSkeleton — skeleton loaders for notification cards.
 */
export default function NotificationSkeleton({ count = 3 }) {
  return (
    <div className="ns-list" aria-busy="true" aria-label="Loading notifications">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="ns-card">
          <div className="ns-avatar skeleton-shimmer" />
          <div className="ns-content">
            <div className="ns-row">
              <div className="ns-title skeleton-shimmer" />
              <div className="ns-time skeleton-shimmer" />
            </div>
            <div className="ns-msg skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

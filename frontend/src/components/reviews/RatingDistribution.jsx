import RatingStars from './RatingStars';

/**
 * RatingDistribution — Shows the average rating prominently + 5-star horizontal bars.
 *
 * Props:
 *   average      – overall average rating (float)
 *   total        – total number of reviews (int)
 *   distribution – { "5": 120, "4": 30, "3": 8, "2": 3, "1": 2 }
 */
export default function RatingDistribution({ average = 0, total = 0, distribution = {} }) {
  const maxCount = Math.max(...Object.values(distribution), 1);

  return (
    <div className="rating-distribution">
      {/* ── Left: Big number + stars ──────────────────────────── */}
      <div className="rating-distribution__summary">
        <span className="rating-distribution__big-number">{average.toFixed(1)}</span>
        <RatingStars value={average} size="md" />
        <span className="rating-distribution__total">
          {total} {total === 1 ? 'review' : 'reviews'}
        </span>
      </div>

      {/* ── Right: 5-star bars ────────────────────────────────── */}
      <div className="rating-distribution__bars">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[String(star)] || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;

          return (
            <div key={star} className="rating-bar-row">
              <span className="rating-bar-label">{star}</span>
              <svg className="rating-bar-star-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <div className="rating-bar-track">
                <div
                  className="rating-bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="rating-bar-count">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

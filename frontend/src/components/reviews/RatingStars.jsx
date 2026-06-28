import { useState, useCallback } from 'react';

/**
 * RatingStars — Display-only or interactive star rating.
 *
 * Props:
 *   value       – current rating (0-5, supports .5 increments in display)
 *   onChange     – callback(newRating) when a star is clicked (enables interactive)
 *   interactive – force interactive mode even without onChange
 *   size        – 'sm' | 'md' | 'lg'  (default 'md')
 *   showValue   – display numeric value next to stars
 */

const STAR_SIZES = { sm: 14, md: 18, lg: 24 };

export default function RatingStars({
  value = 0,
  onChange,
  interactive = false,
  size = 'md',
  showValue = false,
}) {
  const [hoverValue, setHoverValue] = useState(0);
  const isInteractive = interactive || !!onChange;
  const displayValue = hoverValue || value;
  const px = STAR_SIZES[size] || STAR_SIZES.md;

  const handleKeyDown = useCallback(
    (e) => {
      if (!onChange) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        onChange(Math.min(5, Math.round(value) + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        onChange(Math.max(1, Math.round(value) - 1));
      }
    },
    [onChange, value],
  );

  return (
    <div
      className={`rating-stars rating-stars--${size}${isInteractive ? ' rating-stars--interactive' : ''}`}
      role={isInteractive ? 'radiogroup' : 'img'}
      aria-label={`Rating: ${value} out of 5 stars`}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = displayValue >= star;
        const half = !filled && displayValue >= star - 0.5;

        return (
          <span
            key={star}
            className={`star${filled ? ' star--filled' : ''}${half ? ' star--half' : ''}${isInteractive ? ' star--clickable' : ''}`}
            onClick={onChange ? () => onChange(star) : undefined}
            onMouseEnter={isInteractive ? () => setHoverValue(star) : undefined}
            onMouseLeave={isInteractive ? () => setHoverValue(0) : undefined}
            role={isInteractive ? 'radio' : undefined}
            aria-checked={isInteractive ? star === Math.round(value) : undefined}
            aria-label={isInteractive ? `${star} star${star > 1 ? 's' : ''}` : undefined}
          >
            <svg
              width={px}
              height={px}
              viewBox="0 0 24 24"
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {half ? (
                <>
                  {/* Left half filled */}
                  <defs>
                    <clipPath id={`half-clip-${star}`}>
                      <rect x="0" y="0" width="12" height="24" />
                    </clipPath>
                  </defs>
                  <polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    fill="none"
                    stroke="currentColor"
                  />
                  <polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    fill="currentColor"
                    clipPath={`url(#half-clip-${star})`}
                  />
                </>
              ) : (
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              )}
            </svg>
          </span>
        );
      })}
      {showValue && <span className="rating-stars__value">{value.toFixed(1)}</span>}
    </div>
  );
}

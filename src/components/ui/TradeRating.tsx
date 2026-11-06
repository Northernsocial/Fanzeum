import React from 'react';
import { Star } from 'lucide-react';

interface TradeRatingProps {
  value?: number | null;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export const TradeRating: React.FC<TradeRatingProps> = ({
  value = 0,
  onChange,
  size = 'md',
  disabled = false,
}) => {
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (value ?? 0) >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={disabled || !onChange}
            onClick={() => onChange?.(star)}
            aria-label={`Rate ${star} out of 5`}
            className={`p-0.5 rounded transition-colors cursor-pointer disabled:cursor-not-allowed ${
              filled ? 'text-brass' : 'text-muted'
            } hover:text-brass disabled:hover:text-current`}
          >
            <Star
              className={iconSize}
              strokeWidth={filled ? 1.5 : 1}
              fill={filled ? 'currentColor' : 'none'}
            />
          </button>
        );
      })}
    </div>
  );
};

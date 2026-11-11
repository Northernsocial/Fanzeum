import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Sheet } from '../ui/Sheet';
import { Star } from 'lucide-react';

interface TradeRatingModalProps {
  open: boolean;
  onClose: () => void;
  ratedUserId: string;
  ratedUserHandle: string;
  tradeId: string;
  reviewerId: string;
  onRate: (params: {
    tradeId: string;
    reviewerId: string;
    reviewedId: string;
    rating: number;
  }) => Promise<void>;
  loading: boolean;
}

export const TradeRatingModal: React.FC<TradeRatingModalProps> = ({
  open,
  onClose,
  ratedUserId,
  ratedUserHandle,
  tradeId,
  reviewerId,
  onRate,
  loading,
}) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = async () => {
    if (rating === 0) return;
    await onRate({
      tradeId,
      reviewerId,
      reviewedId: ratedUserId,
      rating,
    });
    onClose();
    setRating(0);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Rate your trade"
      subtitle={`How was your experience with ${ratedUserHandle}?`}
    >
      <div className="space-y-6">
        {/* Star rating */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-0 rounded-full transition-colors cursor-pointer"
              >
                <Star
                  className="w-8 h-8"
                  fill={star <= (hoverRating || rating) ? 'var(--color-brass)' : 'var(--color-border)'}
                  stroke="currentColor"
                  strokeWidth={star <= (hoverRating || rating) ? 0 : 2}
                />
              </button>
            ))}
          </div>
          <span className="text-sm text-muted">
            {rating === 0 ? 'Select a rating' : `${rating} of 5 stars`}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || rating === 0}>
            {loading ? 'Submitting...' : 'Submit rating'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

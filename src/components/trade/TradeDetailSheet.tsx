import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Sheet } from '../ui/Sheet';
import type { TradeRecord, TradeItem } from '../../types/domain';

interface TradeDetailSheetProps {
  open: boolean;
  onClose: () => void;
  trade: TradeRecord | null;
  myUid: string;
  onAccept: (tradeId: string) => Promise<void>;
  onCounter: (tradeId: string, gbpTopUpNote?: string) => Promise<void>;
  onDecline: (tradeId: string) => Promise<void>;
  onConfirmSent: (tradeId: string) => Promise<void>;
  onConfirmReceived: (tradeId: string) => Promise<void>;
  onRate: (tradeId: string, reviewerId: string, reviewedId: string, rating: number) => Promise<void>;
  loading: boolean;
}

const formatGbp = (value: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(value);
};

const getStateLabel = (state: TradeRecord['state']): string => {
  const labels: Record<TradeRecord['state'], string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    countered: 'Countered',
    declined: 'Declined',
    confirmed_sent: 'Confirmed sent',
    completed: 'Completed',
  };
  return labels[state] || state;
};

const getStateColor = (state: TradeRecord['state']): string => {
  const colors: Record<TradeRecord['state'], string> = {
    pending: 'bg-brass/20 text-brass border-brass/30',
    accepted: 'bg-green-900/30 text-green-400 border-green-900/50',
    countered: 'bg-amber-900/30 text-amber-400 border-amber-900/50',
    declined: 'bg-red-900/30 text-red-400 border-red-900/50',
    confirmed_sent: 'bg-blue-900/30 text-blue-400 border-blue-900/50',
    completed: 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50',
  };
  return colors[state] || 'bg-gray-800/50 text-gray-400 border-gray-700';
};

export const TradeDetailSheet: React.FC<TradeDetailSheetProps> = ({
  open,
  onClose,
  trade,
  myUid,
  onAccept,
  onCounter,
  onDecline,
  onConfirmSent,
  onConfirmReceived,
  onRate,
  loading,
}) => {
  const [counterNote, setCounterNote] = useState('');

  if (!trade) return null;

  const isInitiator = trade.initiatorId === myUid;
  const isRecipient = trade.recipientId === myUid;

  const handleCounter = async () => {
    await onCounter(trade.tradeId, counterNote.trim() || undefined);
    setCounterNote('');
  };

  const myItems = isInitiator ? trade.initiatorItems : trade.recipientItems;
  const theirItems = isInitiator ? trade.recipientItems : trade.initiatorItems;

  const totalMyValue = myItems.reduce(
    (sum, item) => sum + (item.valueMinGbp + item.valueMaxGbp) / 2,
    0
  );
  const totalTheirValue = theirItems.reduce(
    (sum, item) => sum + (item.valueMinGbp + item.valueMaxGbp) / 2,
    0
  );

  // Determine what actions are available
  const canAcceptDecline = trade.state === 'pending' && isRecipient;
  const canCounter = trade.state === 'pending' && isRecipient;
  const canAcceptCounter = trade.state === 'countered' && isInitiator;
  const canConfirmSent = trade.state === 'accepted' && (isInitiator || isRecipient);
  const canConfirmReceived = trade.state === 'confirmed_sent' &&
    trade.initiatorConfirmedSent && trade.recipientConfirmedSent &&
    ((isInitiator && !trade.initiatorConfirmedReceived) || (isRecipient && !trade.recipientConfirmedReceived));
  const canRate = trade.state === 'completed' &&
    ((isInitiator && !trade.ratings?.recipient) || (isRecipient && !trade.ratings?.initiator));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Trade details"
      subtitle={getStateLabel(trade.state)}
    >
      <div className="space-y-4">
        {/* Status badge */}
        <div className="flex justify-center">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStateColor(trade.state)}`}>
            {getStateLabel(trade.state)}
          </span>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-4">
          <Card raised className="p-4">
            <p className="text-xs text-muted mb-1">From</p>
            <p className="text-sm font-semibold text-ink">
              {isInitiator ? 'You' : trade.initiatorHandle}
            </p>
          </Card>
          <Card raised className="p-4">
            <p className="text-xs text-muted mb-1">To</p>
            <p className="text-sm font-semibold text-ink">
              {isRecipient ? 'You' : trade.recipientHandle}
            </p>
          </Card>
        </div>

        {/* My items */}
        <div>
          <h4 className="text-xs font-mono text-brass mb-2">My items</h4>
          <div className="grid grid-cols-1 gap-2">
            {myItems.map((item) => (
              <Card key={item.itemId} className="p-3">
                <div className="flex items-start gap-3">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-12 h-12 rounded-lg object-cover bg-surface"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-display font-semibold text-ink truncate">
                      {item.title}
                    </h5>
                    <p className="text-xs text-muted">
                      {formatGbp((item.valueMinGbp + item.valueMaxGbp) / 2)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Their items */}
        <div>
          <h4 className="text-xs font-mono text-brass mb-2">Their items</h4>
          <div className="grid grid-cols-1 gap-2">
            {theirItems.map((item) => (
              <Card key={item.itemId} className="p-3">
                <div className="flex items-start gap-3">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-12 h-12 rounded-lg object-cover bg-surface"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-display font-semibold text-ink truncate">
                      {item.title}
                    </h5>
                    <p className="text-xs text-muted">
                      {formatGbp((item.valueMinGbp + item.valueMaxGbp) / 2)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* GBP top-up note */}
        {trade.gbpTopUpNote && (
          <Card raised className="p-3">
            <p className="text-xs text-muted mb-1">GBP top-up note</p>
            <p className="text-sm text-ink">{trade.gbpTopUpNote}</p>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-2">
          {/* Accept/Decline (when pending) */}
          {canAcceptDecline && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onDecline(trade.tradeId)} disabled={loading}>
                Decline
              </Button>
              <Button onClick={() => onAccept(trade.tradeId)} disabled={loading}>
                Accept
              </Button>
            </div>
          )}

          {/* Counter (when pending) */}
          {canCounter && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleCounter} disabled={loading}>
                Counter
              </Button>
            </div>
          )}

          {/* Accept counter (when countered) */}
          {canAcceptCounter && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onDecline(trade.tradeId)} disabled={loading}>
                Decline
              </Button>
              <Button onClick={() => onAccept(trade.tradeId)} disabled={loading}>
                Accept counter
              </Button>
            </div>
          )}

          {/* Confirm sent (when accepted) */}
          {canConfirmSent && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={loading}>
                Close
              </Button>
              <Button onClick={() => onConfirmSent(trade.tradeId)} disabled={loading}>
                Confirm sent
              </Button>
            </div>
          )}

          {/* Confirm received (when confirmed_sent, both confirmed sent) */}
          {canConfirmReceived && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={loading}>
                Close
              </Button>
              <Button onClick={() => onConfirmReceived(trade.tradeId)} disabled={loading}>
                Confirm received
              </Button>
            </div>
          )}

          {/* Rating (when completed) */}
          {canRate && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={loading}>
                Close
              </Button>
              <Button
                onClick={() => onRate(
                  trade.tradeId,
                  myUid,
                  isInitiator ? trade.recipientId : trade.initiatorId,
                  5 // Default to 5, will be overridden by rating modal
                )}
                disabled={loading}
              >
                Rate trade
              </Button>
            </div>
          )}

          {/* Completed - just close */}
          {trade.state === 'completed' && !canRate && (
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Close
            </Button>
          )}

          {/* Declined */}
          {trade.state === 'declined' && (
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Close
            </Button>
          )}
        </div>

        {/* Counter note input - only for pending state */}
        {trade.state === 'pending' && isRecipient && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-ink mb-1">
              Counter note (optional, max 500 chars)
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={counterNote}
              onChange={(e) => setCounterNote(e.target.value)}
              placeholder="Explain your counter offer..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink resize-none"
            />
          </div>
        )}

        {/* Ratings display */}
        {trade.state === 'completed' && trade.ratings && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-xs font-mono text-brass mb-2">Ratings</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted mb-1">You rated them</p>
                <p className="text-sm text-ink">
                  {isInitiator && trade.ratings.recipient
                    ? '★'.repeat(trade.ratings.recipient.rating) + '☆'.repeat(5 - trade.ratings.recipient.rating)
                    : isRecipient && trade.ratings.initiator
                    ? '★'.repeat(trade.ratings.initiator.rating) + '☆'.repeat(5 - trade.ratings.initiator.rating)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">They rated you</p>
                <p className="text-sm text-ink">
                  {isInitiator && trade.ratings.initiator
                    ? '★'.repeat(trade.ratings.initiator.rating) + '☆'.repeat(5 - trade.ratings.initiator.rating)
                    : isRecipient && trade.ratings.recipient
                    ? '★'.repeat(trade.ratings.recipient.rating) + '☆'.repeat(5 - trade.ratings.recipient.rating)
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};

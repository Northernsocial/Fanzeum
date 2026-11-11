import React from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { TradeRecord } from '../../types/domain';

interface TradeHistoryListProps {
  trades: TradeRecord[];
  loading: boolean;
  myUid?: string;
  onViewTrade: (trade: TradeRecord) => void;
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

export const TradeHistoryList: React.FC<TradeHistoryListProps> = ({
  trades,
  loading,
  myUid,
  onViewTrade,
}) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} raised className="p-4 animate-pulse">
            <div className="h-4 bg-surface-raised rounded w-3/4 mb-2" />
            <div className="h-3 bg-surface-raised rounded w-1/2 mb-2" />
            <div className="h-3 bg-surface-raised rounded w-1/4" />
          </Card>
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted mb-4">No trades yet</p>
        <p className="text-sm text-muted">
          Trade offers will appear here once you start exchanging pieces with other collectors.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trades.map((trade) => {
        const isInitiator = myUid ? trade.initiatorId === myUid : true;
        const otherParty = isInitiator ? trade.recipientHandle : trade.initiatorHandle;
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

        return (
          <Card key={trade.tradeId} raised className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStateColor(trade.state)}`}>
                    {getStateLabel(trade.state)}
                  </span>
                  <span className="text-xs font-mono text-muted">
                    {trade.createdAt
                      ? new Date(trade.createdAt as string | number | Date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Date unknown'}
                  </span>
                </div>
                <h4 className="text-sm font-display font-semibold text-ink mb-1">
                  {otherParty}
                </h4>
                <div className="text-xs text-muted">
                  <span>{myItems.length} item{myItems.length !== 1 ? 's' : ''} ↔ {theirItems.length} item{theirItems.length !== 1 ? 's' : ''}</span>
                  {trade.gbpTopUpNote && (
                    <span className="ml-2">Top-up: {trade.gbpTopUpNote}</span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onViewTrade(trade)}>
                View
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

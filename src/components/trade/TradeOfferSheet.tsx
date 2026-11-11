import React, { useState, useMemo } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Sheet } from '../ui/Sheet';
import type { CollectibleItemRecord, TradeItem } from '../../types/domain';

interface TradeOfferSheetProps {
  open: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  myItems: CollectibleItemRecord[];
  theirItems: CollectibleItemRecord[];
  onSend: (params: {
    initiatorItemIds: string[];
    recipientItemIds: string[];
    gbpTopUpNote: string;
  }) => Promise<void>;
  loading: boolean;
  myUid: string;
}

export const TradeOfferSheet: React.FC<TradeOfferSheetProps> = ({
  open,
  onClose,
  recipientId,
  recipientName,
  myItems,
  theirItems,
  onSend,
  loading,
  myUid,
}) => {
  const [selectedMyItems, setSelectedMyItems] = useState<string[]>([]);
  const [selectedTheirItems, setSelectedTheirItems] = useState<string[]>([]);
  const [gbpTopUpNote, setGbpTopUpNote] = useState('');

  const [showMyItems, setShowMyItems] = useState(true);

  const handleToggleItem = (itemId: string, list: 'my' | 'their') => {
    if (list === 'my') {
      setSelectedMyItems((prev) => {
        if (prev.includes(itemId)) return prev.filter((id) => id !== itemId);
        return [...prev, itemId];
      });
    } else {
      setSelectedTheirItems((prev) => {
        if (prev.includes(itemId)) return prev.filter((id) => id !== itemId);
        return [...prev, itemId];
      });
    }
  };

  const handleSubmit = async () => {
    if (selectedMyItems.length === 0 || selectedTheirItems.length === 0) return;
    await onSend({
      initiatorItemIds: selectedMyItems,
      recipientItemIds: selectedTheirItems,
      gbpTopUpNote: gbpTopUpNote.trim(),
    });
    onClose();
    setSelectedMyItems([]);
    setSelectedTheirItems([]);
    setGbpTopUpNote('');
  };

  // Verify ownership of selected items
  const myItemsOwned = selectedMyItems.every(id => {
    const item = myItems.find(i => i.id === id);
    return item && item.ownerId === myUid;
  });
  const theirItemsOwned = selectedTheirItems.every(id => {
    const item = theirItems.find(i => i.id === id);
    return item && item.ownerId === recipientId;
  });

  const totalMyValue = useMemo(() => {
    return selectedMyItems.reduce((sum, id) => {
      const item = myItems.find((i) => i.id === id);
      return sum + (item ? (item.valueMinGbp + item.valueMaxGbp) / 2 : 0);
    }, 0);
  }, [selectedMyItems, myItems]);

  const totalTheirValue = useMemo(() => {
    return selectedTheirItems.reduce((sum, id) => {
      const item = theirItems.find((i) => i.id === id);
      return sum + (item ? (item.valueMinGbp + item.valueMaxGbp) / 2 : 0);
    }, 0);
  }, [selectedTheirItems, theirItems]);

  const formatGbp = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(value);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Send trade offer"
      subtitle={`To ${recipientName}`}
    >
      <div className="space-y-4">
        {/* Toggle between item lists */}
        <div className="flex gap-2">
          <Button
            variant={showMyItems ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowMyItems(true)}
            fullWidth
          >
            My items ({myItems.length})
          </Button>
          <Button
            variant={showMyItems ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setShowMyItems(false)}
            fullWidth
          >
            Their items ({theirItems.length})
          </Button>
        </div>

        {/* Item selection grid */}
        <div className="max-h-60 overflow-y-auto">
          <div className="grid grid-cols-1 gap-3">
            {(showMyItems ? myItems : theirItems).map((item) => {
              const isSelected = showMyItems
                ? selectedMyItems.includes(item.id)
                : selectedTheirItems.includes(item.id);
              return (
                <Card
                  key={item.id}
                  raised={isSelected}
                  className={`p-3 cursor-pointer transition-all ${
                    isSelected ? 'border-brass' : 'hover:shadow-md'
                  }`}
                  onClick={() => handleToggleItem(item.id, showMyItems ? 'my' : 'their')}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleItem(item.id, showMyItems ? 'my' : 'their')}
                        className="w-4 h-4 rounded border-border bg-bg"
                      />
                      <span className="text-xs font-mono text-muted">
                        {showMyItems ? 'Me' : 'Them'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-display font-semibold text-ink truncate">
                        {item.title}
                      </h4>
                      <p className="text-xs text-muted truncate">
                        {item.year} • {item.condition}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-brass">
                          {formatGbp((item.valueMinGbp + item.valueMaxGbp) / 2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Value summary */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          <div className="text-center">
            <p className="text-xs text-muted">My total value</p>
            <p className="text-sm font-semibold text-ink">
              {formatGbp(totalMyValue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted">Their total value</p>
            <p className="text-sm font-semibold text-ink">
              {formatGbp(totalTheirValue)}
            </p>
          </div>
        </div>

        {/* GBP top-up note */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            GBP top-up note (optional, max 500 chars)
          </label>
          <textarea
            rows={2}
            maxLength={500}
            value={gbpTopUpNote}
            onChange={(e) => setGbpTopUpNote(e.target.value)}
            placeholder="e.g. 'I'll add £25 for the difference'"
            className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink resize-none"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              selectedMyItems.length === 0 ||
              selectedTheirItems.length === 0 ||
              !myItemsOwned ||
              !theirItemsOwned
            }
          >
            <Send className="w-4 h-4" />
            <span>Send offer</span>
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

import React, { useState } from 'react';
import { Sparkles, Tag, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { generateListingDescription } from '../../lib/aiClient';
import { createMarketplaceListing, recordPriceHistoryEntry } from '../../lib/firestoreRepo';
import type { CollectibleItemRecord, MarketplaceListingRecord } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';

interface SellItemModalProps {
  item: CollectibleItemRecord;
  open: boolean;
  onClose: () => void;
  onCreated: (listing: MarketplaceListingRecord) => void;
}

export const SellItemModal: React.FC<SellItemModalProps> = ({
  item,
  open,
  onClose,
  onCreated,
}) => {
=======
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';

interface SellItemModalProps {
  item: CollectibleItemRecord;
  open: boolean;
  onClose: () => void;
  onCreated: (listing: MarketplaceListingRecord) => void;
}

export const SellItemModal: React.FC<SellItemModalProps> = ({
  item,
  open,
  onClose,
  onCreated,
}) => {
  const { profile, firebaseUser } = useAuth();
  const [title, setTitle] = useState(item.title);
  const [priceGbp, setPriceGbp] = useState(String(item.valueMaxGbp || 50));
  const [description, setDescription] = useState(
    item.story || `Authentic ${item.category} piece in ${item.condition} condition.`,
  );
  const [generatingAi, setGeneratingAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAiDraft = async () => {
    if (!firebaseUser) return;
    setGeneratingAi(true);
    setError(null);
    try {
      const res = await generateListingDescription({
        title: item.title,
        category: item.category,
        condition: item.condition,
        valueEstGbp: item.valueMaxGbp || 50,
        userNotes: item.story,
      });
      setTitle(res.title || item.title);
      setDescription(res.description || description);
      if (res.suggestedPriceGbp) {
        setPriceGbp(String(res.suggestedPriceGbp));
      }
    } catch (err) {
      console.error('AI listing draft error:', err);
      setError('Could not draft description with AI right now. You can write your own below.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const price = Number(priceGbp);
    if (isNaN(price) || price < 0) {
      setError('Please enter a valid price in GBP (£).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createMarketplaceListing({
        item,
        profile,
        priceGbp: price,
        description,
      });

      await recordPriceHistoryEntry({
        itemId: item.id,
        category: item.category,
        title: item.title,
        priceGbp: price,
        source: 'sale',
      });

      onCreated(created);
      onClose();
=======
    } catch (err) {
      console.error('Create listing error:', err);
      setError('Could not create marketplace listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="List piece for sale"
      subtitle="Set a fixed price for fellow UK collectors in the Fanzeum marketplace."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface-raised border border-border">
          <div className="flex items-center gap-3">
            <img
              src={item.thumbUrl || item.imageUrl}
              alt={item.title}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div>
              <div className="text-sm font-medium text-ink">{item.title}</div>
              <div className="text-xs font-mono text-muted">Condition: {item.condition}</div>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={generatingAi}
            onClick={handleAiDraft}
          >
            <Sparkles className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />
            <span>{generatingAi ? 'Drafting…' : 'AI draft'}</span>
          </Button>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Listing title</label>
          <input
            type="text"
            required
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Fixed price (£ GBP)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-3 text-muted font-mono">£</span>
            <input
              type="number"
              min={0}
              step="1"
              required
              value={priceGbp}
              onChange={(e) => setPriceGbp(e.target.value)}
              className="w-full min-h-[44px] pl-8 pr-3.5 py-2 text-base font-mono rounded-xl border border-border bg-bg text-ink"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Listing description</label>
          <textarea
            rows={4}
            required
            maxLength={1500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe provenance, condition details, shipping terms..."
            className="w-full px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Listing…' : 'Publish listing'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
};

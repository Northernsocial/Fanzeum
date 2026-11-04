import React, { useState } from 'react';
import { Image, Trophy, X } from 'lucide-react';
import type { CategorySlug, CollectibleItemRecord, UserProfile } from '../../types/domain';
import { CATEGORIES } from '../../config/categories';
import { createCommunityThread } from '../../lib/communityRepo';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';

interface NewThreadModalProps {
  open: boolean;
  onClose: () => void;
  defaultCategory?: CategorySlug;
  profile: UserProfile | null;
  userItems: CollectibleItemRecord[];
  isVerifiedUser: boolean;
  onThreadCreated: () => void;
}

export const NewThreadModal: React.FC<NewThreadModalProps> = ({
  open,
  onClose,
  defaultCategory = 'football_cards',
  profile,
  userItems,
  isVerifiedUser: _isVerifiedUser,
  onThreadCreated,
}) => {
  const [category, setCategory] = useState<CategorySlug>(defaultCategory);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedItem, setSelectedItem] = useState<CollectibleItemRecord | null>(null);
  const [includePoll, setIncludePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!title.trim() || !body.trim()) return;

    setLoading(true);
    try {
      await createCommunityThread({
        profile,
        category,
        title,
        body,
        ...(selectedItem ? { photoUrl: selectedItem.thumbUrl || selectedItem.imageUrl, linkedItemId: selectedItem.id } : {}),
        ...(includePoll && pollQuestion.trim() && pollOptions.filter(Boolean).length >= 2
          ? { poll: { question: pollQuestion, options: pollOptions.filter(Boolean) } }
          : {}),
        isVerifiedUser: true,
      });
      setTitle('');
      setBody('');
      setSelectedItem(null);
      setIncludePoll(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      onThreadCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create thread:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Start Community Discussion">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">
            Community Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategorySlug)}
            className="w-full px-4 py-3 rounded-xl bg-surface-raised border border-border text-ink focus:outline-none focus:border-brass text-sm"
          >
            {Object.values(CATEGORIES).map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">
            Discussion Title
          </label>
          <input
            type="text"
            required
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Rare variant find or grading question..."
            className="w-full px-4 py-3 rounded-xl bg-surface-raised border border-border text-ink placeholder:text-muted focus:outline-none focus:border-brass text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">
            Message / Story
          </label>
          <textarea
            required
            rows={4}
            maxLength={3000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts, ask for advice, or start a debate..."
            className="w-full px-4 py-3 rounded-xl bg-surface-raised border border-border text-ink placeholder:text-muted focus:outline-none focus:border-brass text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">
            Attach Showcase Piece (Optional)
          </label>
          <select
            value={selectedItem?.id || ''}
            onChange={(e) => {
              const found = userItems.find((i) => i.id === e.target.value);
              setSelectedItem(found || null);
            }}
            className="w-full px-4 py-3 rounded-xl bg-surface-raised border border-border text-ink focus:outline-none focus:border-brass text-sm"
          >
            <option value="">No piece attached</option>
            {userItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} ({item.category.replace('_', ' ')})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Add a Poll</span>
            <button
              type="button"
              onClick={() => setIncludePoll(!includePoll)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                includePoll ? 'bg-brass text-brass-fg' : 'bg-surface-raised text-muted border border-border'
              }`}
            >
              {includePoll ? 'Remove poll' : 'Add poll'}
            </button>
          </div>

          {includePoll && (
            <div className="space-y-3 p-4 rounded-xl bg-surface-raised border border-border">
              <input
                type="text"
                placeholder="Poll question (e.g. Which grade is this?)"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-ink text-sm"
              />
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[idx] = e.target.value;
                      setPollOptions(next);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-ink text-sm"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                      className="text-muted hover:text-danger cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className="text-xs text-brass font-medium hover:underline cursor-pointer"
                >
                  + Add option
                </button>
              )}
            </div>
          )}
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !title.trim() || !body.trim()}>
            {loading ? 'Publishing...' : 'Publish thread'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
};

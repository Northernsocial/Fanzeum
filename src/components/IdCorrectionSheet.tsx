import React, { useState } from 'react';
import { HelpCircle, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { suggestIdCorrection } from '../lib/interactionRepo';
import type { CollectibleItemRecord } from '../types/domain';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';

interface IdCorrectionSheetProps {
  item: CollectibleItemRecord;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export const IdCorrectionSheet: React.FC<IdCorrectionSheetProps> = ({
  item,
  open,
  onClose,
  onSubmitted,
}) => {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const [suggestion, setSuggestion] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      openAuthModal();
      return;
    }

    if (!suggestion.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      await suggestIdCorrection({
        itemId: item.id,
        itemOwnerId: item.ownerId,
        suggesterId: firebaseUser.uid,
        suggesterHandle: profile?.handle || 'collector',
        suggesterName: profile?.displayName || 'Fellow Collector',
        suggestedCorrection: suggestion.trim(),
        note: note.trim() || undefined,
        isVerifiedUser: Boolean(firebaseUser.emailVerified),
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSuggestion('');
        setNote('');
        onClose();
        onSubmitted?.();
      }, 1500);
    } catch (err) {
      console.error('ID correction error:', err);
      setError('Could not submit correction. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Suggest an ID correction"
      subtitle={`Help the owner identify this piece accurately.`}
    >
      {success ? (
        <div className="py-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-ok/20 text-ok mx-auto flex items-center justify-center font-bold text-xl">
            ✓
          </div>
          <h3 className="text-lg font-display font-semibold text-ink">Thank you!</h3>
          <p className="text-sm text-muted">
            Your suggested correction has been sent to @{item.ownerHandle}.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-surface border border-border text-xs text-muted space-y-1">
            <div className="text-ink font-medium">Current title:</div>
            <div className="font-mono text-brass">{item.title}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Suggested identification
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder='e.g. "I think this is SG 8, not SG 7" or exact catalogue number'
              className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink placeholder:text-muted/60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Optional note / reference
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Check the plate watermark or corner letters..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink placeholder:text-muted/60"
            />
          </div>

          {error && (
            <p className="text-xs text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
              {error}
            </p>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !suggestion.trim()}>
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting…' : 'Submit correction'}</span>
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
};

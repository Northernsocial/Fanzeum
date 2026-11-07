import React, { useState } from 'react';
import { Award, Calendar, CheckCircle2, Clock, Send, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import type { GradingCompany, GradingSubmission, GradingSubmissionStatus } from '../../types/domain';

interface GradingTrackerSheetProps {
  open: boolean;
  onClose: () => void;
  currentSubmission?: GradingSubmission;
  onSave: (submission: GradingSubmission | null) => Promise<void>;
}

const GRADING_COMPANIES: { value: GradingCompany; label: string; desc: string }[] = [
  { value: 'PSA', label: 'PSA', desc: 'Professional Sports Authenticator' },
  { value: 'CGC', label: 'CGC Cards / Comics', desc: 'Certified Guaranty Company' },
  { value: 'BGS', label: 'Beckett (BGS)', desc: 'Beckett Grading Services with subgrades' },
  { value: 'SGC', label: 'SGC', desc: 'Sportscard Guaranty Corporation (Tuxedo)' },
  { value: 'PCGS', label: 'PCGS', desc: 'Professional Coin Grading Service' },
  { value: 'NGC', label: 'NGC', desc: 'Numismatic Guaranty Company' },
  { value: 'other', label: 'Other service', desc: 'Ace Grading, Majesty, or independent' },
];

const SUBMISSION_STATUSES: { value: GradingSubmissionStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'preparing', label: 'Preparing package', icon: <Clock className="w-3.5 h-3.5" /> },
  { value: 'submitted', label: 'Dispatched / Sent', icon: <Send className="w-3.5 h-3.5" /> },
  { value: 'processing', label: 'At grading company', icon: <Clock className="w-3.5 h-3.5 text-brass" /> },
  { value: 'graded', label: 'Grade popped', icon: <Award className="w-3.5 h-3.5 text-brass" /> },
  { value: 'returned', label: 'Returned safely in slab', icon: <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> },
];

export const GradingTrackerSheet: React.FC<GradingTrackerSheetProps> = ({
  open,
  onClose,
  currentSubmission,
  onSave,
}) => {
  const [company, setCompany] = useState<GradingCompany>(currentSubmission?.company || 'PSA');
  const [dateSent, setDateSent] = useState(currentSubmission?.dateSent || new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState(currentSubmission?.reference || '');
  const [status, setStatus] = useState<GradingSubmissionStatus>(currentSubmission?.status || 'submitted');
  const [returnedGrade, setReturnedGrade] = useState(currentSubmission?.returnedGrade || '');
  const [notes, setNotes] = useState(currentSubmission?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: GradingSubmission = {
        company,
        dateSent: dateSent.trim(),
        reference: reference.trim(),
        status,
        updatedAt: new Date().toISOString(),
      };
      if (returnedGrade.trim()) {
        payload.returnedGrade = returnedGrade.trim();
      }
      if (notes.trim()) {
        payload.notes = notes.trim();
      }
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save grading tracker');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove this grading submission from your piece?')) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove grading submission');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Grading submission tracker"
      subtitle="Track pieces sent to PSA, CGC, Beckett, SGC, PCGS, or NGC."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-muted mb-1.5">Grading Company</label>
          <div className="grid grid-cols-2 gap-2">
            {GRADING_COMPANIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCompany(c.value)}
                className={`min-h-[44px] p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  company === c.value
                    ? 'border-brass bg-surface-raised ring-1 ring-brass/40 text-ink'
                    : 'border-border bg-bg/60 text-muted hover:border-border/80 hover:text-ink'
                }`}
              >
                <div className="text-sm font-semibold">{c.label}</div>
                <div className="text-[11px] text-muted truncate">{c.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono text-muted mb-1">
              Date dispatched
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={dateSent}
                onChange={(e) => setDateSent(e.target.value)}
                className="w-full min-h-[42px] px-3 py-1.5 text-sm font-mono rounded-xl border border-border bg-bg text-ink"
              />
              <Calendar className="w-4 h-4 text-muted absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-muted mb-1">
              Order or submission reference
            </label>
            <input
              type="text"
              required
              maxLength={80}
              placeholder="e.g. 10294821 or Tier Regular"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full min-h-[42px] px-3 py-1.5 text-sm font-mono rounded-xl border border-border bg-bg text-ink"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-muted mb-1.5">Submission status</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUBMISSION_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-2 transition-all cursor-pointer ${
                  status === s.value
                    ? 'border-brass bg-surface-raised ring-1 ring-brass/40 text-ink font-semibold'
                    : 'border-border bg-bg/60 text-muted hover:text-ink'
                }`}
              >
                {s.icon}
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-muted mb-1">
            Returned official grade (if completed)
          </label>
          <input
            type="text"
            maxLength={50}
            placeholder="e.g. Gem Mint 10, PSA 9, MS 64 Red"
            value={returnedGrade}
            onChange={(e) => setReturnedGrade(e.target.value)}
            className="w-full min-h-[42px] px-3 py-1.5 text-sm font-mono rounded-xl border border-border bg-bg text-ink"
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-muted mb-1">
            Notes (declared value, subgrades, return tracking)
          </label>
          <textarea
            rows={2}
            maxLength={500}
            placeholder="e.g. Subgrades 9.5 C, 9.0 E, 9.5 C, 10 S. Royal Mail Special Delivery tracked."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-bg text-ink resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
            {error}
          </p>
        )}

        <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
          {currentSubmission ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={saving}
              onClick={() => void handleRemove()}
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              <span>Remove</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !reference.trim()}>
              {saving ? 'Saving…' : 'Save submission'}
            </Button>
          </div>
        </div>
      </form>
    </Sheet>
  );
};

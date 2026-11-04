import React, { useState } from 'react';
import { Award, MessageSquare, Sparkles, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CATEGORY_LIST, type CategorySlug } from '../../config/categories';
import { requestMentorship } from '../../lib/journeyRepo';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Sheet } from '../../components/ui/Sheet';

export const MentorsPage: React.FC = () => {
  const { firebaseUser, profile } = useAuth();

  useDocumentMeta({
    title: 'Collector Mentorships · Fanzeum',
    description: 'Get matched with expert category mentors or apply to become a certified mentor.',
  });

  const [selectedCat, setSelectedCat] = useState<CategorySlug>('stamps');
  const [message, setMessage] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;
    setSubmitting(true);
    try {
      await requestMentorship({
        menteeId: firebaseUser.uid,
        menteeHandle: profile.handle,
        category: selectedCat,
        message,
      });
      setSheetOpen(false);
      setMessage('');
      setSuccessToast(true);
      window.setTimeout(() => setSuccessToast(false), 3500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-mono text-brass">
            <Users className="w-4 h-4" strokeWidth={1.5} />
            <span>Collector Mentorship Programme</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink mt-1">
            Category Mentors
          </h1>
          <p className="text-base text-muted mt-1 max-w-2xl">
            Newcomers can request a seasoned mentor for any hobby. Certified mentors verify IDs, advise on grading standards, and share decades of collecting wisdom.
          </p>
        </div>

        <Button onClick={() => setSheetOpen(true)}>
          <Sparkles className="w-4 h-4" />
          <span>Request a mentor</span>
        </Button>
      </div>

      {successToast && (
        <div className="p-4 rounded-xl bg-ok/10 border border-ok/30 text-ok text-sm font-medium">
          Mentorship request sent successfully! An experienced collector in your chosen hobby will review it shortly.
        </div>
      )}

      {/* Featured Mentors Grid */}
      <div className="space-y-4">
        <h2 className="text-2xl font-display font-semibold text-ink">Featured Mentors</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-surface-raised border border-border flex items-center justify-center font-display font-semibold text-brass">
                AG
              </div>
              <div>
                <h3 className="text-lg font-semibold text-ink">Arthur Goodwin</h3>
                <div className="text-xs font-mono text-brass">@arthur_stamps · Master</div>
              </div>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Specialises in Victorian Line-Engraved GB and Stanley Gibbons plate varieties. 35 years collecting.
            </p>
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted">
              <span>Mentored 18 collectors</span>
              <span className="text-ok font-mono">Verified Mentor</span>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-surface-raised border border-border flex items-center justify-center font-display font-semibold text-brass">
                ET
              </div>
              <div>
                <h3 className="text-lg font-semibold text-ink">Elena Thorne</h3>
                <div className="text-xs font-mono text-brass">@elena_chrome · Legend</div>
              </div>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Premier League refractors, Topps Chrome rookie runs and PSA grading submission strategy.
            </p>
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted">
              <span>Mentored 24 collectors</span>
              <span className="text-ok font-mono">Verified Mentor</span>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-surface-raised border border-border flex items-center justify-center font-display font-semibold text-brass">
                MC
              </div>
              <div>
                <h3 className="text-lg font-semibold text-ink">Marcus Chen</h3>
                <div className="text-xs font-mono text-brass">@marcus_coins · Master</div>
              </div>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              British hammered silver, Spink references and Spink/NGC certified mint state coinage.
            </p>
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted">
              <span>Mentored 19 collectors</span>
              <span className="text-ok font-mono">Verified Mentor</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Request Sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Request a Mentor Match"
        subtitle="Tell us which hobby you want guidance in and what your collecting goals are."
      >
        {!firebaseUser ? (
          <div className="space-y-4 py-4">
            <p className="text-muted">Sign in to request a collector mentor.</p>
            <Button fullWidth onClick={() => setSheetOpen(false)}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Hobby category</label>
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value as CategorySlug)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
              >
                {CATEGORY_LIST.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.shortLabel}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">What would you like help with?</label>
              <textarea
                rows={4}
                required
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. I am starting to collect 19th-century GB stamps and want help checking plate numbers and margins..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-bg text-ink"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !message.trim()}>
                {submitting ? 'Submitting…' : 'Submit request'}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
};

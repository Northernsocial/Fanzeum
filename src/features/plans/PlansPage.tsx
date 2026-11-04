import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getEntitlements, isPremium } from '../../lib/entitlements';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export const PlansPage: React.FC = () => {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);

  useDocumentMeta({
    title: 'Fanzeum Plans · Collector Plus & Dealer Showcase',
    description: 'Compare Free and Collector Plus plans for unlimited collections, expert panel access, and Fresh Finds boost.',
  });

  const premiumActive = isPremium(profile);

  const handleUpgrade = async () => {
    if (!firebaseUser) {
      openAuthModal();
      return;
    }
    setLoadingCheckout(true);
    setErrorNote(null);
    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: firebaseUser.uid, email: firebaseUser.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start billing session.');
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorNote(err instanceof Error ? err.message : 'Billing unavailable.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-14 pb-28 space-y-12">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-mono text-brass">
          <Sparkles className="w-4 h-4" strokeWidth={1.5} />
          <span>Collector Memberships</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-display font-semibold text-ink">
          Properly lit showcases for serious collections
        </h1>
        <p className="text-base text-muted leading-relaxed">
          From free multi-collection showcases to Collector Plus with expert panel collaboration, priority AI estimates, and Fresh Finds boosting.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto">
        {/* Free Tier */}
        <Card className="p-8 flex flex-col justify-between space-y-8">
          <div className="space-y-6">
            <div>
              <span className="text-xs font-mono text-muted">Collector (Free)</span>
              <h2 className="text-2xl font-display font-semibold text-ink mt-1">Free Showcase</h2>
              <p className="text-sm text-muted mt-1">Essential tools for cataloguing sets and checking £ valuations.</p>
            </div>

            <div className="text-3xl font-mono font-semibold text-ink">
              £0 <span className="text-sm font-sans font-normal text-muted">/ forever</span>
            </div>

            <ul className="space-y-3.5 text-sm text-ink/90">
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>1 collection of up to 20 items</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>AI photo estimation &amp; UK £ price guides</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>Private purchase price Vault &amp; UK GDPR data export</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>Public @handle collector showcase</span>
              </li>
            </ul>
          </div>

          <div>
            {!firebaseUser ? (
              <Button fullWidth variant="secondary" onClick={openAuthModal}>
                Start free showcase
              </Button>
            ) : profile?.plan === 'free' ? (
              <Button fullWidth variant="secondary" disabled>
                Current plan
              </Button>
            ) : (
              <Button fullWidth variant="secondary" onClick={() => navigate('/settings')}>
                Manage in Settings
              </Button>
            )}
          </div>
        </Card>

        {/* Premium Collector Plus Tier */}
        <Card raised className="p-8 flex flex-col justify-between space-y-8 border-brass/60 after-hours-spotlight relative">
          <div className="absolute -top-3 right-6 bg-brass text-brass-fg text-xs font-mono font-semibold px-3 py-1 rounded-full shadow">
            Recommended
          </div>

          <div className="space-y-6">
            <div>
              <span className="text-xs font-mono text-brass">Collector Plus</span>
              <h2 className="text-2xl font-display font-semibold text-ink mt-1">Unlimited &amp; Expert Panel</h2>
              <p className="text-sm text-muted mt-1">For dedicated collectors chasing complete runs and maximum exhibition quality.</p>
            </div>

            <div className="text-3xl font-mono font-semibold text-brass">
              £4.99 <span className="text-sm font-sans font-normal text-muted">/ month (Test mode)</span>
            </div>

            <ul className="space-y-3.5 text-sm text-ink/90">
              <li className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span><strong>Unlimited collections</strong> &amp; storage space</span>
              </li>
              <li className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span><strong>Expert panel discussions</strong> for rare variants and attribution advice</span>
              </li>
              <li className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>Bulk CSV spreadsheet upload &amp; multi-tray imports</span>
              </li>
              <li className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>Priority Fresh Finds community feed visibility boost</span>
              </li>
              <li className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>Certified insurance export pack with purchase price totals</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            {errorNote && <p className="text-xs text-danger">{errorNote}</p>}
            {premiumActive ? (
              <Button fullWidth disabled>
                Collector Plus Active
              </Button>
            ) : (
              <Button fullWidth disabled={loadingCheckout} onClick={handleUpgrade}>
                {loadingCheckout ? 'Preparing checkout…' : 'Upgrade to Collector Plus'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

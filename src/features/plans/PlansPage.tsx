import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ShieldCheck, Sparkles, Store, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isPremium, isStorePlan } from '../../lib/entitlements';
import { fetchCommissionRates } from '../../lib/firestoreRepo';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export const PlansPage: React.FC = () => {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [loadingCheckout, setLoadingCheckout] = useState<'premium' | 'store' | null>(null);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [commissionRates, setCommissionRates] = useState({ freeRate: 8.5, premiumRate: 4.5, storeRate: 3.5 });

  useDocumentMeta({
    title: 'Fanzeum Plans · Collector Plus & Dealer Showcase',
    description: 'Compare Free, Collector Plus, and Dealer & Store plans for dedicated storefronts, lowest seller fees, and unlimited showcases.',
  });

  useEffect(() => {
    let active = true;
    async function loadRates() {
      const rates = await fetchCommissionRates();
      if (active) setCommissionRates(rates);
    }
    void loadRates();
    return () => {
      active = false;
    };
  }, []);

  const premiumActive = isPremium(profile);
  const storeActive = isStorePlan(profile);

  const handleUpgrade = async (tier: 'premium' | 'store') => {
    if (!firebaseUser) {
      openAuthModal();
      return;
    }
    setLoadingCheckout(tier);
    setErrorNote(null);
    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: firebaseUser.uid, email: firebaseUser.email, plan: tier }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            (tier === 'store'
              ? 'Dealer & Store checkout is coming soon in Stripe test mode. Contact hello@fanzeum.co.uk for early store access.'
              : 'Failed to start billing session.'),
        );
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorNote(
        err instanceof Error
          ? err.message
          : tier === 'store'
          ? 'Dealer & Store checkout is coming soon in Stripe test mode.'
          : 'Billing unavailable.',
      );
    } finally {
      setLoadingCheckout(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-14 pb-28 space-y-12">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-mono text-brass">
          <Sparkles className="w-4 h-4" strokeWidth={1.5} />
          <span>Collector &amp; Dealer Memberships</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-display font-semibold text-ink">
          Properly lit showcases for serious collectors &amp; shops
        </h1>
        <p className="text-base text-muted leading-relaxed">
          From free multi-collection showcases to high-volume Dealer &amp; Store fronts with custom branding, holiday mode, and our lowest marketplace commission.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
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
                <span><strong>{commissionRates.freeRate}%</strong> marketplace seller fee</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>Private purchase price Vault &amp; UK GDPR export</span>
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
                <span>Reduced <strong>{commissionRates.premiumRate}%</strong> marketplace seller fee</span>
              </li>
              <li className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span><strong>Expert panel discussions</strong> for rare variants</span>
              </li>
              <li className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>Bulk CSV spreadsheet upload &amp; multi-tray imports</span>
              </li>
              <li className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>Priority Fresh Finds community feed visibility boost</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            {premiumActive && !storeActive ? (
              <Button fullWidth disabled>
                Collector Plus Active
              </Button>
            ) : (
              <Button
                fullWidth
                disabled={loadingCheckout === 'premium' || storeActive}
                onClick={() => handleUpgrade('premium')}
              >
                {loadingCheckout === 'premium' ? 'Preparing checkout…' : 'Upgrade to Collector Plus'}
              </Button>
            )}
          </div>
        </Card>

        {/* Dealer & Store Tier */}
        <Card className="p-8 flex flex-col justify-between space-y-8 border-border hover:border-brass/50 transition-colors relative">
          <div className="space-y-6">
            <div>
              <span className="text-xs font-mono text-brass">Dealer &amp; Store</span>
              <h2 className="text-2xl font-display font-semibold text-ink mt-1">Dedicated Storefront</h2>
              <p className="text-sm text-muted mt-1">For UK dealers, shops, and high-volume sellers needing their own storefront &amp; lowest fees.</p>
            </div>

            <div className="text-3xl font-mono font-semibold text-ink">
              £19.99 <span className="text-sm font-sans font-normal text-muted">/ month (Test mode)</span>
            </div>

            <ul className="space-y-3.5 text-sm text-ink/90">
              <li className="flex items-start gap-3">
                <Store className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span><strong>Dedicated storefront URL</strong> (/store/@handle) with custom banner &amp; logo</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span><strong>Verified Store badge</strong> upon UK business verification &amp; ID check</span>
              </li>
              <li className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>Lowest <strong>{commissionRates.storeRate}%</strong> marketplace commission rate</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span><strong>Holiday mode</strong> to pause listings instantly without deleting inventory</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span>Custom UK returns policy &amp; buyer assurance banner</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={2} />
                <span><strong>500/hour AI valuations</strong> and priority catalogue support</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            {storeActive ? (
              <Button fullWidth disabled>
                Dealer &amp; Store Active
              </Button>
            ) : (
              <Button
                fullWidth
                variant="secondary"
                disabled={loadingCheckout === 'store'}
                onClick={() => handleUpgrade('store')}
              >
                {loadingCheckout === 'store' ? 'Preparing checkout…' : 'Upgrade to Dealer & Store'}
              </Button>
            )}
          </div>
        </Card>
      </div>

      {errorNote && (
        <div className="max-w-2xl mx-auto p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm text-center">
          {errorNote}
        </div>
      )}
    </div>
  );
};

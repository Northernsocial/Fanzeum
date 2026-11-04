import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingBag, ShieldCheck, Check, ExternalLink, ArrowLeft } from 'lucide-react';
import { fetchMarketplaceListingById, updateMarketplaceListingStatus } from '../../lib/firestoreRepo';
import type { MarketplaceListingRecord } from '../../types/domain';
import { formatGbp } from '../../lib/entitlements';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { Skeleton, EmptyState } from '../../components/ui/EmptyState';

export const MarketplaceDetailPage: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const { firebaseUser, profile } = useAuth();

  const [listing, setListing] = useState<MarketplaceListingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useDocumentMeta({
    title: listing ? `${listing.title} · Marketplace` : 'Marketplace Listing',
    description: listing?.description,
    image: listing?.photos?.[0]?.url,
  });

  useEffect(() => {
    if (!listingId) return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const fetched = await fetchMarketplaceListingById(listingId!);
        if (!active) return;
        setListing(fetched);
      } catch (err) {
        console.error('Fetch listing error:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [listingId]);

  const isSeller = Boolean(firebaseUser && listing && firebaseUser.uid === listing.sellerId);

  const handleWithdraw = async () => {
    if (!listing) return;
    setWithdrawing(true);
    try {
      await updateMarketplaceListingStatus(listing.id, listing.sellerId, 'withdrawn');
      setListing((prev) => (prev ? { ...prev, status: 'withdrawn' } : prev));
    } catch (err) {
      console.error('Withdraw listing error:', err);
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-6">
          <Skeleton className="h-[460px]" />
        </div>
        <div className="lg:col-span-6 space-y-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!listing || listing.status === 'withdrawn') {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
        <EmptyState
          title="Listing not found"
          description="This listing may have been sold or withdrawn by the seller."
          action={
            <Link to="/marketplace">
              <Button>Browse marketplace</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-10">
      <Link
        to="/marketplace"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        <span>Back to marketplace</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        {/* Left: Photos */}
        <div className="lg:col-span-6 space-y-4">
          <div className="aspect-[4/5] rounded-2xl bg-surface-raised border border-border p-4 flex items-center justify-center">
            <CollectorImage
              src={listing.photos?.[0]?.url || ''}
              alt={listing.title}
              category={listing.category}
              priority
              className="w-full h-full"
              imgClassName="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Right: Details & Checkout */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-brass uppercase tracking-wider">
                {listing.category.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-surface-raised border border-border">
                Condition: {listing.condition}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
              {listing.title}
            </h1>
            <div className="text-3xl font-display font-bold text-brass">
              {formatGbp(listing.priceGbp)}
            </div>
          </div>

          <Card className="p-5 space-y-3 bg-surface-raised">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CollectorImage
                  src={listing.sellerAvatarUrl || ''}
                  alt={listing.sellerName}
                  category={listing.category}
                  className="w-10 h-10 rounded-full border border-border object-cover"
                  imgClassName="w-full h-full object-cover rounded-full"
                />
                <div>
                  <div className="text-sm font-medium text-ink">{listing.sellerName}</div>
                  <Link
                    to={`/@${listing.sellerHandle}`}
                    className="text-xs font-mono text-brass hover:underline"
                  >
                    @{listing.sellerHandle}
                  </Link>
                </div>
              </div>
              <div className="inline-flex items-center gap-1 text-xs text-ok font-mono">
                <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
                <span>Verified Collector</span>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-ink">Description</h3>
            <p className="text-base text-ink/90 whitespace-pre-wrap leading-relaxed">
              {listing.description}
            </p>
          </div>

          <div className="pt-4 border-t border-border space-y-3">
            {isSeller ? (
              <Button
                variant="danger"
                fullWidth
                disabled={withdrawing}
                onClick={handleWithdraw}
              >
                {withdrawing ? 'Withdrawing…' : 'Withdraw listing'}
              </Button>
            ) : (
              <Button
                size="lg"
                fullWidth
                onClick={() => setCheckoutModalOpen(true)}
              >
                <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
                <span>Buy for {formatGbp(listing.priceGbp)}</span>
              </Button>
            )}
            <p className="text-xs text-center text-muted">
              Secure buyer protection. Shipped fully insured within the UK.
            </p>
          </div>
        </div>
      </div>

      {/* Checkout Coming Soon Modal */}
      {checkoutModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm p-4 flex items-center justify-center"
        >
          <Card className="max-w-md w-full p-6 space-y-4 bg-surface text-ink">
            <h3 className="text-xl font-display font-semibold">Checkout coming soon</h3>
            <p className="text-sm text-muted leading-relaxed">
              Direct Fanzeum checkout and secure escrow payments are currently in preview. To purchase this piece, please reach out to <strong className="text-ink">@{listing.sellerHandle}</strong> directly on their showcase.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCheckoutModalOpen(false)}>
                Close
              </Button>
              <Link to={`/@${listing.sellerHandle}`}>
                <Button>Visit seller showcase</Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

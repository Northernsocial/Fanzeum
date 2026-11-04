import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Tag, Search, Sparkles } from 'lucide-react';
import { CATEGORIES, type CategorySlug } from '../../config/categories';
import { listMarketplaceListings } from '../../lib/firestoreRepo';
import type { MarketplaceListingRecord } from '../../types/domain';
import { formatGbp } from '../../lib/entitlements';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { Skeleton, EmptyState } from '../../components/ui/EmptyState';

export const MarketplacePage: React.FC = () => {
  useDocumentMeta({
    title: 'Marketplace · Fanzeum',
    description: 'Fixed-price collector pieces for sale from verified collectors across the UK.',
  });

  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | 'all'>('all');
  const [search, setSearch] = useState('');
  const [listings, setListings] = useState<MarketplaceListingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const data = await listMarketplaceListings({ category: selectedCategory });
        if (!active) return;
        setListings(data);
      } catch (err) {
        console.error('List marketplace error:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [selectedCategory]);

  const filtered = listings.filter((item) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(term) ||
      item.sellerHandle.toLowerCase().includes(term) ||
      item.condition.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-10">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-brass/10 border border-brass/30 text-xs font-mono text-brass">
            <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Collector Marketplace</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink">
            Fixed-Price Showcase Finds
          </h1>
          <p className="text-base text-muted max-w-2xl leading-relaxed">
            Browse authenticated pieces listed directly by collectors. Buy securely or connect with fellow enthusiasts across the UK.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`min-h-[40px] px-4 rounded-xl border text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'border-brass bg-surface-raised text-ink'
                : 'border-border bg-surface text-muted hover:text-ink'
            }`}
          >
            All Categories
          </button>
          {Object.values(CATEGORIES).map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`min-h-[40px] px-4 rounded-xl border text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'border-brass bg-surface-raised text-ink'
                  : 'border-border bg-surface text-muted hover:text-ink'
              }`}
            >
              {cat.shortLabel}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted" strokeWidth={1.5} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search listings..."
            className="w-full min-h-[40px] pl-10 pr-4 text-sm rounded-xl border border-border bg-surface text-ink placeholder:text-muted/60 focus:outline-none focus:border-brass/70"
          />
        </div>
      </div>

      {/* Listings Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-6 h-6" strokeWidth={1.5} />}
          title="No active listings"
          description="There are currently no active fixed-price listings in this category. Visit your showcase pieces to list an item for sale."
          action={
            <Link to="/explore">
              <Button>Explore showcase pieces</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((listing) => (
            <Link
              key={listing.id}
              to={`/marketplace/${listing.id}`}
              className="group block"
            >
              <Card interactive className="overflow-hidden flex flex-col h-full">
                <div className="aspect-[4/3] bg-surface-raised relative overflow-hidden flex items-center justify-center p-4">
                  <CollectorImage
                    src={listing.photos?.[0]?.url || ''}
                    alt={listing.title}
                    category={listing.category}
                    className="w-full h-full"
                    imgClassName="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-brass text-brass-fg text-xs font-mono font-bold shadow-md">
                    {formatGbp(listing.priceGbp)}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span className="font-mono">Condition: {listing.condition}</span>
                      <Link
                        to={`/@${listing.sellerHandle}`}
                        className="text-brass hover:underline font-mono"
                        onClick={(e) => e.stopPropagation()}
                      >
                        @{listing.sellerHandle}
                      </Link>
                    </div>
                    <h2 className="text-lg font-display font-semibold text-ink line-clamp-1 group-hover:text-brass transition-colors">
                      {listing.title}
                    </h2>
                    <p className="text-sm text-muted line-clamp-2 leading-relaxed">
                      {listing.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted font-mono">
                    <span>Seller: {listing.sellerName}</span>
                    <span className="text-brass">View listing →</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

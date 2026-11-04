import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CATEGORIES, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMarketplaceListingsByCategory } from '../../lib/firestoreRepo';
import { checkIsFollowing, followTarget } from '../../lib/followRepo';
import type { MarketplaceListingRecord } from '../../types/domain';
import { formatGbp } from '../../lib/entitlements';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { Tabs } from '../../components/ui/Tabs';
import { Bookmark, BookmarkCheck, ShoppingBag } from 'lucide-react';

const CATEGORY_GUIDES: Record<CategorySlug, {
  whatToLookFor: string;
  conditionGrades: string[];
  typicalBudgetRange: string;
  valueHistoryNote: string;
}> = {
  football_cards: {
    whatToLookFor: 'Look for rookie cards (RC), autographs, serial-numbered parallels, and graded slabs from PSA, BGS or CGC. Check set completeness and short prints.',
    conditionGrades: ['Mint', 'Near Mint', 'Excellent', 'Very Good', 'Good', 'Poor'],
    typicalBudgetRange: '£10–£100 for starters',
    valueHistoryNote: 'Values can rise sharply for key pulls or graded examples. Always check recent sales.',
  },
  trading_cards: {
    whatToLookFor: 'Focus on first editions, holographic rares, and graded slabs. Vintage non-sport cards often have strong collector demand.',
    conditionGrades: ['Mint', 'Near Mint', 'Excellent', 'Very Good', 'Good', 'Poor'],
    typicalBudgetRange: '£10–£100 for starters',
    valueHistoryNote: 'TCG values fluctuate with meta shifts and new set releases. Historical prices are estimates.',
  },
  coins: {
    whatToLookFor: 'British sovereigns, Roman denarii, and hammered silver coins are popular. Look for key dates and mint marks.',
    conditionGrades: ['FDC', 'BU', 'UNC', 'EF', 'VF', 'F', 'Fair', 'Poor'],
    typicalBudgetRange: '£10–£100 for starters',
    valueHistoryNote: 'Coin values follow numismatic trends. Gold content and rarity drive long-term value.',
  },
  stamps: {
    whatToLookFor: 'Start with Penny Blacks, Channel Islands, or GB definitives. Check perforation, gum, and plate numbers.',
    conditionGrades: ['MNH (Mint Never Hinged)', 'MM (Mint Mounted)', 'Used', 'On cover'],
    typicalBudgetRange: '£10–£100 for starters',
    valueHistoryNote: 'Stamp values depend on condition and scarcity. Historical catalogues give guidance.',
  },
  comics: {
    whatToLookFor: 'Key issues like first appearances, iconic covers, and CGC slabs. Silver and Bronze Age keys are prized.',
    conditionGrades: ['Near Mint (9.4)', 'Very Fine (8.0)', 'Fine (6.0)', 'Very Good (4.0)', 'Good (2.0)'],
    typicalBudgetRange: '£10–£100 for starters',
    valueHistoryNote: 'Comic values rise for milestone issues. CGC grades provide reliable benchmarks.',
  },
  vinyl: {
    whatToLookFor: 'Northern Soul 45s, UK first pressings, and picture sleeves. Check matrix numbers for authenticity.',
    conditionGrades: ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'P'],
    typicalBudgetRange: '£10–£100 for starters',
    valueHistoryNote: 'Vinyl values depend on rarity and condition. Original pressings command premiums.',
  },
  toys: {
    whatToLookFor: 'Palitoy Star Wars cards, Kenner action figures, Corgi die-cast. Boxed items (MIB) are most valuable.',
    conditionGrades: ['AFA 85 NM+', 'MOC (Mint on Card)', 'MIB (Mint in Box)', 'Loose Complete', 'Playworn'],
    typicalBudgetRange: '£10–£100 for starters',
    valueHistoryNote: 'Vintage toys have seen strong growth. Original packaging is critical for value.',
  },
  memorabilia: {
    whatToLookFor: 'Matchday programmes, ticket stubs, and signed shirts. Provenance and COA matter for value.',
    conditionGrades: ['Mint', 'Near Mint', 'Very Good (No folds)', 'Good (Light crease)', 'Fair'],
    typicalBudgetRange: '£10–£100 for starters',
    valueHistoryNote: 'Memorabilia values track sporting events. Condition and authentication are key.',
  },
};

export const StartCollectingPage: React.FC = () => {
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const { firebaseUser } = useAuth();

  const category = (categorySlug as CategorySlug) || 'football_cards';
  const catConfig = CATEGORIES[category];
  const guide = CATEGORY_GUIDES[category];

  const [listings, setListings] = useState<MarketplaceListingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowingCategory, setIsFollowingCategory] = useState(false);
  const [followToggling, setFollowToggling] = useState(false);

  useDocumentMeta({
    title: catConfig
      ? `Start collecting ${catConfig.label} · Fanzeum`
      : 'Start Collecting · Fanzeum',
    description: `Beginner guide for ${catConfig?.label || 'collecting'}. What to look for, condition grades, and starter picks under £100.`,
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const items = await fetchMarketplaceListingsByCategory(category, 100, 12);
        if (!active) return;
        setListings(items);

        if (firebaseUser?.uid) {
          const following = await checkIsFollowing(firebaseUser.uid, 'category', category);
          if (!active) return;
          setIsFollowingCategory(following);
        }
      } catch (err) {
        console.error('Load starter picks error:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [category, firebaseUser?.uid]);

  const handleToggleFollow = async () => {
    if (!firebaseUser?.emailVerified) return;
    const nextState = !isFollowingCategory;
    setIsFollowingCategory(nextState);
    setFollowToggling(true);

    try {
      if (nextState) {
        await followTarget({
          followerId: firebaseUser.uid,
          targetType: 'category',
          targetId: category,
          isVerifiedUser: true,
        });
      } else {
        await unfollowTarget({
          followerId: firebaseUser.uid,
          targetType: 'category',
          targetId: category,
          isVerifiedUser: true,
        });
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
      setIsFollowingCategory(!nextState);
    } finally {
      setFollowToggling(false);
    }
  };

  if (!catConfig) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
        <EmptyState
          title="Category not found"
          description="We could not find a collecting guide for that category."
          action={<Button onClick={() => window.history.back()}>Go back</Button>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-10">
      {/* Hero Section */}
      <Card className="p-6 sm:p-8 space-y-4 border-brass/30 bg-surface">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink">
              Start collecting {catConfig.label}
            </h1>
            <p className="text-base text-muted max-w-2xl leading-relaxed">
              {catConfig.tagline}
            </p>
          </div>
          {firebaseUser && (
            <Button
              variant={isFollowingCategory ? 'secondary' : 'primary'}
              size="sm"
              disabled={followToggling}
              onClick={handleToggleFollow}
              aria-label={
                isFollowingCategory
                  ? `Unfollow ${catConfig.shortLabel}`
                  : `Follow ${catConfig.shortLabel}`
              }
            >
              {isFollowingCategory ? (
                <>
                  <BookmarkCheck className="w-4 h-4 text-brass" strokeWidth={1.5} />
                  <span>Following {catConfig.shortLabel}</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" strokeWidth={1.5} />
                  <span>Follow {catConfig.shortLabel}</span>
                </>
              )}
            </Button>
          )}
        </div>
      </Card>

      {/* Beginner Guide */}
      <div className="space-y-6">
        <h2 className="text-2xl font-display font-semibold text-ink">Beginner guide</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-5">
            <h3 className="text-lg font-display font-semibold text-ink mb-3">What to look for</h3>
            <p className="text-sm text-muted leading-relaxed">{guide.whatToLookFor}</p>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-display font-semibold text-ink mb-3">Condition grades</h3>
            <ul className="text-sm text-muted space-y-1.5">
              {guide.conditionGrades.map((grade) => (
                <li key={grade} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brass/60"></span>
                  <span>{grade}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="text-lg font-display font-semibold text-ink mb-3">Typical starter budget</h3>
          <p className="text-sm text-muted leading-relaxed">{guide.typicalBudgetRange}</p>
          <p className="text-sm text-muted mt-2 leading-relaxed">{guide.valueHistoryNote}</p>
        </Card>
      </div>

      {/* Starter Picks */}
      <div className="space-y-6">
        <h2 className="text-2xl font-display font-semibold text-ink">Starter picks under £100</h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-80" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-6 h-6" strokeWidth={1.5} />}
            title="Marketplace opening soon"
            description="We're preparing authenticated pieces for new collectors. Check back soon for verified starter picks in this category."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map((listing) => (
              <Link key={listing.id} to={`/marketplace/${listing.id}`} className="block">
                <Card interactive className="overflow-hidden flex flex-col h-full">
                  <div className="aspect-[4/3] bg-surface-raised relative overflow-hidden flex items-center justify-center p-3">
                    <CollectorImage
                      src={listing.photos?.[0]?.url || ''}
                      alt={listing.title}
                      category={listing.category}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-contain"
                    />
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-brass text-brass-fg text-xs font-mono font-bold shadow-md">
                      {formatGbp(listing.priceGbp)}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-display font-semibold text-ink line-clamp-1">
                        {listing.title}
                      </h3>
                      <p className="text-xs text-muted line-clamp-2">
                        {listing.description}
                      </p>
                    </div>
                    <div className="pt-2 text-xs text-muted font-mono">
                      @{listing.sellerHandle}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

import { unfollowTarget } from '../../lib/followRepo';

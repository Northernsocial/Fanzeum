import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Info,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { CATEGORIES, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { formatGbp, formatGbpRange } from '../../lib/entitlements';
import { explorePublicItems } from '../../lib/firestoreRepo';
import { getRelatedWorthItems, getWorthItemBySlug } from '../../lib/worthRepo';
import type { CollectibleItemRecord } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { PieceStage } from '../../components/ui/PieceStage';
import { Placard } from '../../components/ui/Placard';
import { WorthCard } from './WorthCard';

export const WorthItemPage: React.FC = () => {
  const { categorySlug, itemSlug } = useParams<{
    categorySlug: string;
    itemSlug: string;
  }>();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();

  const catKey = (categorySlug as CategorySlug) || 'football_cards';
  const catConfig = CATEGORIES[catKey];
  const itemGuide = getWorthItemBySlug(catKey, itemSlug || '');

  const [communityPieces, setCommunityPieces] = useState<CollectibleItemRecord[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(false);

  useDocumentMeta({
    title: itemGuide
      ? `What is a ${itemGuide.title} worth? (${formatGbpRange(itemGuide.minGbp, itemGuide.maxGbp)})`
      : 'Collector Valuation Guide',
    description: itemGuide
      ? `Find out what a ${itemGuide.title} is worth in the UK today. Recent price range ${formatGbpRange(itemGuide.minGbp, itemGuide.maxGbp)}, grading factor guide, and ${itemGuide.baselineCollectorCount}+ Fanzeum collectors tracking it.`
      : 'Free UK collector valuation guide on Fanzeum.',
    image: itemGuide?.imageUrl,
  });

  // Query actual community showcases matching this item title or keyword
  useEffect(() => {
    if (!itemGuide) return;
    let active = true;
    async function loadCommunity() {
      setLoadingCommunity(true);
      try {
        const searchKeyword = itemGuide.shortTitle.split(' ')[0] || itemGuide.title.split(' ')[0];
        const res = await explorePublicItems({
          category: itemGuide.category,
          search: searchKeyword,
          pageSize: 4,
          pageIndex: 0,
        });
        if (active) {
          setCommunityPieces(res.items);
        }
      } catch {
        // Quiet fallback
      } finally {
        if (active) setLoadingCommunity(false);
      }
    }
    void loadCommunity();
    return () => {
      active = false;
    };
  }, [itemGuide]);

  if (!itemGuide || !catConfig) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-semibold text-ink">Valuation guide not found</h1>
        <p className="text-muted text-sm">
          We couldn’t find this specific piece guide. Explore other {catConfig?.shortLabel || 'collector'} guides below.
        </p>
        <Button onClick={() => navigate(`/worth/${catKey}`)}>
          Back to {catConfig?.shortLabel || 'Valuation'} Guides
        </Button>
      </div>
    );
  }

  const related = getRelatedWorthItems(itemGuide, 3);
  const totalCollectors = itemGuide.baselineCollectorCount + communityPieces.length;

  const handleCtaClick = () => {
    if (firebaseUser) {
      navigate('/add');
    } else {
      navigate('/onboarding');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-12">
      {/* Navigation Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link to="/worth" className="hover:text-ink">
          Valuation Guides
        </Link>
        <span aria-hidden="true">/</span>
        <Link to={`/worth/${catConfig.slug}`} className="hover:text-ink">
          {catConfig.shortLabel}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink font-medium truncate max-w-xs">{itemGuide.shortTitle}</span>
      </nav>

      {/* Main Hero Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Valuation Placard & Price Card */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brass/10 border border-brass/30 text-xs font-mono text-brass">
              <CategoryIcon category={itemGuide.category} className="w-3.5 h-3.5" />
              <span>{catConfig.label} Price Guide</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink leading-tight">
              {itemGuide.title}
            </h1>
            <p className="text-base sm:text-lg text-muted leading-relaxed">
              {itemGuide.description}
            </p>
          </div>

          {/* Core Price & Collector Stat Box */}
          <Card raised className="p-6 sm:p-8 space-y-6 border-brass/40 bg-surface">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border">
              <div>
                <span className="text-xs font-mono text-muted uppercase tracking-wider">
                  Estimated UK Value Range
                </span>
                <div className="text-3xl sm:text-4xl font-bold font-mono text-ink mt-1">
                  {formatGbpRange(itemGuide.minGbp, itemGuide.maxGbp)}
                </div>
                <div className="text-xs font-mono text-brass mt-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Median realised guide: ~{formatGbp(itemGuide.medianGbp)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised border border-border">
                <Users className="w-5 h-5 text-brass" />
                <div>
                  <div className="text-base font-bold font-mono text-ink">{totalCollectors}</div>
                  <div className="text-[11px] text-muted">Collectors own or track this</div>
                </div>
              </div>
            </div>

            {/* Condition Tiers Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Recent Realised Prices by Grade</h3>
                <span className="text-xs font-mono text-muted">UK collector sales</span>
              </div>

              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-surface-raised">
                {itemGuide.conditionTiers.map((tier) => (
                  <div
                    key={tier.grade}
                    className="p-3.5 sm:px-4 flex items-center justify-between gap-4 text-sm"
                  >
                    <div>
                      <div className="font-medium text-ink">{tier.grade}</div>
                      {tier.notes && (
                        <div className="text-xs text-muted mt-0.5">{tier.notes}</div>
                      )}
                    </div>
                    <div className="font-mono font-semibold text-ink text-right">
                      {formatGbp(tier.priceGbp)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Honest Notice */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-raised/70 border border-border text-xs text-muted leading-relaxed">
              <Info className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={1.5} />
              <span>
                Valuation ranges represent recent UK sales across auction houses, specialist dealers, and online collector marketplaces. AI valuation tools and guides are estimates, not an official certificate of authenticity or grading guarantee.
              </span>
            </div>
          </Card>
        </div>

        {/* Right Column: CTA Box & Specifications */}
        <div className="lg:col-span-5 space-y-6">
          {/* Big Actionable Sign-up / Upload Card */}
          <Card raised className="p-6 sm:p-7 space-y-5 border-brass/50 bg-surface-raised text-center">
            <div className="w-12 h-12 rounded-2xl bg-brass/15 border border-brass/40 text-brass flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" strokeWidth={1.5} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-display font-semibold text-ink">Got one of these?</h2>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                Add it to your personal showcase, check variants, and watch your collection value grow in £ GBP.
              </p>
            </div>

            <Button size="lg" fullWidth onClick={handleCtaClick}>
              {firebaseUser ? 'Add this piece to your showcase' : 'Value yours free: sign up'}
            </Button>

            <div className="text-[11px] font-mono text-muted flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brass" />
              <span>Free forever for up to 30 showcase pieces</span>
            </div>
          </Card>

          {/* Reference Placard Specifications */}
          <Card className="divide-y divide-border overflow-hidden">
            <div className="px-5 py-3.5 bg-surface-raised flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">Catalogue Reference</h3>
              <span className="text-xs font-mono text-muted">{itemGuide.year}</span>
            </div>

            {Object.entries(itemGuide.specifications).map(([key, val]) => (
              <div key={key} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                <span className="text-muted">{key}</span>
                <span className="font-mono text-ink font-medium">{val}</span>
              </div>
            ))}

            {itemGuide.notableVariants && itemGuide.notableVariants.length > 0 && (
              <div className="px-5 py-3 space-y-1 text-sm">
                <span className="text-xs font-mono text-brass">Notable Variants &amp; Parallels</span>
                <div className="text-ink text-xs leading-relaxed">
                  {itemGuide.notableVariants.join(' · ')}
                </div>
              </div>
            )}
          </Card>

          {/* Key Valuation Factors Checklist */}
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brass" />
              <span>What affects the price?</span>
            </h3>
            <ul className="space-y-2 text-xs text-muted leading-relaxed">
              {itemGuide.keyFactors.map((factor, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-brass font-mono">✦</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Community Showcases Featuring Related Pieces */}
      {communityPieces.length > 0 && (
        <section className="pt-8 border-t border-border space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-display font-semibold text-ink">
                Showcased by Fanzeum Collectors
              </h2>
              <p className="text-sm text-muted mt-1">
                Real collector pieces currently displayed across our UK showcases.
              </p>
            </div>
            <Link to="/explore" className="text-sm font-medium text-brass hover:underline">
              Explore all →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {communityPieces.map((piece) => (
              <div key={piece.id} className="space-y-3">
                <Link to={`/i/${piece.id}`} className="block">
                  <PieceStage item={piece} />
                </Link>
                <div className="space-y-1 px-0.5">
                  <Link to={`/i/${piece.id}`} className="block hover:text-brass transition-colors">
                    <Placard item={piece} size="sm" />
                  </Link>
                  <Link
                    to={`/@${piece.ownerHandle}`}
                    className="inline-block text-xs font-mono text-muted hover:text-ink"
                  >
                    @{piece.ownerHandle}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related Valuation Guides */}
      {related.length > 0 && (
        <section className="pt-8 border-t border-border space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-display font-semibold text-ink">
              More {catConfig.shortLabel} Valuation Guides
            </h2>
            <Link
              to={`/worth/${catConfig.slug}`}
              className="text-sm font-medium text-brass hover:underline"
            >
              View category →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {related.map((rel) => (
              <WorthCard key={`${rel.category}_${rel.slug}`} item={rel} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

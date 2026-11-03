import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  FolderPlus,
  ScanLine,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_LIST } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { DEMO_USERS, FEATURED_DEMO_PIECES } from '../../data/demoCatalog';
import { formatGbpRange } from '../../lib/entitlements';
import {
  listFeaturedCollections,
  listOwnerCollections,
  listOwnerItems,
} from '../../lib/firestoreRepo';
import type { CollectibleItemRecord, CollectionRecord } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { CompletionRing } from '../../components/ui/CompletionRing';
import { Skeleton } from '../../components/ui/EmptyState';
import { PieceStage } from '../../components/ui/PieceStage';
import { FreshFindsFeed } from '../../components/FreshFindsFeed';
import { FreshFindsStrip } from '../../components/FreshFindsStrip';
import { Placard } from '../../components/ui/Placard';

export const HomePage: React.FC = () => {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const navigate = useNavigate();

  useDocumentMeta({
    title: 'Your Collection, Lit Properly',
    description:
      'Snap cards, coins, stamps, comics, vinyl, and toys to identify printings, check realistic UK £ values, and exhibit your sets.',
  });

  const [featuredCollections, setFeaturedCollections] = useState<CollectionRecord[]>([]);
  const [myCollections, setMyCollections] = useState<CollectionRecord[]>([]);
  const [myRecentItems, setMyRecentItems] = useState<CollectibleItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [maskShowcaseValue, setMaskShowcaseValue] = useState(false);

  const spotlightPieces = useMemo(
    () => (FEATURED_DEMO_PIECES.length > 0 ? FEATURED_DEMO_PIECES : []),
    [],
  );

  useEffect(() => {
    if (spotlightPieces.length <= 1) return;
    const id = window.setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % spotlightPieces.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [spotlightPieces.length]);

  useEffect(() => {
    setMaskShowcaseValue(Boolean(profile?.hideValues));
  }, [profile?.hideValues]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const featured = await listFeaturedCollections();
        if (!active) return;
        setFeaturedCollections(featured);

        if (firebaseUser?.emailVerified) {
          const [cols, items] = await Promise.all([
            listOwnerCollections(firebaseUser.uid, firebaseUser.uid, 30),
            listOwnerItems(firebaseUser.uid, 12),
          ]);
          if (!active) return;
          setMyCollections(cols);
          setMyRecentItems(items.slice(0, 6));
        } else {
          setMyCollections([]);
          setMyRecentItems([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [firebaseUser?.uid, firebaseUser?.emailVerified]);

  const myTotals = useMemo(() => {
    const min = myCollections.reduce((sum, c) => sum + (c.estimatedTotalMinGbp || 0), 0);
    const max = myCollections.reduce((sum, c) => sum + (c.estimatedTotalMaxGbp || 0), 0);
    const pieces = myCollections.reduce((sum, c) => sum + (c.itemCount || 0), 0);
    return { min, max, pieces };
  }, [myCollections]);

  const activeSpotlight = spotlightPieces[spotlightIndex];

  return (
    <div className="space-y-16 sm:space-y-24 pb-24">
      {/* Logged-in Personal Showcase Strip OR Logged-out After Hours Hero */}
      {firebaseUser && profile ? (
        <section className="border-b border-border bg-surface/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-12 space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <p className="text-sm font-mono text-brass">
                  @{profile.handle}
                  {profile.location && !profile.hideLocation ? ` · ${profile.location}` : ''}
                </p>
                <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink mt-1">
                  Welcome back, {profile.displayName.split(' ')[0]}
                </h1>
                <p className="text-base text-muted mt-2 max-w-2xl">
                  {profile.onboardingCompleted
                    ? 'Snap a new pickup to check its reference and £ guide, or open any set below.'
                    : 'Take 30 seconds to pick your collecting categories and starter set.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {!profile.onboardingCompleted && (
                  <Button variant="secondary" onClick={() => navigate('/onboarding')}>
                    Finish setup
                  </Button>
                )}
                <Button variant="secondary" onClick={() => navigate(`/@${profile.handle}`)}>
                  <FolderPlus className="w-4 h-4" strokeWidth={1.5} />
                  <span>My showcase</span>
                </Button>
                <Button onClick={() => navigate('/add')}>
                  <Camera className="w-4 h-4" strokeWidth={1.5} />
                  <span>Add a piece</span>
                </Button>
              </div>
            </div>

            {/* Clean Collector Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card raised className="p-5">
                <div className="text-sm text-muted">Collections</div>
                <div className="text-2xl font-mono font-semibold tabular-nums text-ink mt-1">
                  {myCollections.length}
                </div>
              </Card>
              <Card raised className="p-5">
                <div className="text-sm text-muted">Pieces catalogued</div>
                <div className="text-2xl font-mono font-semibold tabular-nums text-ink mt-1">
                  {myTotals.pieces}
                </div>
              </Card>
              <Card raised className="p-5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-muted">Estimated showcase value</div>
                  <div className="text-2xl font-mono font-semibold tabular-nums text-brass mt-1">
                    {maskShowcaseValue
                      ? 'Hidden'
                      : myTotals.max > 0
                        ? formatGbpRange(myTotals.min, myTotals.max)
                        : '£0'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMaskShowcaseValue((v) => !v)}
                  aria-label={maskShowcaseValue ? 'Show showcase value' : 'Hide showcase value'}
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-muted hover:text-ink hover:bg-surface transition-colors cursor-pointer"
                >
                  {maskShowcaseValue ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
              </Card>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative overflow-hidden border-b border-border after-hours-spotlight">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <p className="text-sm font-mono text-brass tracking-wide">
                Football cards · Coins · Stamps · Comics · Vinyl · Toys
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-semibold text-ink leading-[1.08] tracking-tight">
                Your collection, lit like a private gallery after closing.
              </h1>
              <p className="text-lg text-muted max-w-xl leading-relaxed">
                Snap front and back. Fanzeum spots the set, Stanley Gibbons or Spink number,
                condition, and realistic UK £ price range—then displays every slab, coin, and 45
                the way it deserves.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button size="lg" onClick={openAuthModal}>
                  <span>Start your showcase</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                </Button>
                <Button variant="secondary" size="lg" onClick={() => navigate('/explore')}>
                  Explore 190+ pieces
                </Button>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span>Free collector showcases</span>
                <span aria-hidden="true">·</span>
                <span>Valuations in £ GBP</span>
                <span aria-hidden="true">·</span>
                <span>Installable on phone &amp; desktop</span>
              </div>
            </div>

            {/* Lit Spotlight Piece */}
            <div className="lg:col-span-5">
              {activeSpotlight && (
                <div className="max-w-sm mx-auto space-y-4">
                  <Link to={`/i/${activeSpotlight.id}`} className="block">
                    <PieceStage item={activeSpotlight} priority />
                  </Link>
                  <div className="px-1 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        to={`/i/${activeSpotlight.id}`}
                        className="hover:text-brass transition-colors"
                      >
                        <Placard item={activeSpotlight} size="sm" />
                      </Link>
                      <Link
                        to={`/@${activeSpotlight.ownerHandle}`}
                        className="inline-block mt-1 text-xs font-mono text-muted hover:text-ink"
                      >
                        From @{activeSpotlight.ownerHandle}
                      </Link>
                    </div>

                    {spotlightPieces.length > 1 && (
                      <div className="flex items-center gap-1.5 pt-1 shrink-0">
                        {spotlightPieces.map((p, idx) => (
                          <button
                            key={p.id}
                            type="button"
                            aria-label={`Show spotlight piece ${idx + 1}`}
                            onClick={() => setSpotlightIndex(idx)}
                            className={`h-2 rounded-full transition-all cursor-pointer ${
                              idx === spotlightIndex ? 'w-6 bg-brass' : 'w-2 bg-border hover:bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Logged-in User's Collections & Recent Pieces */}
      {firebaseUser && myCollections.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-8 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
                Your collections
              </h2>
              <p className="text-base text-muted mt-1">
                Sets and binders in your showcase.
              </p>
            </div>
            {profile && (
              <Link
                to={`/@${profile.handle}`}
                className="text-sm font-medium text-brass hover:underline whitespace-nowrap"
              >
                Open full showcase →
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myCollections.slice(0, 6).map((col) => (
              <Link key={col.id} to={`/c/${col.id}`} className="block">
                <Card interactive className="overflow-hidden h-full flex flex-col">
                  <div className="aspect-[16/10] bg-surface-raised border-b border-border p-4 flex items-center justify-center after-hours-spotlight">
                    <CollectorImage
                      src={col.coverImageUrl}
                      alt={col.title}
                      category={col.category}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="text-xs text-muted flex items-center gap-2">
                        <span>{CATEGORIES[col.category]?.shortLabel || col.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{col.visibility}</span>
                      </div>
                      <h3 className="text-xl font-display font-semibold text-ink mt-1 line-clamp-2">
                        {col.title}
                      </h3>
                    </div>

                    <div className="pt-2 border-t border-border flex items-center justify-between gap-3">
                      {col.setTargetCount > 0 ? (
                        <CompletionRing
                          current={col.itemCount}
                          target={col.setTargetCount}
                          size={44}
                        />
                      ) : (
                        <span className="text-sm font-mono text-muted">
                          {col.itemCount} {col.itemCount === 1 ? 'piece' : 'pieces'}
                        </span>
                      )}
                      {!maskShowcaseValue && col.estimatedTotalMaxGbp > 0 && (
                        <span className="text-sm font-mono tabular-nums text-brass">
                          {formatGbpRange(col.estimatedTotalMinGbp, col.estimatedTotalMaxGbp)}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {myRecentItems.length > 0 && (
            <div className="pt-6 space-y-4">
              <h3 className="text-xl font-display font-semibold text-ink">
                Recently added to your showcase
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {myRecentItems.slice(0, 3).map((item) => (
                  <Link key={item.id} to={`/i/${item.id}`} className="block group">
                    <div className="space-y-3">
                      <PieceStage item={item} interactive={false} />
                      <Placard item={item} hideValues={maskShowcaseValue} size="sm" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Fresh Finds Strip */}
      <FreshFindsStrip />

      {/* Featured Collections Row */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
              Featured collections
            </h2>
            <p className="text-base text-muted mt-1">
              Standout UK sets—from complete Mexico 70 albums to line-engraved Victorian stamps.
            </p>
          </div>
          <Link
            to="/explore"
            className="text-sm font-medium text-brass hover:underline whitespace-nowrap"
          >
            Browse all pieces →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {featuredCollections.slice(0, 3).map((col) => (
              <Card key={col.id} interactive className="overflow-hidden flex flex-col justify-between">
                <Link to={`/c/${col.id}`} className="block">
                  <div className="aspect-[4/3] bg-surface-raised border-b border-border p-6 flex items-center justify-center after-hours-spotlight">
                    <CollectorImage
                      src={col.coverImageUrl}
                      alt={col.title}
                      category={col.category}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-6 space-y-3">
                    <div className="text-xs text-muted flex items-center gap-2">
                      <span>{CATEGORIES[col.category]?.shortLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">@{col.ownerHandle}</span>
                    </div>
                    <h3 className="text-2xl font-display font-semibold text-ink leading-snug">
                      {col.title}
                    </h3>
                    <p className="text-sm text-muted line-clamp-2 leading-relaxed">{col.story}</p>
                  </div>
                </Link>

                <div className="px-6 pb-6 pt-3 border-t border-border flex items-center justify-between gap-3">
                  {col.setTargetCount > 0 ? (
                    <CompletionRing current={col.itemCount} target={col.setTargetCount} size={46} />
                  ) : (
                    <span className="text-sm font-mono text-muted">{col.itemCount} pieces</span>
                  )}
                  <span className="text-sm font-mono tabular-nums text-brass">
                    {formatGbpRange(col.estimatedTotalMinGbp, col.estimatedTotalMaxGbp)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Personalised Fresh Finds Feed (Priority Categories & Following Tab) */}
      <FreshFindsFeed />

      {/* Browse by Category */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
            Browse by hobby
          </h2>
          <p className="text-base text-muted mt-1">
            Proper grading scales and catalogue fields for every shelf, longbox, and coin tray.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORY_LIST.map((cat) => (
            <Link key={cat.slug} to={`/category/${cat.slug}`} className="block">
              <Card interactive className="p-5 h-full flex flex-col justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border text-brass flex items-center justify-center">
                  <CategoryIcon category={cat.slug} className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-semibold text-ink">{cat.shortLabel}</h3>
                  <p className="text-sm text-muted mt-1 leading-relaxed">{cat.tagline}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Meet UK Collectors */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
            Showcases to explore
          </h2>
          <p className="text-base text-muted mt-1">
            Six UK collectors sharing graded slabs, sovereign runs, Northern Soul 45s, and Palitoy cardbacks.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEMO_USERS.map((u) => (
            <Link key={u.uid} to={`/@${u.handle}`} className="block">
              <Card interactive className="p-5 h-full space-y-3">
                <div className="flex items-center gap-3.5">
                  <CollectorImage
                    src={u.avatarUrl}
                    alt={u.displayName}
                    className="w-12 h-12 rounded-full border border-border shrink-0"
                    imgClassName="w-full h-full object-cover rounded-full"
                  />
                  <div className="min-w-0">
                    <div className="text-base font-display font-semibold text-ink truncate">
                      {u.displayName}
                    </div>
                    <div className="text-xs font-mono text-brass truncate">
                      @{u.handle} · {u.location}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted line-clamp-2 leading-relaxed">{u.bio}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works (3 Crisp Collector Steps) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8">
        <Card raised className="p-6 sm:p-10 space-y-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
              From phone snap to lit showcase in under a minute
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-surface border border-border text-brass flex items-center justify-center">
                <Camera className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-display font-semibold text-ink">
                01. Snap front &amp; back
              </h3>
              <p className="text-base text-muted leading-relaxed">
                Shoot obverse and reverse, label and runout, or card front and back. Location data is stripped automatically on your device.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-surface border border-border text-brass flex items-center justify-center">
                <ScanLine className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-display font-semibold text-ink">
                02. Check our best guess
              </h3>
              <p className="text-base text-muted leading-relaxed">
                Gemini fills in the set, SG or Spink number, grade, and realistic UK £ value—highlighting anything uncertain so you stay in charge.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-surface border border-border text-brass flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-display font-semibold text-ink">
                03. Exhibit &amp; track sets
              </h3>
              <p className="text-base text-muted leading-relaxed">
                Watch your set completion ring climb, keep what you paid private, and share your @handle link with your group or club.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

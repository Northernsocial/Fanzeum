import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building,
  Calendar,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Palmtree,
  RotateCcw,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  checkIsFollowing,
  fetchFollowerCount,
  followTarget,
  unfollowTarget,
} from '../../lib/followRepo';
import {
  fetchStoreProfile,
  fetchStoreProfileByHandle,
  fetchUserByHandle,
  listStoreMarketplaceListings,
  toggleStoreHolidayMode,
} from '../../lib/firestoreRepo';
import { formatGbp, isVerifiedStore } from '../../lib/entitlements';
import type { MarketplaceListingRecord, StoreProfileRecord, UserProfile } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { VerifiedStoreBadge } from '../../components/VerifiedStoreBadge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { EditStoreModal } from './EditStoreModal';

export const StorefrontPage: React.FC = () => {
  const { handle } = useParams<{ handle: string }>();
  const cleanHandle = (handle || '').replace(/^@+/, '').trim().toLowerCase();

  const { firebaseUser, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [storeUser, setStoreUser] = useState<UserProfile | null>(null);
  const [store, setStore] = useState<StoreProfileRecord | null>(null);
  const [listings, setListings] = useState<MarketplaceListingRecord[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [togglingHoliday, setTogglingHoliday] = useState(false);

  const isOwner = Boolean(
    firebaseUser && storeUser && firebaseUser.uid === storeUser.uid,
  );

  useDocumentMeta({
    title: store?.businessName
      ? `${store.businessName} (@${cleanHandle}) · Storefront`
      : `@${cleanHandle}'s Storefront`,
    description: store?.about || `${cleanHandle}'s dedicated showcase storefront for authenticated UK collectibles.`,
    image: store?.bannerUrl || store?.logoUrl,
  });

  useEffect(() => {
    let active = true;
    async function loadStore() {
      if (!cleanHandle) return;
      setLoading(true);
      try {
        const u = await fetchUserByHandle(cleanHandle);
        if (!active) return;
        setStoreUser(u);

        if (u) {
          const [s, items, count] = await Promise.all([
            fetchStoreProfile(u.uid),
            listStoreMarketplaceListings(u.uid),
            fetchFollowerCount(u.uid, firebaseUser?.uid),
          ]);
          if (!active) return;
          setStore(s);
          setListings(items);
          setFollowersCount(count);

          if (firebaseUser) {
            const following = await checkIsFollowing(firebaseUser.uid, 'user', u.uid);
            if (active) setIsFollowing(following);
          }
        }
      } catch (err) {
        console.error('Error loading storefront:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadStore();
    return () => {
      active = false;
    };
  }, [cleanHandle, firebaseUser]);

  const handleToggleFollow = async () => {
    if (!firebaseUser || !storeUser) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowersCount((prev) => Math.max(0, prev + (next ? 1 : -1)));
    if (next) {
      await followTarget({
        followerId: firebaseUser.uid,
        targetType: 'user',
        targetId: storeUser.uid,
        isVerifiedUser: firebaseUser.emailVerified,
      });
    } else {
      await unfollowTarget({
        followerId: firebaseUser.uid,
        targetType: 'user',
        targetId: storeUser.uid,
        isVerifiedUser: firebaseUser.emailVerified,
      });
    }
  };

  const handleToggleHoliday = async () => {
    if (!firebaseUser || !isOwner || !store) return;
    const nextState = !store.holidayMode;
    setTogglingHoliday(true);
    try {
      await toggleStoreHolidayMode(store.userId, nextState);
      setStore((prev) => (prev ? { ...prev, holidayMode: nextState } : prev));
    } catch (err) {
      console.error('Toggle holiday mode error:', err);
    } finally {
      setTogglingHoliday(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-8">
        <Skeleton className="h-60 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!storeUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-16">
        <EmptyState
          title="Storefront not found"
          description={`No collector or dealer profile exists for @${cleanHandle}.`}
          action={
            <Link to="/marketplace">
              <Button>Browse Marketplace</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const verified = isVerifiedStore(store);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10 pb-28 space-y-8">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          to={`/@${cleanHandle}`}
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors font-mono"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span>View Collector Showcase</span>
        </Link>

        {isOwner && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditModalOpen(true)}
          >
            <Settings className="w-4 h-4 text-brass" strokeWidth={1.5} />
            <span>Storefront Settings</span>
          </Button>
        )}
      </div>

      {/* Storefront Hero / Banner */}
      <div className="rounded-3xl border border-border bg-surface overflow-hidden relative shadow-lg">
        {/* Banner Area */}
        <div className="h-44 sm:h-64 bg-gradient-to-r from-surface-raised via-brass/15 to-surface-raised relative overflow-hidden">
          {store?.bannerUrl ? (
            <img
              src={store.bannerUrl}
              alt={store.businessName || storeUser.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center opacity-25">
              <Store className="w-24 h-24 text-brass" strokeWidth={1} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-transparent to-transparent" />
        </div>

        {/* Identity & Header Info */}
        <div className="px-6 sm:px-10 pb-8 pt-0 relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            {/* Logo */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-bg bg-surface-raised overflow-hidden shadow-xl shrink-0 flex items-center justify-center">
              {store?.logoUrl || storeUser.avatarUrl ? (
                <img
                  src={store?.logoUrl || storeUser.avatarUrl}
                  alt={store?.businessName || storeUser.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="w-12 h-12 text-brass" strokeWidth={1.5} />
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-4xl font-display font-semibold text-ink">
                  {store?.businessName || storeUser.displayName}
                </h1>
                {verified && <VerifiedStoreBadge />}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted font-mono">
                <span>@{cleanHandle}</span>
                <span>•</span>
                <span>{followersCount} {followersCount === 1 ? 'follower' : 'followers'}</span>
                {storeUser.location && !storeUser.hideLocation && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {storeUser.location}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {!isOwner ? (
              <Button
                variant={isFollowing ? 'secondary' : 'primary'}
                onClick={handleToggleFollow}
              >
                <UserPlus className="w-4 h-4" strokeWidth={1.5} />
                <span>{isFollowing ? 'Following Store' : 'Follow Store'}</span>
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={togglingHoliday}
                onClick={handleToggleHoliday}
              >
                <Palmtree className="w-4 h-4 text-brass" strokeWidth={1.5} />
                <span>{store?.holidayMode ? 'End Holiday Mode' : 'Turn on Holiday Mode'}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Holiday Mode Notice Banner */}
        {store?.holidayMode && (
          <div className="mx-6 sm:mx-10 mb-6 p-4 rounded-xl border border-brass/40 bg-brass/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-brass">
              <Palmtree className="w-5 h-5 shrink-0" strokeWidth={1.5} />
              <span>
                <strong>Store away on holiday:</strong> This seller is currently taking a break. Listings are on display but order checkout is temporarily paused.
              </span>
            </div>
            {isOwner && (
              <Button
                size="sm"
                variant="secondary"
                disabled={togglingHoliday}
                onClick={handleToggleHoliday}
              >
                {togglingHoliday ? 'Updating…' : 'Resume store now'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Details Sidebar & Marketplace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Business, Returns & Story */}
        <div className="lg:col-span-4 space-y-6">
          {/* About Card */}
          <Card className="p-6 space-y-3">
            <h2 className="text-base font-display font-semibold text-ink">About the Store</h2>
            <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
              {store?.about || storeUser.bio || 'Authentic collector items curated with proper provenance and care.'}
            </p>
          </Card>

          {/* Business Details Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-brass" strokeWidth={1.5} />
                <h3 className="text-sm font-display font-semibold text-ink">Registered Business</h3>
              </div>
              {verified && <VerifiedStoreBadge size="sm" />}
            </div>

            <div className="space-y-3 text-xs text-ink/90 font-mono">
              <div>
                <span className="text-muted block text-[11px] font-sans">Trading Name</span>
                <span>{store?.businessName || storeUser.displayName}</span>
              </div>

              {store?.businessAddress && (
                <div>
                  <span className="text-muted block text-[11px] font-sans">Business Address</span>
                  <span className="whitespace-pre-line">{store.businessAddress}</span>
                </div>
              )}

              {store?.companyNumber && (
                <div>
                  <span className="text-muted block text-[11px] font-sans">Companies House No.</span>
                  <span>{store.companyNumber}</span>
                </div>
              )}

              <div>
                <span className="text-muted block text-[11px] font-sans">Seller Identity Status</span>
                <span className={verified ? 'text-ok font-semibold' : 'text-brass'}>
                  {verified ? 'Identity Checked & Verified' : 'Standard Seller'}
                </span>
              </div>
            </div>
          </Card>

          {/* Returns & Terms Card */}
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-display font-semibold text-ink">
              <RotateCcw className="w-4 h-4 text-brass" strokeWidth={1.5} />
              <h3>Returns &amp; Guarantee</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {store?.returnsPolicy ||
                '14-day UK distance selling returns accepted. Every order is packed to archival standards.'}
            </p>
            <div className="pt-2 border-t border-border flex items-center gap-2 text-[11px] text-muted font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-ok shrink-0" strokeWidth={2} />
              <span>Covered by Fanzeum Buyer Protection</span>
            </div>
          </Card>
        </div>

        {/* Right Column: Active Pieces For Sale */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-xl font-display font-semibold text-ink">
                Pieces For Sale ({listings.length})
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Authentic fixed-price pieces available directly from this store.
              </p>
            </div>
            {isOwner && (
              <Link to="/marketplace">
                <Button size="sm" variant="secondary">
                  <ShoppingBag className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />
                  <span>List more pieces</span>
                </Button>
              </Link>
            )}
          </div>

          {listings.length === 0 ? (
            <EmptyState
              icon={<Store className="w-6 h-6" strokeWidth={1.5} />}
              title="No active listings"
              description={
                isOwner
                  ? 'You do not have any active pieces listed for sale in your storefront yet.'
                  : 'This store currently has no pieces listed for sale. Check back soon or visit their showcase.'
              }
              action={
                isOwner ? (
                  <Link to="/explore">
                    <Button>Select pieces to list</Button>
                  </Link>
                ) : (
                  <Link to={`/@${cleanHandle}`}>
                    <Button variant="secondary">Browse @{cleanHandle}&apos;s Showcase</Button>
                  </Link>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {listings.map((item) => (
                <Link
                  key={item.id}
                  to={`/marketplace/${item.id}`}
                  className="group block"
                >
                  <Card interactive className="overflow-hidden flex flex-col h-full">
                    <div className="aspect-[4/3] bg-surface-raised relative overflow-hidden flex items-center justify-center p-3">
                      <CollectorImage
                        src={item.photos?.[0]?.url || ''}
                        alt={item.title}
                        category={item.category}
                        className="w-full h-full"
                        imgClassName="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-brass text-brass-fg text-xs font-mono font-bold shadow-md">
                        {formatGbp(item.priceGbp)}
                      </div>
                      {store?.holidayMode && (
                        <div className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-md bg-bg/85 backdrop-blur text-[11px] font-mono text-brass border border-brass/40">
                          Paused for holiday
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted font-mono mb-1">
                          <span>Condition: {item.condition}</span>
                          <span className="uppercase">{item.category.replace('_', ' ')}</span>
                        </div>
                        <h3 className="text-base font-display font-semibold text-ink line-clamp-1 group-hover:text-brass transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs text-muted line-clamp-2 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
                        <span className="text-muted">UK Insured Delivery</span>
                        <span className="text-brass">View piece →</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Store Modal */}
      {isOwner && (
        <EditStoreModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          store={store}
          onSaved={(updated) => setStore(updated)}
        />
      )}
    </div>
  );
};

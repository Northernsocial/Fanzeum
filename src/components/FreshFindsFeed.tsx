import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Flame, Heart, MessageSquare, Sparkles, Users } from 'lucide-react';
import { CATEGORIES, CATEGORY_LIST, type CategorySlug } from '../config/categories';
import { useAuth } from '../contexts/AuthContext';
import { explorePublicItems, listOwnerItems } from '../lib/firestoreRepo';
import {
  fetchFollowedCategories,
  fetchFollowedCollectors,
  followTarget,
  unfollowTarget,
} from '../lib/followRepo';
import {
  fetchItemComments,
  fetchItemLikeState,
  fetchItemSaveState,
  toggleItemLike,
  toggleItemSave,
} from '../lib/socialRepo';
import type { CollectibleItemRecord } from '../types/domain';
import { Button } from './ui/Button';
import { CategoryIcon } from './ui/CategoryIcon';
import { EmptyState, Skeleton } from './ui/EmptyState';
import { PieceStage } from './ui/PieceStage';
import { Placard } from './ui/Placard';
import { ItemSignalButtons } from './ItemSignalButtons';
import { Tabs } from './ui/Tabs';

type FreshFindsTab = 'all' | 'following';

export const FreshFindsFeed: React.FC = () => {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<FreshFindsTab>('all');
  const [items, setItems] = useState<CollectibleItemRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Social stats state (likes, saves, comments)
  const [socialStats, setSocialStats] = useState<
    Record<
      string,
      {
        liked: boolean;
        likeCount: number;
        saved: boolean;
        saveCount: number;
        commentsCount: number;
      }
    >
  >({});

  // Follow states
  const [followedCategories, setFollowedCategories] = useState<Set<CategorySlug>>(new Set());
  const [followedCollectors, setFollowedCollectors] = useState<Set<string>>(new Set());
  const [heavyCategories, setHeavyCategories] = useState<Set<CategorySlug>>(new Set());
  const [togglingCategory, setTogglingCategory] = useState<string | null>(null);

  // Filter by category within Fresh Finds (optional quick filter)
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(12);

  const loadFollowData = useCallback(async () => {
    const uid = firebaseUser?.uid || 'guest_user';
    const [cats, collectors] = await Promise.all([
      fetchFollowedCategories(uid),
      fetchFollowedCollectors(uid),
    ]);
    setFollowedCategories(new Set(cats));
    setFollowedCollectors(new Set(collectors));

    // If user is verified and has items, calculate categories with 10+ pieces
    if (firebaseUser?.emailVerified) {
      try {
        const myItems = await listOwnerItems(firebaseUser.uid, 200);
        const counts: Partial<Record<CategorySlug, number>> = {};
        for (const it of myItems) {
          counts[it.category] = (counts[it.category] || 0) + 1;
        }
        const heavy = new Set<CategorySlug>();
        for (const [cat, count] of Object.entries(counts)) {
          if ((count || 0) >= 10) heavy.add(cat as CategorySlug);
        }
        setHeavyCategories(heavy);
      } catch {
        // Continue with empty heavy categories
      }
    } else {
      setHeavyCategories(new Set());
    }
  }, [firebaseUser?.uid, firebaseUser?.emailVerified]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [res] = await Promise.all([
          explorePublicItems({ sortBy: 'newest', pageSize: 120 }),
          loadFollowData(),
        ]);
        if (!active) return;
        setItems(res.items);

        // Fetch social stats for initial displayed items
        const statsMap: typeof socialStats = {};
        await Promise.all(
          res.items.slice(0, 24).map(async (itm) => {
            const [likeRes, saveRes, comments] = await Promise.all([
              fetchItemLikeState(itm.id, firebaseUser?.uid),
              fetchItemSaveState(itm.id, firebaseUser?.uid),
              fetchItemComments(itm.id),
            ]);
            statsMap[itm.id] = {
              liked: likeRes.liked,
              likeCount: likeRes.count,
              saved: saveRes.saved,
              saveCount: saveRes.count,
              commentsCount: comments.length,
            };
          }),
        );
        if (active) {
          setSocialStats(statsMap);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadFollowData, firebaseUser?.uid]);

  const handleToggleLike = async (itemId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firebaseUser) {
      openAuthModal();
      return;
    }

    const current = socialStats[itemId] || {
      liked: false,
      likeCount: 0,
      saved: false,
      saveCount: 0,
      commentsCount: 0,
    };
    const nextLiked = !current.liked;
    const nextCount = Math.max(0, current.likeCount + (nextLiked ? 1 : -1));

    setSocialStats((prev) => ({
      ...prev,
      [itemId]: {
        ...current,
        liked: nextLiked,
        likeCount: nextCount,
      },
    }));

    try {
      await toggleItemLike({
        itemId,
        uid: firebaseUser.uid,
        isVerifiedUser: Boolean(firebaseUser.emailVerified),
      });
    } catch (err) {
      console.error('Failed to toggle like:', err);
      // Revert on error
      setSocialStats((prev) => ({
        ...prev,
        [itemId]: current,
      }));
    }
  };

  const handleToggleSave = async (itemId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firebaseUser) {
      openAuthModal();
      return;
    }

    const current = socialStats[itemId] || {
      liked: false,
      likeCount: 0,
      saved: false,
      saveCount: 0,
      commentsCount: 0,
    };
    const nextSaved = !current.saved;
    const nextCount = Math.max(0, current.saveCount + (nextSaved ? 1 : -1));

    setSocialStats((prev) => ({
      ...prev,
      [itemId]: {
        ...current,
        saved: nextSaved,
        saveCount: nextCount,
      },
    }));

    try {
      await toggleItemSave({
        itemId,
        uid: firebaseUser.uid,
        isVerifiedUser: Boolean(firebaseUser.emailVerified),
      });
    } catch (err) {
      console.error('Failed to toggle save:', err);
      setSocialStats((prev) => ({
        ...prev,
        [itemId]: current,
      }));
    }
  };

  // Handle follow/unfollow category directly from Fresh Finds
  const handleToggleCategoryFollow = async (cat: CategorySlug) => {
    const uid = firebaseUser?.uid || 'guest_user';
    const isCurrentlyFollowing = followedCategories.has(cat);
    const nextFollowed = new Set(followedCategories);

    if (isCurrentlyFollowing) {
      nextFollowed.delete(cat);
    } else {
      nextFollowed.add(cat);
    }
    setFollowedCategories(nextFollowed);
    setTogglingCategory(cat);

    try {
      if (isCurrentlyFollowing) {
        await unfollowTarget({
          followerId: uid,
          targetType: 'category',
          targetId: cat,
          isVerifiedUser: Boolean(firebaseUser?.emailVerified),
        });
      } else {
        await followTarget({
          followerId: uid,
          targetType: 'category',
          targetId: cat,
          isVerifiedUser: Boolean(firebaseUser?.emailVerified),
        });
      }
    } catch (err) {
      console.error('Failed to toggle category follow:', err);
      // Revert on error
      const reverted = new Set(followedCategories);
      setFollowedCategories(reverted);
    } finally {
      setTogglingCategory(null);
    }
  };

  // Union of followed categories + categories where user has 10+ pieces
  const priorityCategories = useMemo(() => {
    const union = new Set<CategorySlug>(followedCategories);
    for (const c of heavyCategories) {
      union.add(c);
    }
    return union;
  }, [followedCategories, heavyCategories]);

  // Personalised Fresh Finds sorting:
  // Items in priorityCategories appear first (newest first), followed by all other categories (newest first).
  const personalisedItems = useMemo(() => {
    let base = [...items];

    if (selectedCategory !== 'all') {
      base = base.filter((it) => it.category === selectedCategory);
    }

    if (activeTab === 'following') {
      // Finds only from collectors they follow
      return base.filter((it) => followedCollectors.has(it.ownerId));
    }

    // Tab 'all' with personalisation
    if (priorityCategories.size === 0) {
      return base;
    }

    const priorityItems: CollectibleItemRecord[] = [];
    const otherItems: CollectibleItemRecord[] = [];

    for (const item of base) {
      if (priorityCategories.has(item.category)) {
        priorityItems.push(item);
      } else {
        otherItems.push(item);
      }
    }

    return [...priorityItems, ...otherItems];
  }, [items, selectedCategory, activeTab, priorityCategories, followedCollectors]);

  const displayedItems = useMemo(
    () => personalisedItems.slice(0, visibleCount),
    [personalisedItems, visibleCount],
  );

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 space-y-6">
      {/* Feed Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-mono text-brass">
            <Flame className="w-4 h-4" strokeWidth={1.5} />
            <span>Fresh Finds</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink mt-1">
            Fresh Finds across the UK
          </h2>
          <p className="text-base text-muted mt-1">
            {activeTab === 'following'
              ? 'Latest additions from collectors you follow.'
              : priorityCategories.size > 0
                ? 'Personalised for you: pieces from your followed hobbies appear first.'
                : 'Recently catalogued pieces from UK collector showcases.'}
          </p>
        </div>

        <Tabs
          ariaLabel="Fresh Finds feed mode"
          value={activeTab}
          onChange={(tab) => {
            setActiveTab(tab as FreshFindsTab);
            setVisibleCount(12);
          }}
          options={[
            {
              value: 'all',
              label: 'Fresh Finds',
              icon: <Sparkles className="w-4 h-4" strokeWidth={1.5} />,
            },
            {
              value: 'following',
              label: 'Following',
              icon: <Users className="w-4 h-4" strokeWidth={1.5} />,
            },
          ]}
        />
      </div>

      {/* Category Filter & Follow Bar */}
      {activeTab === 'all' && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-3 text-xs text-muted">
            <span>Filter or follow hobbies to personalise your feed:</span>
            {priorityCategories.size > 0 && (
              <span className="font-mono text-brass">
                {priorityCategories.size}{' '}
                {priorityCategories.size === 1 ? 'hobby prioritised' : 'hobbies prioritised'}
              </span>
            )}
          </div>

          <div
            role="group"
            aria-label="Filter hobbies in Fresh Finds"
            className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
          >
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-brass text-brass-fg border-brass'
                  : 'bg-surface text-muted border-border hover:text-ink hover:border-brass/40'
              }`}
            >
              All hobbies
            </button>

            {CATEGORY_LIST.map((cat) => {
              const isSelected = selectedCategory === cat.slug;
              const isFollowed = followedCategories.has(cat.slug);
              const isHeavy = heavyCategories.has(cat.slug);

              return (
                <div
                  key={cat.slug}
                  className={`inline-flex items-center rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-brass/10 border-brass text-ink'
                      : 'bg-surface border-border text-muted hover:border-brass/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(cat.slug)}
                    className="min-h-[38px] px-3 py-1.5 inline-flex items-center gap-2 text-xs font-medium cursor-pointer"
                  >
                    <CategoryIcon category={cat.slug} className="w-3.5 h-3.5 text-brass" />
                    <span className="text-ink">{cat.shortLabel}</span>
                    {isHeavy && (
                      <span
                        title="You have 10+ pieces in this category"
                        className="w-1.5 h-1.5 rounded-full bg-brass shrink-0"
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={togglingCategory === cat.slug}
                    onClick={() => void handleToggleCategoryFollow(cat.slug)}
                    aria-label={
                      isFollowed
                        ? `Unfollow ${cat.shortLabel} category`
                        : `Follow ${cat.shortLabel} category`
                    }
                    title={isFollowed ? 'Following hobby' : 'Follow hobby'}
                    className={`min-h-[38px] px-2.5 border-l border-border/80 inline-flex items-center justify-center transition-colors cursor-pointer ${
                      isFollowed
                        ? 'text-brass hover:text-warn'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {isFollowed ? (
                      <BookmarkCheck className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />
                    ) : (
                      <Bookmark className="w-3.5 h-3.5" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feed Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="h-96" />
          ))}
        </div>
      ) : activeTab === 'following' && followedCollectors.size === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6" strokeWidth={1.5} />}
          title="You're not following any collectors yet"
          description="Follow collectors from their showcase pages to see all their latest finds here."
          action={
            <Button variant="secondary" onClick={() => navigate('/explore')}>
              Explore showcases &amp; collectors
            </Button>
          }
        />
      ) : displayedItems.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-6 h-6" strokeWidth={1.5} />}
          title="No finds found"
          description={
            activeTab === 'following'
              ? 'Collectors you follow have not added any pieces in this category yet.'
              : 'Try selecting another hobby or clearing your filter.'
          }
          action={
            selectedCategory !== 'all' ? (
              <Button variant="secondary" onClick={() => setSelectedCategory('all')}>
                Show all hobbies
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
            {displayedItems.map((item) => {
              const isCategoryPrioritised = priorityCategories.has(item.category);
              const isCategoryFollowed = followedCategories.has(item.category);

              return (
                <div key={item.id} className="space-y-3 group">
                  <Link to={`/i/${item.id}`} className="block">
                    <PieceStage item={item} />
                  </Link>

                  <div className="px-0.5 space-y-1.5">
                    {/* Category & Follow pill (Strictly zero location, zero private price) */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <Link
                        to={`/category/${item.category}`}
                        className="inline-flex items-center gap-1.5 text-muted hover:text-brass transition-colors"
                      >
                        <CategoryIcon category={item.category} className="w-3.5 h-3.5 text-brass" />
                        <span>{CATEGORIES[item.category]?.shortLabel || item.category}</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => void handleToggleCategoryFollow(item.category)}
                        title={
                          isCategoryFollowed
                            ? `Following ${CATEGORIES[item.category]?.shortLabel}`
                            : `Follow ${CATEGORIES[item.category]?.shortLabel}`
                        }
                        className={`inline-flex items-center gap-1 font-mono transition-colors cursor-pointer ${
                          isCategoryFollowed
                            ? 'text-brass hover:text-warn'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        {isCategoryFollowed ? (
                          <>
                            <BookmarkCheck className="w-3 h-3" strokeWidth={1.5} />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3 h-3" strokeWidth={1.5} />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Placard: Displays title, year, maker, grade, £ valuation range. NO location, NO private price */}
                    <Link
                      to={`/i/${item.id}`}
                      className="block hover:text-brass transition-colors"
                    >
                      <Placard item={item} size="sm" />
                    </Link>

                    {/* Collector Attribution */}
                    <div className="pt-0.5 flex items-center justify-between text-xs">
                      <Link
                        to={`/@${item.ownerHandle}`}
                        className="font-mono text-muted hover:text-ink transition-colors"
                      >
                        @{item.ownerHandle}
                      </Link>
                      {isCategoryPrioritised && (
                        <span className="text-[11px] font-mono text-brass/80">
                          {isCategoryFollowed ? 'Followed' : '10+ pieces'}
                        </span>
                      )}
                    </div>

                    {/* Social Action Strip (Likes, Comments, Saves with counts) */}
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => void handleToggleLike(item.id, e)}
                          title={socialStats[item.id]?.liked ? 'Unlike' : 'Like'}
                          className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                            socialStats[item.id]?.liked
                              ? 'text-danger font-medium'
                              : 'hover:text-ink'
                          }`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              socialStats[item.id]?.liked ? 'fill-danger text-danger' : ''
                            }`}
                            strokeWidth={1.5}
                          />
                          <span className="font-mono text-[11px]">
                            {socialStats[item.id]?.likeCount ?? 0}
                          </span>
                        </button>

                        <Link
                          to={`/i/${item.id}#comments`}
                          className="inline-flex items-center gap-1.5 hover:text-ink transition-colors"
                          title="View comments"
                        >
                          <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span className="font-mono text-[11px]">
                            {socialStats[item.id]?.commentsCount ?? 0}
                          </span>
                        </Link>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => void handleToggleSave(item.id, e)}
                        title={socialStats[item.id]?.saved ? 'Saved to showcase' : 'Save piece'}
                        className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                          socialStats[item.id]?.saved
                            ? 'text-brass font-medium'
                            : 'hover:text-ink'
                        }`}
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 ${
                            socialStats[item.id]?.saved ? 'fill-brass text-brass' : ''
                          }`}
                          strokeWidth={1.5}
                        />
                        <span className="font-mono text-[11px]">
                          {socialStats[item.id]?.saveCount ?? 0}
                        </span>
                      </button>
                    </div>

                    {/* Compact Got One / Want One interaction */}
                    <div className="pt-1 flex items-center justify-end">
                      <ItemSignalButtons item={item} compact />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleCount < personalisedItems.length && (
            <div className="flex justify-center pt-4">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setVisibleCount((prev) => prev + 12)}
              >
                Load more finds ({personalisedItems.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Users, ArrowRight, ShieldCheck, ExternalLink } from 'lucide-react';
import { CATEGORIES, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import {
  listPublicCollectors,
  listAllPublicItemsForMatching,
} from '../../lib/firestoreRepo';
import { fetchUserWants } from '../../lib/interactionRepo';
import { fetchFollowedCollectors, followTarget, unfollowTarget, checkIsFollowing } from '../../lib/followRepo';
import type { CollectorMatchSuggestion, UserProfile, CollectibleItemRecord } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';

export const MatchesPage: React.FC = () => {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const uid = firebaseUser?.uid || '';
  const isVerified = Boolean(firebaseUser?.emailVerified);

  const [matches, setMatches] = useState<CollectorMatchSuggestion[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const computePairings = async () => {
      try {
        setLoading(true);
        const [collectors, allPublicItems, userWants] = await Promise.all([
          listPublicCollectors(40),
          listAllPublicItemsForMatching(150),
          uid && !uid.startsWith('guest_') ? fetchUserWants(uid) : Promise.resolve([]),
        ]);

        if (!active) return;

        const otherCollectors = collectors.filter((c) => c.uid !== uid);
        const mySpecialties = new Set<CategorySlug>(profile?.specialties || []);
        const myWantTitles = userWants.map((w) => w.title.toLowerCase());

        const calculated: CollectorMatchSuggestion[] = [];
        const followStatus: Record<string, boolean> = {};

        for (const collector of otherCollectors) {
          let score = 35;
          const sharedCategories = new Set<CategorySlug>();
          const collectorItems = allPublicItems.filter((i) => i.ownerId === collector.uid);
          const wantlistOverlap: CollectibleItemRecord[] = [];

          if (collector.specialties && collector.specialties.length > 0) {
            for (const s of collector.specialties) {
              if (mySpecialties.has(s)) {
                score += 20;
                sharedCategories.add(s);
              }
            }
          }

          for (const item of collectorItems) {
            const itemTitleLower = item.title.toLowerCase();
            const matchesWant = myWantTitles.some((wt) => itemTitleLower.includes(wt) || wt.includes(itemTitleLower));
            if (matchesWant) {
              score += 30;
              wantlistOverlap.push(item);
              sharedCategories.add(item.category);
            }
          }

          const isFoll = await checkIsFollowing(uid || 'guest_user', 'user', collector.uid);
          followStatus[collector.uid] = isFoll;

          let reason = 'Active collector in the community';
          if (wantlistOverlap.length > 0) {
            reason = `Has ${wantlistOverlap.length} item${wantlistOverlap.length > 1 ? 's' : ''} matching your Wantlist`;
          } else if (sharedCategories.size > 0) {
            const firstCat = CATEGORIES[Array.from(sharedCategories)[0]]?.shortLabel || 'category';
            reason = `Shares an interest in ${firstCat}`;
          }

          calculated.push({
            collector,
            score: Math.min(99, score),
            reason,
            matchingItemsCount: collectorItems.length,
            sharedCategories: Array.from(sharedCategories),
            wantlistOverlapItems: wantlistOverlap,
          });
        }

        calculated.sort((a, b) => b.score - a.score);

        if (active) {
          setMatches(calculated);
          setFollowingMap(followStatus);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    };

    void computePairings();
    return () => {
      active = false;
    };
  }, [uid, profile]);

  const handleToggleFollow = async (collectorUid: string) => {
    if (!firebaseUser) {
      openAuthModal();
      return;
    }
    const isCurrentlyFollowing = followingMap[collectorUid];
    setFollowingMap((prev) => ({ ...prev, [collectorUid]: !isCurrentlyFollowing }));

    try {
      if (isCurrentlyFollowing) {
        await unfollowTarget({
          followerId: uid,
          targetType: 'user',
          targetId: collectorUid,
          isVerifiedUser: isVerified,
        });
      } else {
        await followTarget({
          followerId: uid,
          targetType: 'user',
          targetId: collectorUid,
          isVerifiedUser: isVerified,
        });
      }
    } catch {
      setFollowingMap((prev) => ({ ...prev, [collectorUid]: isCurrentlyFollowing }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink">Collector Matches</h1>
          <p className="text-sm text-muted mt-1">
            Discover collectors who share your collecting specialties and hold pieces on your Wantlist.
          </p>
        </div>
        <Link to="/explore">
          <Button variant="secondary" size="sm">
            <span>Explore all pieces</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" strokeWidth={1.5} />}
          title="No collector matches found"
          description="Add items to your Wantlist or select your collecting specialties in your settings to find matching collectors."
          action={
            <div className="flex items-center gap-3">
              <Link to="/wantlist">
                <Button variant="secondary">Manage Wantlist</Button>
              </Link>
              <Link to="/settings">
                <Button>Update Specialties</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {matches.map(({ collector, score, reason, matchingItemsCount, sharedCategories, wantlistOverlapItems }) => {
            const isFollowing = followingMap[collector.uid];
            return (
              <div
                key={collector.uid}
                className="rounded-2xl border border-border bg-surface p-6 space-y-5 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      {collector.avatarUrl ? (
                        <img
                          src={collector.avatarUrl}
                          alt={collector.displayName}
                          className="w-12 h-12 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-surface-raised border border-border flex items-center justify-center font-display font-bold text-lg text-brass">
                          {collector.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-display font-semibold text-lg text-ink">
                            {collector.displayName}
                          </h3>
                          {collector.isVerifiedExpert && (
                            <span title="Verified Expert" className="inline-flex">
                              <ShieldCheck className="w-4 h-4 text-brass" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-brass">@{collector.handle}</p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-brass/10 border border-brass/40 text-brass font-mono text-xs font-bold">
                      {score}% match
                    </span>
                  </div>

                  <p className="text-sm text-muted leading-relaxed">{reason}</p>

                  {sharedCategories.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {sharedCategories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-raised border border-border text-xs font-medium text-ink"
                        >
                          <CategoryIcon category={cat} className="w-3.5 h-3.5 text-brass" />
                          <span>{CATEGORIES[cat]?.shortLabel || cat}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {wantlistOverlapItems.length > 0 && (
                    <div className="p-3 rounded-xl bg-brass/5 border border-brass/30 space-y-2">
                      <div className="text-xs font-mono text-brass font-semibold">Wantlist Overlap Items:</div>
                      <div className="space-y-1.5">
                        {wantlistOverlapItems.slice(0, 2).map((item) => (
                          <Link
                            key={item.id}
                            to={`/i/${item.id}`}
                            className="flex items-center justify-between text-xs text-ink hover:text-brass transition-colors"
                          >
                            <span className="truncate font-medium">{item.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
                  <Link to={`/@${collector.handle}`}>
                    <Button variant="secondary" size="sm">
                      <span>View Showcase</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>

                  <Button
                    variant={isFollowing ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => void handleToggleFollow(collector.uid)}
                  >
                    {isFollowing ? 'Following' : 'Follow collector'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

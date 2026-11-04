import React, { useEffect, useState } from 'react';
import { MessageSquare, Plus, ShieldCheck, Trophy, Users } from 'lucide-react';
import { CATEGORIES, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { fetchCommunityThreads, fetchJoinedCommunities, toggleCommunityMembership } from '../../lib/communityRepo';
import { listFreshFinds, listOwnerItems } from '../../lib/firestoreRepo';
import type { CollectibleItemRecord, CommunityThreadRecord, FreshFindRecord } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { Tabs } from '../../components/ui/Tabs';
import { CommunityThreadCard } from './CommunityThreadCard';
import { NewThreadModal } from './NewThreadModal';
import { ThreadDetailModal } from './ThreadDetailModal';

export const CommunitiesPage: React.FC = () => {
  const { profile, openAuthModal, needsEmailVerification } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | 'all'>('all');
  const [threads, setThreads] = useState<CommunityThreadRecord[]>([]);
  const [freshFinds, setFreshFinds] = useState<FreshFindRecord[]>([]);
  const [userItems, setUserItems] = useState<CollectibleItemRecord[]>([]);
  const [joinedComms, setJoinedComms] = useState<CategorySlug[]>([]);
  const [loading, setLoading] = useState(true);

  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [activeThread, setActiveThread] = useState<CommunityThreadRecord | null>(null);



  const loadData = async () => {
    setLoading(true);
    try {
      const [thr, fnd, itm] = await Promise.all([
        fetchCommunityThreads(selectedCategory === 'all' ? undefined : selectedCategory),
        listFreshFinds({ category: selectedCategory === 'all' ? 'all' : selectedCategory, pageSize: 6 }),
        profile ? listOwnerItems(profile.uid, 50) : Promise.resolve([]),
      ]);
      setThreads(thr);
      setFreshFinds(fnd.items);
      setUserItems(itm);
      setJoinedComms(fetchJoinedCommunities(profile?.uid));
    } catch (err) {
      console.error('Failed to load communities data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [selectedCategory, profile]);

  const handleToggleMembership = (catSlug: CategorySlug) => {
    if (!profile) {
      openAuthModal();
      return;
    }
    const updated = toggleCommunityMembership(profile.uid, catSlug);
    setJoinedComms(updated);
  };

  const handleVotePoll = async (threadId: string, optionIndex: number) => {
    if (!profile) {
      openAuthModal();
      return;
    }
    await loadData();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink">Collector Communities</h1>
          <p className="text-base text-muted mt-1">
            Category forums, debates, polls, and fresh finds from collectors across the UK.
          </p>
        </div>
        <Button
          onClick={() => {
            if (!profile) openAuthModal();
            else setNewThreadOpen(true);
          }}
        >
          <Plus className="w-5 h-5" />
          <span>Start discussion</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.values(CATEGORIES).map((cat) => {
          const isJoined = joinedComms.includes(cat.slug);
          return (
            <Card
              key={cat.slug}
              raised
              interactive
              onClick={() => setSelectedCategory(cat.slug)}
              className={`p-4 flex flex-col justify-between gap-3 cursor-pointer ${
                selectedCategory === cat.slug ? 'border-brass bg-brass/10' : ''
              }`}
            >
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-brass">
                  Community
                </span>
                <h3 className="text-base font-display font-semibold text-ink">{cat.shortLabel}</h3>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted">{isJoined ? 'Joined' : 'Join'}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleMembership(cat.slug);
                  }}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    isJoined
                      ? 'bg-brass text-brass-fg'
                      : 'bg-surface text-muted hover:text-ink border border-border'
                  }`}
                >
                  {isJoined ? 'Joined' : '+ Join'}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <Tabs
          options={[
            { value: 'all', label: 'All Communities' },
            ...Object.values(CATEGORIES).map((c) => ({ value: c.slug, label: c.shortLabel })),
          ]}
          value={selectedCategory}
          onChange={(v) => setSelectedCategory(v as CategorySlug | 'all')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-display font-semibold text-ink">Active Discussions</h2>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
            </div>
          ) : threads.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="w-6 h-6" />}
              title="No discussions yet"
              description="Be the first collector to start a discussion or poll in this community."
              action={
                <Button onClick={() => (profile ? setNewThreadOpen(true) : openAuthModal())}>
                  Start discussion
                </Button>
              }
            />
          ) : (
            <div className="space-y-5">
              {threads.map((thread) => (
                <CommunityThreadCard
                  key={thread.id}
                  thread={thread}
                  onSelect={setActiveThread}
                  onVotePoll={handleVotePoll}
                  currentUserId={profile?.uid}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
            <h3 className="text-lg font-display font-semibold text-ink">Fresh Finds Feed</h3>
            <p className="text-xs text-muted leading-relaxed">
              Recent pieces added to showcases matching this community.
            </p>
            <div className="space-y-3">
              {freshFinds.length === 0 ? (
                <p className="text-xs text-muted italic">No fresh finds yet.</p>
              ) : (
                freshFinds.map((find) => (
                  <div
                    key={find.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-raised border border-border"
                  >
                    <img
                      src={find.thumbUrl}
                      alt={find.title}
                      className="w-12 h-12 rounded-lg object-cover bg-bg shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-ink truncate">{find.title}</h4>
                      <p className="text-xs text-muted">@{find.ownerHandle}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <NewThreadModal
        open={newThreadOpen}
        onClose={() => setNewThreadOpen(false)}
        defaultCategory={selectedCategory === 'all' ? 'football_cards' : selectedCategory}
        profile={profile}
        userItems={userItems}
        isVerifiedUser={true}
        onThreadCreated={() => void loadData()}
      />

      {activeThread && (
        <ThreadDetailModal
          open={Boolean(activeThread)}
          onClose={() => setActiveThread(null)}
          thread={activeThread}
          profile={profile}
          isVerifiedUser={true}
          onRequireAuth={openAuthModal}
        />
      )}
    </div>
  );
};

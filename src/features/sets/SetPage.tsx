import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  BookmarkPlus,
  Check,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Filter,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import { CATEGORIES, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { formatGbp, formatGbpRange } from '../../lib/entitlements';
import { fetchSetById, fetchUserSetProgress, upsertUserSetProgress, addWantFromSet, listOwnerItems } from '../../lib/firestoreRepo';
import type { SetRecord, SetItemEntry, UserSetProgressRecord, CollectibleItemRecord } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { CompletionRing } from '../../components/ui/CompletionRing';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { Placard } from '../../components/ui/Placard';
import { Sheet } from '../../components/ui/Sheet';
import { Tabs } from '../../components/ui/Tabs';
import { Toast } from '../../components/ui/Toast';

export const SetPage: React.FC = () => {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const { firebaseUser, profile: viewerProfile } = useAuth();
  const uid = firebaseUser?.uid;
  const isVerified = Boolean(firebaseUser?.emailVerified);
  const isOwnProfile = Boolean(uid && viewerProfile);

  const [setRecord, setSetRecord] = useState<SetRecord | null>(null);
  const [progress, setProgress] = useState<UserSetProgressRecord | null>(null);
  const [ownedItems, setOwnedItems] = useState<CollectibleItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'owned' | 'missing' | 'wanted'>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'add-want' | 'confirm-add-missing'>('add-want');
  const [pendingWantItems, setPendingWantItems] = useState<SetItemEntry[]>([]);

  useDocumentMeta({
    title: setRecord ? `${setRecord.title} · Set Checklist` : 'Set Checklist · Fanzeum',
    description: setRecord
      ? `Complete checklist for ${setRecord.title} (${setRecord.yearRange}). Track what you own, what you need, and add missing items to your Want List.`
      : 'View set checklist, track ownership, and manage your want list.',
  });

  const loadData = useCallback(async () => {
    if (!setId) return;
    setLoading(true);
    try {
      const [setData, progData, itemsData] = await Promise.all([
        fetchSetById(setId),
        uid ? fetchUserSetProgress(uid, setId) : Promise.resolve(null),
        uid ? listOwnerItems(uid, { maxResults: 5000 }) : Promise.resolve([]),
      ]);
      setSetRecord(setData);
      setProgress(progData);
      setOwnedItems(itemsData);
    } finally {
      setLoading(false);
    }
  }, [setId, uid]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const ownedItemIds = progress?.ownedItemIds || [];
  const wantItemIds = progress?.wantItemIds || [];

  const ownedSet = new Set(ownedItemIds);
  const wantSet = new Set(wantItemIds);

  // Also check against actual owned items in user's collections
  const ownedFromCollection = new Set(ownedItems.map((i) => i.id));

  const isItemOwned = (itemId: string) => ownedSet.has(itemId) || ownedFromCollection.has(itemId);
  const isItemWanted = (itemId: string) => wantSet.has(itemId);

  const filteredItems = setRecord?.items.filter((item) => {
    if (activeTab === 'owned') return isItemOwned(item.id);
    if (activeTab === 'missing') return !isItemOwned(item.id);
    if (activeTab === 'wanted') return isItemWanted(item.id);
    return true;
  }) || [];

  const ownedCount = setRecord?.items.filter((item) => isItemOwned(item.id)).length || 0;
  const wantedCount = setRecord?.items.filter((item) => isItemWanted(item.id)).length || 0;
  const missingCount = (setRecord?.totalItems || 0) - ownedCount;
  const completionPct = setRecord?.totalItems ? Math.round((ownedCount / setRecord.totalItems) * 100) : 0;

  const handleToggleOwned = async (item: SetItemEntry) => {
    if (!uid || !isVerified || !setRecord) return;
    const nextOwned = new Set(ownedSet);
    const nextWanted = new Set(wantSet);

    if (isItemOwned(item.id)) {
      nextOwned.delete(item.id);
    } else {
      nextOwned.add(item.id);
      // If we mark as owned, remove from wanted
      nextWanted.delete(item.id);
    }

    setSaving(true);
    try {
      await upsertUserSetProgress({
        userId: uid,
        setId: setRecord.id,
        ownedItemIds: Array.from(nextOwned),
        wantItemIds: Array.from(nextWanted),
      });
      setProgress((prev) => prev ? { ...prev, ownedItemIds: Array.from(nextOwned), wantItemIds: Array.from(nextWanted) } : null);
      showToast(isItemOwned(item.id) ? 'Removed from owned' : 'Marked as owned');
    } catch (err) {
      console.error('Failed to update progress:', err);
      showToast('Failed to update. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleWant = async (item: SetItemEntry) => {
    if (!uid || !isVerified || !setRecord) return;
    const nextWanted = new Set(wantSet);

    if (isItemWanted(item.id)) {
      nextWanted.delete(item.id);
    } else {
      nextWanted.add(item.id);
    }

    setSaving(true);
    try {
      await upsertUserSetProgress({
        userId: uid,
        setId: setRecord.id,
        ownedItemIds: Array.from(ownedSet),
        wantItemIds: Array.from(nextWanted),
      });
      setProgress((prev) => prev ? { ...prev, wantItemIds: Array.from(nextWanted) } : null);
      showToast(isItemWanted(item.id) ? 'Removed from Want List' : 'Added to Want List');
    } catch (err) {
      console.error('Failed to update want:', err);
      showToast('Failed to update. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAllMissingToWantlist = async () => {
    if (!uid || !isVerified || !setRecord) return;
    const missingItems = setRecord.items.filter((item) => !isItemOwned(item.id) && !isItemWanted(item.id));
    if (missingItems.length === 0) {
      showToast('No missing items to add', 'error');
      return;
    }
    setPendingWantItems(missingItems);
    setSheetMode('confirm-add-missing');
    setSheetOpen(true);
  };

  const handleConfirmAddMissing = async () => {
    if (!uid || !isVerified || !setRecord) return;
    const missingItems = setRecord.items.filter((item) => !isItemOwned(item.id) && !isItemWanted(item.id));
    setSaving(true);
    let added = 0;
    try {
      for (const item of missingItems) {
        await addWantFromSet({
          userId: uid,
          setId: setRecord.id,
          itemId: item.id,
          itemTitle: item.title,
          category: setRecord.category,
          keyFields: item.keyFields,
          maxPriceGbp: item.estimatedMaxGbp,
        });
        added++;
      }
      // Update local progress with all missing items now wanted
      const nextWanted = new Set(wantSet);
      missingItems.forEach((item) => nextWanted.add(item.id));
      await upsertUserSetProgress({
        userId: uid,
        setId: setRecord.id,
        ownedItemIds: Array.from(ownedSet),
        wantItemIds: Array.from(nextWanted),
      });
      setProgress((prev) => prev ? { ...prev, wantItemIds: Array.from(nextWanted) } : null);
      showToast(`Added ${added} missing items to your Want List`);
    } catch (err) {
      console.error('Failed to add missing items:', err);
      showToast('Some items could not be added. Please try again.', 'error');
    } finally {
      setSaving(false);
      setSheetOpen(false);
    }
  };

  const handleAddSingleToWantlist = async (item: SetItemEntry) => {
    if (!uid || !isVerified || !setRecord) return;
    setSaving(true);
    try {
      await addWantFromSet({
        userId: uid,
        setId: setRecord.id,
        itemId: item.id,
        itemTitle: item.title,
        category: setRecord.category,
        keyFields: item.keyFields,
        maxPriceGbp: item.estimatedMaxGbp,
      });
      const nextWanted = new Set(wantSet);
      nextWanted.add(item.id);
      await upsertUserSetProgress({
        userId: uid,
        setId: setRecord.id,
        ownedItemIds: Array.from(ownedSet),
        wantItemIds: Array.from(nextWanted),
      });
      setProgress((prev) => prev ? { ...prev, wantItemIds: Array.from(nextWanted) } : null);
      showToast(`Added "${item.title}" to your Want List`);
    } catch (err) {
      console.error('Failed to add to wantlist:', err);
      showToast('Failed to add. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-8">
        <Skeleton className="h-44" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      </div>
    );
  }

  if (!setRecord) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
        <EmptyState
          icon={<Sparkles className="w-6 h-6" strokeWidth={1.5} />}
          title="Set checklist not found"
          description="This set checklist does not exist or has been removed."
          action={<Button onClick={() => navigate('/sets')}>Browse all sets</Button>}
        />
      </div>
    );
  }

  const catConfig = CATEGORIES[setRecord.category];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-8">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      {/* Set Header */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border border-border bg-surface-raised flex items-center justify-center shrink-0 after-hours-spotlight relative">
              {setRecord.coverImageUrl ? (
                <CollectorImage
                  src={setRecord.coverImageUrl}
                  alt={setRecord.title}
                  category={setRecord.category}
                  className="w-full h-full rounded-xl"
                  imgClassName="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <CategoryIcon category={setRecord.category} className="w-12 h-12 text-brass/40" strokeWidth={1} />
              )}
              {setRecord.status === 'pending' && (
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-warn/20 text-warn border border-warn/30">
                  Pending
                </span>
              )}
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
                  {setRecord.title}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1 text-brass font-mono">
                  <CategoryIcon category={setRecord.category} className="w-3.5 h-3.5" />
                  <span>{catConfig?.shortLabel || setRecord.category}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>{setRecord.yearRange}</span>
                <span aria-hidden="true">·</span>
                <span>{setRecord.totalItems} {setRecord.totalItems === 1 ? 'item' : 'items'}</span>
              </div>
              <p className="text-base text-ink/90 max-w-2xl pt-1 leading-relaxed">
                {setRecord.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link to={`/sets/${setRecord.category}`} className="min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-surface-raised text-muted hover:text-ink hover:border-brass/50 transition-colors inline-flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              <span>All {catConfig?.shortLabel} sets</span>
            </Link>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="pt-4 border-t border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CompletionRing current={ownedCount} target={setRecord.totalItems} size={64} />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-center sm:text-left flex-1">
              <div>
                <div className="text-xs text-muted">Owned</div>
                <div className="text-2xl font-mono font-semibold tabular-nums text-ink">{ownedCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Wanted</div>
                <div className="text-2xl font-mono font-semibold tabular-nums text-brass">{wantedCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Missing</div>
                <div className="text-2xl font-mono font-semibold tabular-nums text-muted">{missingCount}</div>
              </div>
              {completionPct === 100 && ownedCount > 0 && (
                <div className="flex items-center gap-2 text-ok font-mono">
                  <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
                  <span>Set complete!</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {isOwnProfile && (
              <>
                <Button
                  variant={missingCount > 0 ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={missingCount === 0 || saving}
                  onClick={handleAddAllMissingToWantlist}
                >
                  <BookmarkPlus className="w-4 h-4" strokeWidth={1.5} />
                  <span>{missingCount > 0 ? `Add ${missingCount} missing to Want List` : 'Set complete'}</span>
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setActiveTab('owned')}>
                  <Check className="w-4 h-4" strokeWidth={1.5} />
                  <span>Owned ({ownedCount})</span>
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setActiveTab('wanted')}>
                  <Target className="w-4 h-4" strokeWidth={1.5} />
                  <span>Wanted ({wantedCount})</span>
                </Button>
              </>
            )}
            {!isOwnProfile && (
              <Button variant="secondary" size="sm" onClick={() => navigate('/onboarding')}>
                <BookmarkPlus className="w-4 h-4" strokeWidth={1.5} />
                <span>Sign in to track</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Filter Tabs */}
      <Tabs
        ariaLabel="Checklist filter"
        value={activeTab}
        onChange={(tab) => setActiveTab(tab as 'all' | 'owned' | 'missing' | 'wanted')}
        options={[
          { value: 'all', label: `All (${setRecord.totalItems})`, icon: <Sparkles className="w-4 h-4" strokeWidth={1.5} /> },
          { value: 'owned', label: `Owned (${ownedCount})`, icon: <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} /> },
          { value: 'missing', label: `Missing (${missingCount})`, icon: <Circle className="w-4 h-4" strokeWidth={1.5} /> },
          { value: 'wanted', label: `Wanted (${wantedCount})`, icon: <Target className="w-4 h-4" strokeWidth={1.5} /> },
        ]}
      />

      {/* Checklist Items */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={activeTab === 'owned' ? <CheckCircle2 className="w-6 h-6" strokeWidth={1.5} /> : activeTab === 'wanted' ? <Target className="w-6 h-6" strokeWidth={1.5} /> : <Circle className="w-6 h-6" strokeWidth={1.5} />}
          title={activeTab === 'owned' ? 'No items marked as owned yet' : activeTab === 'wanted' ? 'No items on your Want List from this set' : 'All items accounted for'}
          description={
            activeTab === 'owned'
              ? 'Tap the check icon on any item to mark it as owned.'
              : activeTab === 'wanted'
              ? 'Tap the target icon to add items to your Want List.'
              : 'Great work! You have everything in this set.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, index) => {
            const owned = isItemOwned(item.id);
            const wanted = isItemWanted(item.id);
            return (
              <Card key={item.id} className="p-4 space-y-3" raised={owned}>
                <div className="flex items-start gap-4">
                  {/* Item Number / Order */}
                  <div className="flex items-center justify-center w-10 shrink-0">
                    <span className="text-xs font-mono text-muted tabular-nums">
                      {item.order + 1}
                    </span>
                  </div>

                  {/* Item Image */}
                  <div className="w-16 h-16 shrink-0 rounded-xl border border-border bg-surface-raised flex items-center justify-center after-hours-spotlight relative">
                    {item.thumbUrl ? (
                      <CollectorImage
                        src={item.thumbUrl}
                        alt={item.title}
                        category={setRecord.category}
                        className="w-full h-full rounded-lg"
                        imgClassName="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <CategoryIcon category={setRecord.category} className="w-8 h-8 text-brass/30" strokeWidth={1} />
                    )}
                    {owned && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-ok/90 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                    {wanted && !owned && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brass/90 flex items-center justify-center">
                        <Target className="w-3 h-3 text-white" strokeWidth={2} />
                      </div>
                    )}
                  </div>

                  {/* Item Details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <h3 className="text-base font-display font-semibold text-ink truncate">
                      {item.title}
                    </h3>
                    {item.year && (
                      <span className="text-xs font-mono text-muted">{item.year}</span>
                    )}
                    {item.keyFields && Object.keys(item.keyFields).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(item.keyFields).slice(0, 3).map(([k, v]) => (
                          <span
                            key={k}
                            className="px-1.5 py-0.5 rounded-lg bg-surface border border-border text-[10px] font-mono text-muted"
                          >
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                    {(item.estimatedMinGbp !== undefined || item.estimatedMaxGbp !== undefined) && (
                      <span className="text-xs font-mono text-brass">
                        {formatGbpRange(item.estimatedMinGbp || 0, item.estimatedMaxGbp || 0)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {isOwnProfile ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleOwned(item)}
                          disabled={saving}
                          className={`p-2 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                            owned
                              ? 'bg-ok/15 text-ok border border-ok/30'
                              : 'bg-surface-raised text-muted border border-border hover:text-ink hover:border-brass/50'
                          }`}
                          aria-label={owned ? `Mark as not owned` : `Mark as owned`}
                        >
                          {owned ? (
                            <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
                          ) : (
                            <Circle className="w-5 h-5" strokeWidth={1.5} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => wanted ? handleToggleWant(item) : handleAddSingleToWantlist(item)}
                          disabled={saving}
                          className={`p-2 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                            wanted
                              ? 'bg-brass/15 text-brass border border-brass/30'
                              : 'bg-surface-raised text-muted border border-border hover:text-ink hover:border-brass/50'
                          }`}
                          aria-label={wanted ? `Remove from Want List` : `Add to Want List`}
                        >
                          {wanted ? (
                            <Bookmark className="w-5 h-5 fill-brass" strokeWidth={1.5} />
                          ) : (
                            <BookmarkPlus className="w-5 h-5" strokeWidth={1.5} />
                          )}
                        </button>
                      </>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => navigate('/onboarding')}>
                        <BookmarkPlus className="w-4 h-4" strokeWidth={1.5} />
                        <span className="hidden sm:inline">Track</span>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm Add Missing Sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={sheetMode === 'confirm-add-missing' ? `Add ${pendingWantItems.length} missing items?` : 'Add to Want List'}
        subtitle={sheetMode === 'confirm-add-missing'
          ? 'This will add all missing items from this set to your Want List. You can remove individual items later.'
          : 'Specify details for your Want List entry.'}
      >
        {sheetMode === 'confirm-add-missing' ? (
          <div className="space-y-4">
            <p className="text-base text-muted">
              You are about to add <strong className="text-ink">{pendingWantItems.length}</strong> missing items from
              <strong className="text-ink">{setRecord.title}</strong> to your Want List.
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2 border border-border rounded-xl p-3 bg-surface">
              {pendingWantItems.slice(0, 20).map((item) => (
                <div key={item.id} className="text-sm text-ink/90 flex items-center gap-2">
                  <Circle className="w-4 h-4 text-muted" strokeWidth={1.5} />
                  <span className="truncate">{item.title}</span>
                </div>
              ))}
              {pendingWantItems.length > 20 && (
                <div className="text-xs text-muted pt-1">… and {pendingWantItems.length - 20} more</div>
              )}
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmAddMissing} disabled={saving}>
                {saving ? 'Adding…' : `Add all ${pendingWantItems.length} to Want List`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base text-muted">Single item add mode (not used in current flow)</p>
            <Button type="button" variant="ghost" onClick={() => setSheetOpen(false)}>Close</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
};

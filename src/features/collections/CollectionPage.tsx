import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  GripVertical,
  LayoutGrid,
  Maximize2,
  Pencil,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_LIST, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { polishCollectionStory } from '../../lib/aiClient';
import { formatGbpRange } from '../../lib/entitlements';
import {
  deleteEntireCollection,
  fetchCollectionById,
  fetchUserProfile,
  listCollectionItems,
  reorderCollectionItems,
  updateCollectionDetails,
} from '../../lib/firestoreRepo';
import type {
  CollectibleItemRecord,
  CollectionRecord,
  VisibilityLevel,
} from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CompletionRing } from '../../components/ui/CompletionRing';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { PieceStage } from '../../components/ui/PieceStage';
import { Placard } from '../../components/ui/Placard';
import { Sheet } from '../../components/ui/Sheet';
import { Tabs } from '../../components/ui/Tabs';

type GalleryViewMode = 'grid' | 'story' | 'swipe';
type SortMode = 'newest' | 'oldest' | 'value_desc' | 'year' | 'custom';

export const CollectionPage: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const { firebaseUser, profile: viewerProfile, refreshProfile } = useAuth();

  const [collectionRecord, setCollectionRecord] = useState<CollectionRecord | null>(null);
  const [items, setItems] = useState<CollectibleItemRecord[]>([]);
  const [ownerHideValues, setOwnerHideValues] = useState(false);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<GalleryViewMode>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('custom');
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Edit & Delete sheets
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<CategorySlug>('football_cards');
  const [editVisibility, setEditVisibility] = useState<VisibilityLevel>('public');
  const [editTarget, setEditTarget] = useState('');
  const [editStory, setEditStory] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = Boolean(
    firebaseUser?.emailVerified &&
      collectionRecord &&
      firebaseUser.uid === collectionRecord.ownerId &&
      !collectionRecord.isDemo,
  );

  useDocumentMeta({
    title: collectionRecord ? collectionRecord.title : 'Collection',
    description: collectionRecord?.story,
    image: collectionRecord?.coverImageUrl,
  });

  useEffect(() => {
    if (!collectionId) return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const col = await fetchCollectionById(collectionId!);
        if (!active) return;
        setCollectionRecord(col);
        if (col) {
          const [colItems, ownerProf] = await Promise.all([
            listCollectionItems(col, firebaseUser?.uid),
            fetchUserProfile(col.ownerId),
          ]);
          if (!active) return;
          setItems(colItems);
          setOwnerHideValues(Boolean(ownerProf?.hideValues));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [collectionId, firebaseUser?.uid]);

  const sortedItems = useMemo(() => {
    const copy = [...items];
    switch (sortMode) {
      case 'newest':
        return copy.sort((a, b) => {
          const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds || 0;
          const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds || 0;
          return bSec - aSec || b.customOrder - a.customOrder;
        });
      case 'oldest':
        return copy.sort((a, b) => {
          const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds || 0;
          const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds || 0;
          return aSec - bSec || a.customOrder - b.customOrder;
        });
      case 'value_desc':
        return copy.sort((a, b) => b.valueMaxGbp - a.valueMaxGbp);
      case 'year':
        return copy.sort((a, b) => a.year.localeCompare(b.year, undefined, { numeric: true }));
      case 'custom':
      default:
        return copy.sort((a, b) => a.customOrder - b.customOrder);
    }
  }, [items, sortMode]);

  // Keyboard navigation in Swipe mode
  useEffect(() => {
    if (viewMode !== 'swipe' || sortedItems.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewMode('grid');
      if (e.key === 'ArrowRight') {
        setSwipeIndex((i) => (i + 1) % sortedItems.length);
      }
      if (e.key === 'ArrowLeft') {
        setSwipeIndex((i) => (i - 1 + sortedItems.length) % sortedItems.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewMode, sortedItems.length]);

  const handleShare = async () => {
    if (!collectionRecord) return;
    const url = `${window.location.origin}/c/${collectionRecord.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${collectionRecord.title} · Fanzeum`,
          text: collectionRecord.story,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard?.writeText(url);
    setCopiedToast(true);
    window.setTimeout(() => setCopiedToast(false), 2500);
  };

  const moveItemByOffset = async (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= sortedItems.length) return;
    const reordered = [...sortedItems];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    const updated = reordered.map((it, idx) => ({ ...it, customOrder: idx }));
    setItems(updated);
    setSavingOrder(true);
    try {
      await reorderCollectionItems(updated);
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDropOnItem = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const fromIdx = sortedItems.findIndex((i) => i.id === draggedId);
    const toIdx = sortedItems.findIndex((i) => i.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...sortedItems];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updated = reordered.map((it, idx) => ({ ...it, customOrder: idx }));
    setItems(updated);
    setDraggedId(null);
    setSavingOrder(true);
    try {
      await reorderCollectionItems(updated);
    } finally {
      setSavingOrder(false);
    }
  };

  const openEditSheet = () => {
    if (!collectionRecord) return;
    setEditTitle(collectionRecord.title);
    setEditCategory(collectionRecord.category);
    setEditVisibility(collectionRecord.visibility);
    setEditTarget(collectionRecord.setTargetCount > 0 ? String(collectionRecord.setTargetCount) : '');
    setEditStory(collectionRecord.story);
    setEditOpen(true);
  };

  const handlePolishStory = async () => {
    if (!editStory.trim()) return;
    setPolishing(true);
    try {
      const next = await polishCollectionStory({
        title: editTitle || 'My Collection',
        category: editCategory,
        draftStory: editStory,
      });
      setEditStory(next);
    } catch {
      // Leave current draft untouched
    } finally {
      setPolishing(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionRecord) return;
    setSavingEdit(true);
    try {
      const targetNum = Math.max(0, Number(editTarget) || 0);
      await updateCollectionDetails(collectionRecord.id, {
        title: editTitle,
        category: editCategory,
        visibility: editVisibility,
        setTargetCount: targetNum,
        story: editStory,
      });
      setCollectionRecord((prev) =>
        prev
          ? {
              ...prev,
              title: editTitle.trim() || prev.title,
              category: editCategory,
              visibility: editVisibility,
              setTargetCount: targetNum,
              story: editStory,
            }
          : prev,
      );
      setEditOpen(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!collectionRecord || !viewerProfile) return;
    setDeleting(true);
    try {
      await deleteEntireCollection(collectionRecord, viewerProfile);
      await refreshProfile();
      navigate(`/@${viewerProfile.handle}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-8">
        <Skeleton className="h-44" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!collectionRecord) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
        <EmptyState
          title="Collection not found"
          description="This collection may be private or may have been removed by its owner."
          action={<Button onClick={() => navigate('/explore')}>Explore pieces</Button>}
        />
      </div>
    );
  }

  const hideValues = ownerHideValues && !isOwner;
  const activeSwipeItem = sortedItems[swipeIndex] || sortedItems[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-8">
      {/* Collection Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link to={`/@${collectionRecord.ownerHandle}`} className="font-mono text-brass hover:underline">
            @{collectionRecord.ownerHandle}
          </Link>
          <span aria-hidden="true">·</span>
          <span>{CATEGORIES[collectionRecord.category]?.label || collectionRecord.category}</span>
          {isOwner && (
            <>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{collectionRecord.visibility}</span>
            </>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <h1 className="text-3xl sm:text-5xl font-display font-semibold text-ink leading-tight">
              {collectionRecord.title}
            </h1>
            {collectionRecord.story && (
              <p className="text-base sm:text-lg text-muted leading-relaxed">
                {collectionRecord.story}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button variant="secondary" size="sm" onClick={handleShare}>
              {copiedToast ? (
                <>
                  <Check className="w-4 h-4 text-ok" strokeWidth={1.5} />
                  <span>Link copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" strokeWidth={1.5} />
                  <span>Share</span>
                </>
              )}
            </Button>

            {isOwner && (
              <>
                <Button variant="secondary" size="sm" onClick={openEditSheet}>
                  <Pencil className="w-4 h-4" strokeWidth={1.5} />
                  <span>Edit</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate(`/add?collectionId=${collectionRecord.id}`)}
                >
                  <Camera className="w-4 h-4" strokeWidth={1.5} />
                  <span>Add piece</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats & Set Completion Strip */}
        <Card raised className="p-5 flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-8">
            {collectionRecord.setTargetCount > 0 ? (
              <CompletionRing
                current={items.length}
                target={collectionRecord.setTargetCount}
                size={54}
              />
            ) : (
              <div>
                <div className="text-xs text-muted">Pieces in set</div>
                <div className="text-2xl font-mono font-semibold tabular-nums text-ink">
                  {items.length}
                </div>
              </div>
            )}

            {!hideValues && collectionRecord.estimatedTotalMaxGbp > 0 && (
              <div>
                <div className="text-xs text-muted">Estimated set value</div>
                <div className="text-2xl font-mono font-semibold tabular-nums text-brass">
                  {formatGbpRange(
                    collectionRecord.estimatedTotalMinGbp,
                    collectionRecord.estimatedTotalMaxGbp,
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-muted">
            Collected by{' '}
            <Link to={`/@${collectionRecord.ownerHandle}`} className="text-ink hover:underline">
              {collectionRecord.ownerName}
            </Link>
          </div>
        </Card>
      </div>

      {/* View Mode & Sort Toolbar */}
      {items.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <Tabs
            ariaLabel="Gallery display mode"
            value={viewMode}
            onChange={(m) => {
              setSwipeIndex(0);
              setViewMode(m);
            }}
            options={[
              {
                value: 'grid',
                label: 'Grid',
                icon: <LayoutGrid className="w-4 h-4" strokeWidth={1.5} />,
              },
              {
                value: 'story',
                label: 'Story',
                icon: <BookOpen className="w-4 h-4" strokeWidth={1.5} />,
              },
              {
                value: 'swipe',
                label: 'Full-screen',
                icon: <Maximize2 className="w-4 h-4" strokeWidth={1.5} />,
              },
            ]}
          />

          <div className="flex items-center gap-2.5">
            {savingOrder && <span className="text-xs font-mono text-brass">Saving order…</span>}
            <label htmlFor="collection-sort" className="text-sm text-muted whitespace-nowrap">
              Sort:
            </label>
            <select
              id="collection-sort"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="min-h-[40px] px-3 py-1.5 text-sm rounded-xl border border-border bg-surface text-ink"
            >
              <option value="custom">Collector order</option>
              <option value="newest">Newest added</option>
              <option value="oldest">Oldest added</option>
              <option value="value_desc">Value (high to low)</option>
              <option value="year">Year</option>
            </select>
          </div>
        </div>
      )}

      {/* Empty Collection State */}
      {sortedItems.length === 0 ? (
        <EmptyState
          icon={<Camera className="w-6 h-6" strokeWidth={1.5} />}
          title="No pieces in this collection yet"
          description={
            isOwner
              ? 'Snap your first card, coin, stamp, or sleeve to identify it and light up this set.'
              : 'The collector has not added public pieces to this collection yet.'
          }
          action={
            isOwner ? (
              <Button onClick={() => navigate(`/add?collectionId=${collectionRecord.id}`)}>
                Add first piece
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === 'story' ? (
        /* Editorial Story Layout */
        <div className="space-y-12 sm:space-y-16 pt-2">
          {sortedItems.map((item, idx) => (
            <div
              key={item.id}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pb-12 border-b border-border last:border-b-0"
            >
              <div className={`lg:col-span-5 ${idx % 2 === 1 ? 'lg:order-2' : ''}`}>
                <Link to={`/i/${item.id}`} className="block max-w-md mx-auto">
                  <PieceStage item={item} />
                </Link>
              </div>
              <div className={`lg:col-span-7 space-y-4 ${idx % 2 === 1 ? 'lg:order-1' : ''}`}>
                <div className="text-xs font-mono text-muted">
                  Piece {String(idx + 1).padStart(2, '0')} of {sortedItems.length}
                </div>
                <Link to={`/i/${item.id}`} className="block hover:text-brass transition-colors">
                  <Placard item={item} hideValues={hideValues} size="lg" />
                </Link>
                {item.story && (
                  <p className="text-base sm:text-lg text-ink/90 leading-relaxed">{item.story}</p>
                )}
                {!hideValues && item.valuationReason && (
                  <p className="text-sm text-muted italic">{item.valuationReason}</p>
                )}
                <div className="pt-2">
                  <Link
                    to={`/i/${item.id}`}
                    className="text-sm font-medium text-brass hover:underline"
                  >
                    Inspect full specs →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Standard Grid Layout (with Owner Custom Reorder Controls) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
          {sortedItems.map((item, idx) => (
            <div
              key={item.id}
              draggable={isOwner && sortMode === 'custom'}
              onDragStart={() => setDraggedId(item.id)}
              onDragOver={(e) => {
                if (isOwner && sortMode === 'custom') e.preventDefault();
              }}
              onDrop={() => {
                if (isOwner && sortMode === 'custom') void handleDropOnItem(item.id);
              }}
              className="space-y-3"
            >
              <Link to={`/i/${item.id}`} className="block">
                <PieceStage item={item} />
              </Link>
              <div className="px-0.5 space-y-2">
                <Link to={`/i/${item.id}`} className="block hover:text-brass transition-colors">
                  <Placard item={item} hideValues={hideValues} size="md" />
                </Link>

                {isOwner && sortMode === 'custom' && sortedItems.length > 1 && (
                  <div className="flex items-center justify-between pt-1 text-xs text-muted border-t border-border">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <GripVertical className="w-3.5 h-3.5" strokeWidth={1.5} />#{idx + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => void moveItemByOffset(idx, -1)}
                        aria-label="Move piece earlier"
                        className="min-h-[34px] px-2.5 rounded-lg border border-border hover:text-ink disabled:opacity-40 cursor-pointer"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={idx === sortedItems.length - 1}
                        onClick={() => void moveItemByOffset(idx, 1)}
                        aria-label="Move piece later"
                        className="min-h-[34px] px-2.5 rounded-lg border border-border hover:text-ink disabled:opacity-40 cursor-pointer"
                      >
                        →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full-Screen After Hours Swipe Lightbox */}
      {viewMode === 'swipe' && activeSwipeItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full-screen exhibition view"
          onTouchStart={(e) => setTouchStartX(e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            if (touchStartX === null) return;
            const endX = e.changedTouches[0]?.clientX ?? touchStartX;
            const diff = endX - touchStartX;
            if (Math.abs(diff) > 45) {
              if (diff < 0) {
                setSwipeIndex((i) => (i + 1) % sortedItems.length);
              } else {
                setSwipeIndex((i) => (i - 1 + sortedItems.length) % sortedItems.length);
              }
            }
            setTouchStartX(null);
          }}
          className="fixed inset-0 z-50 bg-bg flex flex-col justify-between p-4 sm:p-8 overflow-y-auto"
        >
          <div className="max-w-5xl w-full mx-auto flex items-center justify-between gap-4">
            <div className="text-sm font-mono text-muted">
              {swipeIndex + 1} / {sortedItems.length} · {collectionRecord.title}
            </div>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Exit full-screen view"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-border bg-surface text-ink hover:border-brass/50 cursor-pointer"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="max-w-4xl w-full mx-auto my-auto py-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-6 max-w-sm w-full mx-auto">
              <PieceStage item={activeSwipeItem} priority />
            </div>
            <div className="md:col-span-6 space-y-4">
              <Placard item={activeSwipeItem} hideValues={hideValues} size="lg" />
              {activeSwipeItem.story && (
                <p className="text-base text-muted leading-relaxed">{activeSwipeItem.story}</p>
              )}
              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/i/${activeSwipeItem.id}`)}
                >
                  Open piece page
                </Button>
              </div>
            </div>
          </div>

          <div className="max-w-5xl w-full mx-auto flex items-center justify-between gap-4 pt-2">
            <Button
              variant="secondary"
              onClick={() =>
                setSwipeIndex((i) => (i - 1 + sortedItems.length) % sortedItems.length)
              }
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              <span>Previous</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSwipeIndex((i) => (i + 1) % sortedItems.length)}
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Collection Sheet */}
      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit collection"
        subtitle="Update title, set target size, visibility, or story."
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Title</label>
            <input
              type="text"
              required
              maxLength={120}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Hobby</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as CategorySlug)}
                className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
              >
                {CATEGORY_LIST.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.shortLabel}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Visibility</label>
              <select
                value={editVisibility}
                onChange={(e) => setEditVisibility(e.target.value as VisibilityLevel)}
                className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
              >
                <option value="public">Public</option>
                <option value="private">Private (only me)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Set target count (0 for open-ended)
            </label>
            <input
              type="number"
              min={0}
              max={50000}
              value={editTarget}
              onChange={(e) => setEditTarget(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-base font-mono rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-ink">Story</label>
              <button
                type="button"
                disabled={polishing || !editStory.trim()}
                onClick={handlePolishStory}
                className="inline-flex items-center gap-1 text-xs font-medium text-brass hover:underline disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{polishing ? 'Tidying…' : 'Polish draft'}</span>
              </button>
            </div>
            <textarea
              rows={4}
              maxLength={2500}
              value={editStory}
              onChange={(e) => setEditStory(e.target.value)}
              className="w-full px-3.5 py-2.5 text-base rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                setEditOpen(false);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              <span>Delete collection</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </Sheet>

      {/* Delete Confirmation Sheet */}
      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this collection?"
        subtitle="Every piece and uploaded photo inside this collection will be permanently deleted."
      >
        <div className="space-y-4">
          <p className="text-base text-muted">
            You are about to delete <strong className="text-ink">{collectionRecord.title}</strong> (
            {items.length} {items.length === 1 ? 'piece' : 'pieces'}). This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={deleting} onClick={handleConfirmDelete}>
              {deleting ? 'Deleting…' : 'Yes, delete everything'}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
};

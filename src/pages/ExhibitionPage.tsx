import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Share2,
  X,
} from 'lucide-react';
import {
  CATEGORY_METADATA,
  CollectibleItemRecord,
  CollectionRecord,
} from '../types/domain';
import {
  deleteCollectibleItemRecord,
  fetchCollectionById,
  listCollectionItems,
} from '../lib/firestoreRepo';
import { formatGbpRange } from '../lib/entitlements';
import { useAuth } from '../contexts/AuthContext';
import { ArchivalImage } from '../components/ArchivalImage';
import { AccessionModal } from '../components/AccessionModal';
import { PhotoIdentifyModal } from '../components/PhotoIdentifyModal';

type ViewMode = 'grid' | 'story' | 'swipe';

export const ExhibitionPage: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { firebaseUser } = useAuth();

  const [collectionRecord, setCollectionRecord] = useState<CollectionRecord | null>(null);
  const [items, setItems] = useState<CollectibleItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedItem, setSelectedItem] = useState<CollectibleItemRecord | null>(null);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [identifyOpen, setIdentifyOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadExhibition = useCallback(async () => {
    if (!collectionId) return;
    setLoading(true);
    setError(null);
    try {
      const col = await fetchCollectionById(collectionId);
      if (!col) {
        setCollectionRecord(null);
        setItems([]);
        return;
      }
      setCollectionRecord(col);
      const loadedItems = await listCollectionItems(col, firebaseUser?.uid);
      setItems(loadedItems);
    } catch (err) {
      setError(
        err instanceof Error
          ? 'This exhibition is private or you do not have permission to view it.'
          : 'Unable to load exhibition.',
      );
    } finally {
      setLoading(false);
    }
  }, [collectionId, firebaseUser?.uid]);

  useEffect(() => {
    loadExhibition();
  }, [loadExhibition]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleDeleteItem = async (item: CollectibleItemRecord) => {
    if (!collectionRecord) return;
    await deleteCollectibleItemRecord(item, collectionRecord);
    await loadExhibition();
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
        <div className="h-64 rounded-xl bg-stone-100 dark:bg-stone-900 animate-pulse" />
      </div>
    );
  }

  if (error || !collectionRecord) {
    return (
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20 text-center">
        <h1 className="text-3xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
          Exhibition Unavailable
        </h1>
        <p className="mt-3 text-sm text-stone-600 dark:text-stone-400">
          {error || 'The requested exhibition could not be found in the public registry.'}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block px-5 py-2.5 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] text-xs font-medium"
        >
          Return to Public Exhibitions
        </Link>
      </div>
    );
  }

  const isOwner = Boolean(
    firebaseUser?.emailVerified &&
      firebaseUser.uid === collectionRecord.ownerId &&
      !collectionRecord.isDemo,
  );
  const dept = CATEGORY_METADATA[collectionRecord.category];
  const completionPct =
    collectionRecord.setTargetCount > 0
      ? Math.min(100, Math.round((items.length / collectionRecord.setTargetCount) * 100))
      : null;

  return (
    <div className="pb-20">
      {/* Exhibition Header */}
      <section className="border-b border-stone-200 dark:border-stone-800 bg-[#F4EFE6]/40 dark:bg-[#171614]/50">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
            <span>{dept?.curatorDepartment || 'Curatorial Exhibition'}</span>
            <span aria-hidden="true">·</span>
            <span>Visibility: {collectionRecord.visibility}</span>
          </div>

          <h1 className="mt-3 text-3xl sm:text-5xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB] max-w-4xl">
            {collectionRecord.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600 dark:text-stone-300">
            <span>
              Curated by{' '}
              <Link
                to={`/collector/${collectionRecord.ownerId}`}
                className="font-medium underline hover:text-[#9A3412] dark:hover:text-[#D97757]"
              >
                {collectionRecord.ownerName}
              </Link>{' '}
              (@{collectionRecord.ownerHandle})
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{items.length} catalogued pieces</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-xs tabular-nums text-[#9A3412] dark:text-[#D97757] font-medium">
              Est. Cabinet Value:{' '}
              {formatGbpRange(
                collectionRecord.estimatedTotalMinGbp,
                collectionRecord.estimatedTotalMaxGbp,
              )}
            </span>
          </div>

          {/* Set Completion Progress Bar */}
          {completionPct !== null && (
            <div className="mt-6 max-w-md">
              <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 mb-1.5 tabular-nums">
                <span>
                  Set Completion: {items.length} of {collectionRecord.setTargetCount} pieces
                </span>
                <span className="font-mono font-medium">{completionPct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-[#9A3412] dark:bg-[#D97757] transition-all duration-300"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Exhibition Toolbar: View Modes + Share + Owner Add Photo */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div
              role="tablist"
              aria-label="Gallery presentation mode"
              className="flex items-center gap-1 p-1 rounded-lg bg-stone-200/70 dark:bg-stone-800/80"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-[#171614] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                Archive Grid
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'story'}
                onClick={() => setViewMode('story')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'story'
                    ? 'bg-white dark:bg-[#171614] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                Curator’s Story
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'swipe'}
                onClick={() => {
                  setSwipeIndex(0);
                  setViewMode('swipe');
                }}
                disabled={items.length === 0}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer ${
                  viewMode === 'swipe'
                    ? 'bg-white dark:bg-[#171614] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Full-Screen Gallery
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-[#1C1917] dark:text-[#F5F2EB] hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    Link Copied
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    Share Exhibition
                  </>
                )}
              </button>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => setIdentifyOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Add Items by Photo
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Empty Exhibition Prompt */}
      {items.length === 0 ? (
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16 text-center">
          <p className="text-xl font-serif text-[#1C1917] dark:text-[#F5F2EB]">
            This exhibition cabinet is awaiting its first accession.
          </p>
          {collectionRecord.story && (
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-prose mx-auto">
              {collectionRecord.story}
            </p>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={() => setIdentifyOpen(true)}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white text-xs font-medium cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Photograph First Collectible
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Mode 1: Archive Grid */
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-10">
          {collectionRecord.story && (
            <div className="mb-10 pb-8 border-b border-stone-200 dark:border-stone-800 max-w-2xl">
              <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400 mb-2">
                Curatorial Statement
              </p>
              <p className="text-base leading-relaxed text-stone-700 dark:text-stone-300 whitespace-pre-line">
                {collectionRecord.story}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className="group text-left flex flex-col rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer"
              >
                <div className="aspect-square bg-[#EFECE6] dark:bg-[#0F0E0D] p-5 flex items-center justify-center overflow-hidden">
                  <ArchivalImage
                    src={item.imageUrl}
                    alt={item.name}
                    fallbackTitle={item.name}
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                      <span>FIG. {String(idx + 1).padStart(2, '0')}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.year || 'Undated'}</span>
                      {item.setNumber && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.setNumber}</span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-2 text-lg font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB] group-hover:text-[#9A3412] dark:group-hover:text-[#D97757] transition-colors">
                      {item.name}
                    </h2>
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 line-clamp-1">
                      {item.condition}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
                    <span className="text-stone-500 dark:text-stone-400 truncate max-w-[150px]">
                      {item.maker}
                    </span>
                    <span className="font-mono tabular-nums font-medium text-[#9A3412] dark:text-[#D97757]">
                      {formatGbpRange(item.valueMinGbp, item.valueMaxGbp)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : viewMode === 'story' ? (
        /* Mode 2: Editorial Curator's Story View (Drop Cap + Large Plates) */
        <article className="max-w-4xl mx-auto px-5 sm:px-8 pt-12 space-y-16">
          {collectionRecord.story && (
            <div className="max-w-2xl mx-auto">
              <p className="text-base sm:text-lg leading-[1.85] text-stone-800 dark:text-stone-200 whitespace-pre-line first-letter:text-5xl first-letter:font-serif first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-[#9A3412] dark:first-letter:text-[#D97757]">
                {collectionRecord.story}
              </p>
            </div>
          )}

          <div className="space-y-20">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="border-t border-stone-200 dark:border-stone-800 pt-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center"
              >
                <div className="md:col-span-7 bg-[#EFECE6] dark:bg-[#171614] rounded-xl p-6 sm:p-10 border border-stone-200 dark:border-stone-800">
                  <div className="aspect-[4/3] flex items-center justify-center">
                    <ArchivalImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="mt-4 text-xs font-serif italic text-stone-500 dark:text-stone-400 text-center">
                    Fig. {idx + 1} — {item.name} ({item.year || 'Undated'})
                  </p>
                </div>

                <div className="md:col-span-5 space-y-3">
                  <p className="text-xs font-mono uppercase tracking-widest text-stone-500 dark:text-stone-400 tabular-nums">
                    Plate {String(idx + 1).padStart(2, '0')} · {item.setNumber || 'Archive'}
                  </p>
                  <h3 className="text-2xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
                    {item.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                    {item.curatorialNote ||
                      `Issued by ${item.maker || 'unknown maker'} (${item.series || 'general series'}). Graded ${item.condition}.`}
                  </p>
                  <div className="pt-2 text-xs text-stone-500 dark:text-stone-400 space-y-1">
                    <div>Condition: {item.condition}</div>
                    <div className="font-mono tabular-nums text-[#9A3412] dark:text-[#D97757]">
                      Est. Value: {formatGbpRange(item.valueMinGbp, item.valueMaxGbp)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="mt-2 text-xs font-medium underline text-[#1C1917] dark:text-[#F5F2EB] hover:text-[#9A3412] cursor-pointer"
                  >
                    Inspect Full Accession Record →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      ) : (
        /* Mode 3: Full-Screen Dark Room Swipe Lightbox */
        <div className="fixed inset-0 z-50 bg-[#0A0A09] text-[#F5F2EB] flex flex-col justify-between p-4 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs font-mono uppercase tracking-widest text-stone-400 tabular-nums">
              {collectionRecord.title} · Plate {swipeIndex + 1} of {items.length}
            </div>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-700 text-xs hover:bg-stone-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
              Exit Full-Screen
            </button>
          </div>

          <div className="flex-1 flex items-center justify-between gap-4 my-4 min-h-0">
            <button
              type="button"
              aria-label="Previous item"
              onClick={() => setSwipeIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))}
              className="p-3 rounded-full border border-stone-800 hover:bg-stone-900 text-stone-300 cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 h-full max-h-[65vh] flex items-center justify-center">
              <ArchivalImage
                src={items[swipeIndex]?.imageUrl}
                alt={items[swipeIndex]?.name || 'Plate'}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <button
              type="button"
              aria-label="Next item"
              onClick={() => setSwipeIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))}
              className="p-3 rounded-full border border-stone-800 hover:bg-stone-900 text-stone-300 cursor-pointer shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {items[swipeIndex] && (
            <div className="max-w-3xl mx-auto text-center space-y-1.5 border-t border-stone-800 pt-4 w-full">
              <h2 className="text-xl sm:text-2xl font-serif font-semibold">
                {items[swipeIndex].name}
              </h2>
              <p className="text-xs text-stone-400">
                {items[swipeIndex].year} · {items[swipeIndex].maker} · {items[swipeIndex].condition} ·{' '}
                <span className="font-mono text-[#D97757]">
                  {formatGbpRange(items[swipeIndex].valueMinGbp, items[swipeIndex].valueMaxGbp)}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      <AccessionModal
        item={selectedItem}
        isOwner={isOwner}
        onClose={() => setSelectedItem(null)}
        onDelete={handleDeleteItem}
      />

      {isOwner && firebaseUser && (
        <PhotoIdentifyModal
          open={identifyOpen}
          collectionRecord={collectionRecord}
          ownerId={firebaseUser.uid}
          onClose={() => setIdentifyOpen(false)}
          onSaved={loadExhibition}
        />
      )}
    </div>
  );
};

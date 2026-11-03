import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  ExternalLink,
  FolderInput,
  Info,
  Lock,
  Pencil,
  Share2,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { CATEGORIES } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { getFriendlyFirebaseErrorMessage } from '../../lib/firebase';
import { formatGbp, formatGbpRange } from '../../lib/entitlements';
import {
  deleteCollectibleItemRecord,
  fetchCollectionById,
  fetchItemById,
  fetchItemPrivateRecord,
  fetchUserProfile,
  listCollectionItems,
  listOwnerCollections,
  moveItemToCollection,
  updateCollectibleItemRecord,
  upsertItemPrivateRecord,
} from '../../lib/firestoreRepo';
import type {
  CollectibleItemRecord,
  CollectionRecord,
  ItemPrivateRecord,
} from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { ConfidenceChip } from '../../components/ui/ConfidenceChip';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { PanelConfirmedBadge } from '../../components/ui/PanelConfirmedBadge';
import { PieceStage } from '../../components/ui/PieceStage';
import { Placard } from '../../components/ui/Placard';
import { Sheet } from '../../components/ui/Sheet';

export const ItemPage: React.FC = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { firebaseUser, profile: viewerProfile, refreshProfile } = useAuth();

  const [item, setItem] = useState<CollectibleItemRecord | null>(null);
  const [collectionRecord, setCollectionRecord] = useState<CollectionRecord | null>(null);
  const [siblingItems, setSiblingItems] = useState<CollectibleItemRecord[]>([]);
  const [ownerHideValues, setOwnerHideValues] = useState(false);
  const [privateRecord, setPrivateRecord] = useState<ItemPrivateRecord | null>(null);
  const [myCollections, setMyCollections] = useState<CollectionRecord[]>([]);

  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedToast, setCopiedToast] = useState(false);

  // Edit details sheet
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editStory, setEditStory] = useState('');
  const [editMinGbp, setEditMinGbp] = useState('');
  const [editMaxGbp, setEditMaxGbp] = useState('');
  const [editValReason, setEditValReason] = useState('');
  const [editGrail, setEditGrail] = useState(false);
  const [editAttrs, setEditAttrs] = useState<Record<string, string | boolean>>({});
  const [editAcqPrice, setEditAcqPrice] = useState('');
  const [editAcqDate, setEditAcqDate] = useState('');
  const [editPrivNotes, setEditPrivNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Move & Delete sheets
  const [moveOpen, setMoveOpen] = useState(false);
  const [targetCollectionId, setTargetCollectionId] = useState('');
  const [moving, setMoving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  const isOwner = Boolean(
    firebaseUser?.emailVerified &&
      item &&
      firebaseUser.uid === item.ownerId &&
      !item.isDemo,
  );

  useDocumentMeta({
    title: item ? item.title : 'Collector Piece',
    description: item?.story || item?.valuationReason,
    image: item?.imageUrl,
  });

  useEffect(() => {
    if (!itemId) return;
    let active = true;
    async function load() {
      setLoading(true);
      setSelectedPhotoIdx(0);
      try {
        const fetched = await fetchItemById(itemId!);
        if (!active) return;
        setItem(fetched);
        if (!fetched) return;

        const [col, ownerProf] = await Promise.all([
          fetchCollectionById(fetched.collectionId),
          fetchUserProfile(fetched.ownerId),
        ]);
        if (!active) return;
        setCollectionRecord(col);
        setOwnerHideValues(Boolean(ownerProf?.hideValues));

        if (col) {
          const siblings = await listCollectionItems(col, firebaseUser?.uid, 20);
          if (active) {
            setSiblingItems(siblings.filter((s) => s.id !== fetched.id).slice(0, 4));
          }
        }

        if (firebaseUser?.emailVerified && firebaseUser.uid === fetched.ownerId && !fetched.isDemo) {
          const [priv, cols] = await Promise.all([
            fetchItemPrivateRecord(firebaseUser.uid, fetched.id),
            listOwnerCollections(firebaseUser.uid, firebaseUser.uid, 50),
          ]);
          if (active) {
            setPrivateRecord(priv);
            setMyCollections(cols);
          }
        } else {
          setPrivateRecord(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [itemId, firebaseUser?.uid, firebaseUser?.emailVerified]);

  const handleShare = async () => {
    if (!item) return;
    const url = `${window.location.origin}/i/${item.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${item.title} · Fanzeum`,
          text: item.story || `Worth around ${formatGbpRange(item.valueMinGbp, item.valueMaxGbp)}`,
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

  const openEditSheet = () => {
    if (!item) return;
    setEditTitle(item.title);
    setEditStory(item.story);
    setEditMinGbp(String(item.valueMinGbp));
    setEditMaxGbp(String(item.valueMaxGbp));
    setEditValReason(item.valuationReason);
    setEditGrail(item.grail);
    setEditAttrs({ ...item.attributes });
    setEditAcqPrice(privateRecord?.acquiredPriceGbp ? String(privateRecord.acquiredPriceGbp) : '');
    setEditAcqDate(privateRecord?.acquiredDate || '');
    setEditPrivNotes(privateRecord?.privateNotes || '');
    setItemError(null);
    setEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !collectionRecord || !firebaseUser) return;
    setSavingEdit(true);
    setItemError(null);
    try {
      const minGbp = Math.max(0, Number(editMinGbp) || 0);
      const maxGbp = Math.max(minGbp, Number(editMaxGbp) || minGbp);
      await updateCollectibleItemRecord({
        item,
        collectionRecord,
        title: editTitle,
        story: editStory,
        category: item.category,
        attributes: editAttrs,
        valueMinGbp: minGbp,
        valueMaxGbp: maxGbp,
        valuationReason: editValReason,
        grail: editGrail,
        tags: item.tags,
      });

      await upsertItemPrivateRecord({
        uid: firebaseUser.uid,
        itemId: item.id,
        acquiredDate: editAcqDate,
        acquiredPriceGbp: Number(editAcqPrice) || 0,
        privateNotes: editPrivNotes,
      });

      const refreshed = await fetchItemById(item.id);
      const refreshedPriv = await fetchItemPrivateRecord(firebaseUser.uid, item.id);
      if (refreshed) setItem(refreshed);
      setPrivateRecord(refreshedPriv);
      setEditOpen(false);
    } catch (err) {
      console.error('Save item error:', err);
      setItemError(getFriendlyFirebaseErrorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !collectionRecord) return;
    const target = myCollections.find((c) => c.id === targetCollectionId);
    if (!target || target.id === collectionRecord.id) return;
    setMoving(true);
    setItemError(null);
    try {
      await moveItemToCollection({
        item,
        sourceCollection: collectionRecord,
        targetCollection: target,
      });
      setCollectionRecord(target);
      setItem((prev) => (prev ? { ...prev, collectionId: target.id } : prev));
      setMoveOpen(false);
    } catch (err) {
      console.error('Move item error:', err);
      setItemError(getFriendlyFirebaseErrorMessage(err));
    } finally {
      setMoving(false);
    }
  };

  const handleDelete = async () => {
    if (!item || !collectionRecord) return;
    setDeleting(true);
    setItemError(null);
    try {
      await deleteCollectibleItemRecord(item, collectionRecord, viewerProfile);
      await refreshProfile();
      navigate(`/c/${collectionRecord.id}`);
    } catch (err) {
      console.error('Delete item error:', err);
      setItemError(getFriendlyFirebaseErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-6">
          <Skeleton className="h-[460px]" />
        </div>
        <div className="lg:col-span-6 space-y-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
        <EmptyState
          title="Piece not found"
          description="This piece may belong to a private showcase or may have been deleted."
          action={<Button onClick={() => navigate('/explore')}>Explore pieces</Button>}
        />
      </div>
    );
  }

  const hideValues = ownerHideValues && !isOwner;
  const catConfig = CATEGORIES[item.category];
  const activePhoto = item.photos?.[selectedPhotoIdx] || item.photos?.[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-14">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link to={`/@${item.ownerHandle}`} className="font-mono text-brass hover:underline">
          @{item.ownerHandle}
        </Link>
        {collectionRecord && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/c/${collectionRecord.id}`} className="hover:text-ink truncate max-w-xs">
              {collectionRecord.title}
            </Link>
          </>
        )}
      </nav>

      {/* Main Piece Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        {/* Left: Category Stage + Multi-Photo Switcher + Zoom */}
        <div className="lg:col-span-6 space-y-4">
          <div className="max-w-md mx-auto">
            {selectedPhotoIdx === 0 ? (
              <PieceStage item={item} priority />
            ) : (
              <div className="aspect-[4/5] rounded-2xl bg-surface-raised border border-border p-4 flex items-center justify-center after-hours-spotlight">
                <CollectorImage
                  src={activePhoto?.url || item.imageUrl}
                  alt={`${item.title} — ${activePhoto?.label || 'Detail'}`}
                  category={item.category}
                  priority
                  className="w-full h-full"
                  imgClassName="w-full h-full object-contain"
                />
              </div>
            )}
          </div>

          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            {item.photos && item.photos.length > 1 ? (
              <div className="flex items-center gap-2 overflow-x-auto">
                {item.photos.map((photo, idx) => (
                  <button
                    key={`${photo.url}_${idx}`}
                    type="button"
                    onClick={() => setSelectedPhotoIdx(idx)}
                    className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-mono inline-flex items-center gap-2 transition-colors cursor-pointer ${
                      idx === selectedPhotoIdx
                        ? 'border-brass bg-surface-raised text-ink'
                        : 'border-border bg-surface text-muted hover:text-ink'
                    }`}
                  >
                    <CollectorImage
                      src={photo.thumbUrl || photo.url}
                      alt={photo.label || `Photo ${idx + 1}`}
                      category={item.category}
                      className="w-6 h-6 rounded"
                      imgClassName="w-full h-full object-cover rounded"
                    />
                    <span>{photo.label || `Photo ${idx + 1}`}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs font-mono text-muted">
                {catConfig?.shortLabel || item.category}
              </span>
            )}

            <Button variant="ghost" size="sm" onClick={() => setZoomOpen(true)}>
              <ZoomIn className="w-4 h-4" strokeWidth={1.5} />
              <span>Zoom</span>
            </Button>
          </div>

          {item.mediaCredit && (
            <p className="max-w-md mx-auto text-xs text-muted flex flex-wrap items-center gap-1.5">
              <span>Reference photo: {item.mediaCredit.author}</span>
              <span aria-hidden="true">·</span>
              <a
                href={item.mediaCredit.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline hover:text-ink"
              >
                <span>{item.mediaCredit.licence}</span>
                <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
              </a>
            </p>
          )}
        </div>

        {/* Right: Placard, Story, Valuation Note, Category Specs & Owner Panel */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <Placard item={item} hideValues={hideValues} size="lg" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {item.panelStatus === 'confirmed' && (
              <PanelConfirmedBadge date={item.panelConfirmedAt} size="md" />
            )}
            <ConfidenceChip confidence={item.aiConfidence} />
            <Button variant="secondary" size="sm" onClick={handleShare}>
              {copiedToast ? (
                <>
                  <Check className="w-4 h-4 text-ok" strokeWidth={1.5} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" strokeWidth={1.5} />
                  <span>Share piece</span>
                </>
              )}
            </Button>

            {isOwner && (
              <>
                <Button variant="secondary" size="sm" onClick={openEditSheet}>
                  <Pencil className="w-4 h-4" strokeWidth={1.5} />
                  <span>Edit</span>
                </Button>
                {myCollections.length > 1 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const other = myCollections.find((c) => c.id !== item.collectionId);
                      setTargetCollectionId(other?.id || '');
                      setMoveOpen(true);
                    }}
                  >
                    <FolderInput className="w-4 h-4" strokeWidth={1.5} />
                    <span>Move</span>
                  </Button>
                )}
              </>
            )}
          </div>

          {item.story && (
            <p className="text-base sm:text-lg text-ink/95 leading-relaxed">{item.story}</p>
          )}

          {/* Valuation Rationale & Honest Disclaimer */}
          {!hideValues && (item.valueMinGbp > 0 || item.valueMaxGbp > 0) && (
            <Card raised className="p-4 sm:p-5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  UK guide: {formatGbpRange(item.valueMinGbp, item.valueMaxGbp)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <Info className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />
                  <span>AI estimate, not a professional valuation</span>
                </span>
              </div>
              {item.valuationReason && (
                <p className="text-sm text-muted leading-relaxed">{item.valuationReason}</p>
              )}
            </Card>
          )}

          {/* Category-Specific Specification Sheet */}
          <Card className="divide-y divide-border overflow-hidden">
            <div className="px-5 py-3.5 bg-surface-raised flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink">
                {catConfig?.label || 'Collector specifications'}
              </h2>
              <span className="text-xs font-mono text-muted">Catalogue details</span>
            </div>

            {catConfig?.fields.map((field) => {
              const rawVal = item.attributes?.[field.key];
              if (rawVal === undefined || rawVal === '') return null;
              const displayVal =
                typeof rawVal === 'boolean' ? (rawVal ? 'Yes' : 'No') : String(rawVal);
              const fieldConf = item.fieldConfidences?.[field.key];

              return (
                <div
                  key={field.key}
                  className="px-5 py-3 flex items-center justify-between gap-4 text-sm"
                >
                  <span className="text-muted">{field.label}</span>
                  <div className="flex items-center gap-3 text-right">
                    <span className={`text-ink font-medium ${field.mono ? 'font-mono' : ''}`}>
                      {displayVal}
                    </span>
                    {fieldConf && fieldConf !== 'high' && (
                      <ConfidenceChip confidence={fieldConf} compact />
                    )}
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Owner-Only Private Acquisition Vault */}
          {isOwner && (
            <Card raised className="p-5 space-y-3 border-brass/35">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                  <Lock className="w-4 h-4 text-brass" strokeWidth={1.5} />
                  <span>Private collector notes (only visible to you)</span>
                </div>
                <button
                  type="button"
                  onClick={openEditSheet}
                  className="text-xs font-medium text-brass hover:underline cursor-pointer"
                >
                  Update
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm pt-1">
                <div>
                  <div className="text-xs text-muted">Price paid</div>
                  <div className="font-mono text-ink mt-0.5">
                    {privateRecord?.acquiredPriceGbp
                      ? formatGbp(privateRecord.acquiredPriceGbp)
                      : 'Not recorded'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Date acquired</div>
                  <div className="font-mono text-ink mt-0.5">
                    {privateRecord?.acquiredDate || 'Not recorded'}
                  </div>
                </div>
              </div>

              {privateRecord?.privateNotes && (
                <p className="text-sm text-muted pt-1 border-t border-border">
                  {privateRecord.privateNotes}
                </p>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Sibling Pieces from Same Collection */}
      {siblingItems.length > 0 && collectionRecord && (
        <section className="pt-8 border-t border-border space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-display font-semibold text-ink">
                More from {collectionRecord.title}
              </h2>
            </div>
            <Link
              to={`/c/${collectionRecord.id}`}
              className="text-sm font-medium text-brass hover:underline whitespace-nowrap"
            >
              View full set →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {siblingItems.map((sib) => (
              <Link key={sib.id} to={`/i/${sib.id}`} className="block space-y-3">
                <PieceStage item={sib} interactive={false} />
                <Placard item={sib} hideValues={hideValues} size="sm" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Full-Resolution Zoom Lightbox */}
      {zoomOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed photo inspection"
          onClick={() => setZoomOpen(false)}
          className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-md p-4 sm:p-10 flex flex-col items-center justify-center"
        >
          <div className="w-full max-w-5xl flex justify-end mb-3">
            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              aria-label="Close zoom"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-border bg-surface text-ink cursor-pointer"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl max-h-[82vh] w-full h-full flex items-center justify-center"
          >
            <CollectorImage
              src={activePhoto?.url || item.imageUrl}
              alt={item.title}
              category={item.category}
              priority
              className="w-full h-full"
              imgClassName="w-full h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Edit Piece Sheet */}
      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit piece details"
        subtitle="Update catalogue fields, £ guide, or your private acquisition record."
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Piece title</label>
            <input
              type="text"
              required
              maxLength={140}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={editGrail}
              onChange={(e) => setEditGrail(e.target.checked)}
              className="w-4 h-4 accent-brass"
            />
            <span>Mark as a Grail piece in my showcase</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Low guide (£)</label>
              <input
                type="number"
                min={0}
                value={editMinGbp}
                onChange={(e) => setEditMinGbp(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-base font-mono rounded-xl border border-border bg-bg text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">High guide (£)</label>
              <input
                type="number"
                min={0}
                value={editMaxGbp}
                onChange={(e) => setEditMaxGbp(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-base font-mono rounded-xl border border-border bg-bg text-ink"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Valuation note</label>
            <input
              type="text"
              maxLength={320}
              value={editValReason}
              onChange={(e) => setEditValReason(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          {/* Category Fields */}
          <div className="pt-2 border-t border-border space-y-3">
            <div className="text-xs font-mono text-brass">
              {catConfig?.shortLabel} catalogue fields
            </div>
            {catConfig?.fields.map((field) => {
              const val = editAttrs[field.key];
              if (field.type === 'boolean') {
                return (
                  <label
                    key={field.key}
                    className="flex items-center gap-2.5 text-sm text-ink cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(val)}
                      onChange={(e) =>
                        setEditAttrs((prev) => ({ ...prev, [field.key]: e.target.checked }))
                      }
                      className="w-4 h-4 accent-brass"
                    />
                    <span>{field.label}</span>
                  </label>
                );
              }
              if (field.type === 'select' && field.options) {
                return (
                  <div key={field.key}>
                    <label className="block text-xs text-muted mb-1">{field.label}</label>
                    <select
                      value={String(val || '')}
                      onChange={(e) =>
                        setEditAttrs((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full min-h-[42px] px-3 py-1.5 text-sm rounded-xl border border-border bg-bg text-ink"
                    >
                      <option value="">Select…</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return (
                <div key={field.key}>
                  <label className="block text-xs text-muted mb-1">{field.label}</label>
                  <input
                    type="text"
                    value={String(val || '')}
                    placeholder={field.placeholder}
                    onChange={(e) =>
                      setEditAttrs((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="w-full min-h-[42px] px-3 py-1.5 text-sm rounded-xl border border-border bg-bg text-ink"
                  />
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Collector story</label>
            <textarea
              rows={3}
              maxLength={1500}
              value={editStory}
              onChange={(e) => setEditStory(e.target.value)}
              className="w-full px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          {/* Private Acquisition Fields */}
          <div className="pt-3 border-t border-border space-y-3">
            <div className="text-xs font-mono text-brass">Private record (never public)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Price paid (£)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editAcqPrice}
                  onChange={(e) => setEditAcqPrice(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-1.5 text-sm font-mono rounded-xl border border-border bg-bg text-ink"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Date acquired</label>
                <input
                  type="text"
                  placeholder="e.g. May 2024"
                  value={editAcqDate}
                  onChange={(e) => setEditAcqDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-1.5 text-sm rounded-xl border border-border bg-bg text-ink"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Private notes / seller / receipt</label>
              <input
                type="text"
                maxLength={1000}
                value={editPrivNotes}
                onChange={(e) => setEditPrivNotes(e.target.value)}
                className="w-full min-h-[42px] px-3 py-1.5 text-sm rounded-xl border border-border bg-bg text-ink"
              />
            </div>
          </div>

          {itemError && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
              {itemError}
            </p>
          )}

          <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
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
              <span>Delete</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save piece'}
              </Button>
            </div>
          </div>
        </form>
      </Sheet>

      {/* Move Piece Sheet */}
      <Sheet
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="Move piece to another collection"
        subtitle="Set totals and cover photos update automatically."
      >
        <form onSubmit={handleMove} className="space-y-4">
          <select
            value={targetCollectionId}
            onChange={(e) => setTargetCollectionId(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
          >
            {myCollections
              .filter((c) => c.id !== item.collectionId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
          {itemError && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
              {itemError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={moving || !targetCollectionId}>
              {moving ? 'Moving…' : 'Move piece'}
            </Button>
          </div>
        </form>
      </Sheet>

      {/* Delete Piece Sheet */}
      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this piece?"
        subtitle="Removes this piece and its Storage photos permanently."
      >
        <div className="space-y-4">
          <p className="text-base text-muted">
            Delete <strong className="text-ink">{item.title}</strong> from your showcase?
          </p>
          {itemError && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
              {itemError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : 'Delete piece'}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
};

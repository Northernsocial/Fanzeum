import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Bookmark,
  Check,
  ExternalLink,
  Flag,
  FolderInput,
  Heart,
  Info,
  Lock,
  MessageSquare,
  Pencil,
  Send,
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
import {
  createItemComment,
  deleteItemComment,
  fetchItemComments,
  fetchItemLikeState,
  fetchItemSaveState,
  submitContentReport,
  toggleItemLike,
  toggleItemSave,
  updateItemComment,
} from '../../lib/socialRepo';
import type {
  CollectibleItemRecord,
  CollectionRecord,
  ItemCommentRecord,
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
import { ItemSignalButtons } from '../../components/ItemSignalButtons';
import { IdCorrectionSheet } from '../../components/IdCorrectionSheet';
import {
  acceptIdCorrection,
  dismissIdCorrection,
  listIdCorrectionsForItem,
} from '../../lib/interactionRepo';
import type { IdCorrectionRecord } from '../../types/domain';
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

  // Social states: likes, saves, comments
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [comments, setComments] = useState<ItemCommentRecord[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Comment edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTargetType, setReportTargetType] = useState<'item' | 'comment'>('item');
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

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

  // ID Corrections
  const [idCorrectionOpen, setIdCorrectionOpen] = useState(false);
  const [idCorrections, setIdCorrections] = useState<IdCorrectionRecord[]>([]);
  const [processingCorrectionId, setProcessingCorrectionId] = useState<string | null>(null);

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

        // Fetch likes, saves, comments
        const [likeState, saveState, commentList] = await Promise.all([
          fetchItemLikeState(fetched.id, firebaseUser?.uid),
          fetchItemSaveState(fetched.id, firebaseUser?.uid),
          fetchItemComments(fetched.id),
        ]);
        if (active) {
          setLiked(likeState.liked);
          setLikeCount(likeState.count);
          setSaved(saveState.saved);
          setSaveCount(saveState.count);
          setComments(commentList);
        }

        // Fetch ID corrections
        try {
          const corrs = await listIdCorrectionsForItem(
            fetched.id,
            Boolean(firebaseUser?.emailVerified),
          );
          if (active) setIdCorrections(corrs);
        } catch {
          // ignore
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

  const handleToggleLike = async () => {
    if (!item) return;
    if (!firebaseUser) {
      navigate('/showcase');
      return;
    }

    const nextLiked = !liked;
    const nextCount = Math.max(0, likeCount + (nextLiked ? 1 : -1));
    setLiked(nextLiked);
    setLikeCount(nextCount);

    try {
      await toggleItemLike({
        itemId: item.id,
        uid: firebaseUser.uid,
        isVerifiedUser: Boolean(firebaseUser.emailVerified),
      });
    } catch (err) {
      console.error('Like toggle error:', err);
      setLiked(!nextLiked);
      setLikeCount(Math.max(0, nextCount + (nextLiked ? -1 : 1)));
    }
  };

  const handleToggleSave = async () => {
    if (!item) return;
    if (!firebaseUser) {
      navigate('/showcase');
      return;
    }

    const nextSaved = !saved;
    const nextCount = Math.max(0, saveCount + (nextSaved ? 1 : -1));
    setSaved(nextSaved);
    setSaveCount(nextCount);

    try {
      await toggleItemSave({
        itemId: item.id,
        uid: firebaseUser.uid,
        isVerifiedUser: Boolean(firebaseUser.emailVerified),
      });
    } catch (err) {
      console.error('Save toggle error:', err);
      setSaved(!nextSaved);
      setSaveCount(Math.max(0, nextCount + (nextSaved ? -1 : 1)));
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !viewerProfile || !newCommentText.trim()) return;
    setSubmittingComment(true);
    setCommentError(null);
    try {
      const created = await createItemComment({
        itemId: item.id,
        author: viewerProfile,
        text: newCommentText,
        isVerifiedUser: Boolean(firebaseUser?.emailVerified),
      });
      setComments((prev) => [created, ...prev]);
      setNewCommentText('');
    } catch (err) {
      console.error('Add comment error:', err);
      setCommentError(getFriendlyFirebaseErrorMessage(err));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSaveCommentEdit = async (commentId: string) => {
    if (!item || !editCommentText.trim()) return;
    setSavingCommentEdit(true);
    try {
      await updateItemComment({
        itemId: item.id,
        commentId,
        text: editCommentText,
        isVerifiedUser: Boolean(firebaseUser?.emailVerified),
      });
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, text: editCommentText } : c)),
      );
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (err) {
      console.error('Update comment error:', err);
    } finally {
      setSavingCommentEdit(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!item) return;
    try {
      await deleteItemComment({
        itemId: item.id,
        commentId,
        isVerifiedUser: Boolean(firebaseUser?.emailVerified),
      });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Delete comment error:', err);
    }
  };

  const handleOpenReport = (targetType: 'item' | 'comment', targetId: string) => {
    setReportTargetType(targetType);
    setReportTargetId(targetId);
    setReportReason('');
    setReportSuccess(false);
    setReportError(null);
    setReportOpen(true);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !firebaseUser || !reportReason.trim()) return;
    setSubmittingReport(true);
    setReportError(null);
    try {
      await submitContentReport({
        reporterId: firebaseUser.uid,
        targetType: reportTargetType,
        targetId: reportTargetId,
        itemId: item.id,
        reason: reportReason,
        isVerifiedUser: Boolean(firebaseUser.emailVerified),
      });
      setReportSuccess(true);
      window.setTimeout(() => setReportOpen(false), 2000);
    } catch (err) {
      console.error('Submit report error:', err);
      setReportError(getFriendlyFirebaseErrorMessage(err));
    } finally {
      setSubmittingReport(false);
    }
  };

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
  const pendingCorrections = idCorrections.filter((c) => c.status === 'pending');

  const handleAcceptCorrection = async (corr: IdCorrectionRecord) => {
    if (!collectionRecord || !item) return;
    setProcessingCorrectionId(corr.id);
    try {
      await acceptIdCorrection({
        correction: corr,
        item,
        collectionRecord,
        isVerifiedUser: Boolean(firebaseUser?.emailVerified),
      });
      setItem((prev) =>
        prev
          ? {
              ...prev,
              title: corr.suggestedCorrection,
              helpedBy: `@${corr.suggesterHandle}`,
            }
          : prev,
      );
      setIdCorrections((prev) =>
        prev.map((c) => (c.id === corr.id ? { ...c, status: 'accepted' } : c)),
      );
    } finally {
      setProcessingCorrectionId(null);
    }
  };

  const handleDismissCorrection = async (corrId: string) => {
    setProcessingCorrectionId(corrId);
    try {
      await dismissIdCorrection({
        correctionId: corrId,
        isVerifiedUser: Boolean(firebaseUser?.emailVerified),
      });
      setIdCorrections((prev) =>
        prev.map((c) => (c.id === corrId ? { ...c, status: 'dismissed' } : c)),
      );
    } finally {
      setProcessingCorrectionId(null);
    }
  };

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

          {/* Got One / Want One Community Counts & Wantlist Add */}
          <ItemSignalButtons item={item} />

          {/* Community ID Attribution Badge if accepted */}
          {item.helpedBy && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brass/10 border border-brass/40 text-xs text-ink font-mono">
              <span className="text-brass">★ ID confirmed with help from</span>
              <span className="font-semibold text-brass">{item.helpedBy}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {item.panelStatus === 'confirmed' && (
              <PanelConfirmedBadge date={item.panelConfirmedAt} size="md" />
            )}
            <ConfidenceChip confidence={item.aiConfidence} />

            {/* Like button */}
            <Button
              variant={liked ? 'primary' : 'secondary'}
              size="sm"
              onClick={handleToggleLike}
              className={liked ? 'bg-danger border-danger text-white hover:bg-danger/90' : ''}
              title={liked ? 'Unlike this piece' : 'Like this piece'}
            >
              <Heart
                className={`w-4 h-4 ${liked ? 'fill-current' : ''}`}
                strokeWidth={1.5}
              />
              <span className="font-mono">{likeCount}</span>
            </Button>

            {/* Save / Bookmark button */}
            <Button
              variant={saved ? 'primary' : 'secondary'}
              size="sm"
              onClick={handleToggleSave}
              title={saved ? 'Saved in your showcase' : 'Save to your showcase'}
            >
              <Bookmark
                className={`w-4 h-4 ${saved ? 'fill-current' : ''}`}
                strokeWidth={1.5}
              />
              <span>{saved ? 'Saved' : 'Save'}</span>
              <span className="font-mono text-xs opacity-80">({saveCount})</span>
            </Button>

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

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenReport('item', item.id)}
              title="Report this piece"
              className="text-muted hover:text-warn"
            >
              <Flag className="w-4 h-4" strokeWidth={1.5} />
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

            {!isOwner && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIdCorrectionOpen(true)}
              >
                <span>Suggest ID correction</span>
              </Button>
            )}
          </div>

          {/* Pending ID Corrections Panel for Owner */}
          {isOwner && pendingCorrections.length > 0 && (
            <Card raised className="p-4 sm:p-5 border-brass/50 bg-surface-raised space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">
                  Suggested ID Corrections ({pendingCorrections.length})
                </span>
                <span className="text-xs text-brass font-mono">Community review</span>
              </div>
              <div className="space-y-3">
                {pendingCorrections.map((corr) => (
                  <div
                    key={corr.id}
                    className="p-3 rounded-xl bg-bg border border-border space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-brass font-medium">
                        @{corr.suggesterHandle} ({corr.suggesterName})
                      </span>
                      <span className="text-muted">Suggested</span>
                    </div>
                    <div className="font-medium text-ink text-sm">
                      &quot;{corr.suggestedCorrection}&quot;
                    </div>
                    {corr.note && <p className="text-muted leading-relaxed">{corr.note}</p>}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={processingCorrectionId === corr.id}
                        onClick={() => void handleDismissCorrection(corr.id)}
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        disabled={processingCorrectionId === corr.id}
                        onClick={() => void handleAcceptCorrection(corr)}
                      >
                        Accept &amp; update item
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

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

      {/* Comments Thread */}
      <section id="comments" className="pt-8 border-t border-border space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-brass" strokeWidth={1.5} />
            <h2 className="text-xl sm:text-2xl font-display font-semibold text-ink">
              Comments ({comments.length})
            </h2>
          </div>
          <span className="text-xs font-mono text-muted">Plain text up to 1,000 characters</span>
        </div>

        {/* Comment input form */}
        {firebaseUser ? (
          <form onSubmit={handleAddComment} className="space-y-3">
            <div className="relative">
              <textarea
                rows={3}
                maxLength={1000}
                required
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Share your thoughts, history notes, or questions on this piece…"
                className="w-full px-4 py-3 text-base rounded-2xl border border-border bg-surface text-ink placeholder:text-muted/60 focus:outline-none focus:border-brass/70 resize-none transition-colors"
              />
              <span className="absolute bottom-2.5 right-3 text-xs font-mono text-muted">
                {1000 - newCommentText.length} left
              </span>
            </div>

            {commentError && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
                {commentError}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={submittingComment || !newCommentText.trim()}>
                <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{submittingComment ? 'Posting…' : 'Post comment'}</span>
              </Button>
            </div>
          </form>
        ) : (
          <Card className="p-4 flex items-center justify-between gap-4 bg-surface-raised">
            <span className="text-sm text-muted">Sign in to join the discussion and post a comment.</span>
            <Button size="sm" onClick={() => navigate('/showcase')}>
              Sign in
            </Button>
          </Card>
        )}

        {/* Comments list */}
        {comments.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted bg-surface/40 rounded-2xl border border-dashed border-border/80">
            No comments yet. Be the first to share thoughts on this piece!
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => {
              const isCommentAuthor = firebaseUser?.uid === comment.authorId;
              const isItemOwner = firebaseUser?.uid === item.ownerId;
              const canDelete = isCommentAuthor || isItemOwner;
              const isEditing = editingCommentId === comment.id;

              return (
                <Card key={comment.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CollectorImage
                        src={comment.authorAvatarUrl}
                        alt={comment.authorName}
                        className="w-8 h-8 rounded-full border border-border shrink-0 bg-surface-raised"
                        imgClassName="w-full h-full object-cover rounded-full"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink">
                            {comment.authorName}
                          </span>
                          <Link
                            to={`/@${comment.authorHandle}`}
                            className="text-xs font-mono text-muted hover:text-brass"
                          >
                            @{comment.authorHandle}
                          </Link>
                          {comment.authorId === item.ownerId && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brass/15 text-brass">
                              Owner
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isCommentAuthor && !isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommentId(comment.id);
                            setEditCommentText(comment.text);
                          }}
                          title="Edit comment"
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-muted hover:text-ink cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      )}

                      {canDelete && !isEditing && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteComment(comment.id)}
                          title={isCommentAuthor ? 'Delete your comment' : 'Delete comment from your piece'}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-muted hover:text-danger cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenReport('comment', comment.id)}
                        title="Report this comment"
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-muted hover:text-warn cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 pt-1">
                      <div className="relative">
                        <textarea
                          rows={2}
                          maxLength={1000}
                          value={editCommentText}
                          onChange={(e) => setEditCommentText(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-bg text-ink focus:outline-none focus:border-brass/70 resize-none"
                        />
                        <span className="absolute bottom-2 right-2.5 text-[10px] font-mono text-muted">
                          {1000 - editCommentText.length} left
                        </span>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditCommentText('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={savingCommentEdit || !editCommentText.trim()}
                          onClick={() => void handleSaveCommentEdit(comment.id)}
                        >
                          {savingCommentEdit ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-ink/90 whitespace-pre-wrap leading-relaxed">
                      {comment.text}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

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

      {/* Suggest ID Correction Sheet */}
      <IdCorrectionSheet
        item={item}
        open={idCorrectionOpen}
        onClose={() => setIdCorrectionOpen(false)}
        onSubmitted={() => {
          void listIdCorrectionsForItem(item.id, Boolean(firebaseUser?.emailVerified)).then(
            setIdCorrections,
          );
        }}
      />

      {/* Report Content Sheet */}
      <Sheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={reportTargetType === 'item' ? 'Report piece' : 'Report comment'}
        subtitle="Flag suspicious, offensive, or infringing content to moderators."
      >
        {reportSuccess ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-ok/10 border border-ok/30 text-ok flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" strokeWidth={2} />
            </div>
            <h3 className="text-lg font-display font-semibold text-ink">Thank you</h3>
            <p className="text-sm text-muted">
              Your report has been sent to our UK moderation team for review.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitReport} className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-warn/10 border border-warn/30 text-xs text-ink">
              <AlertTriangle className="w-4 h-4 text-warn shrink-0" strokeWidth={1.5} />
              <span>
                Reports are confidential and reviewed directly by Fanzeum administrators.
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Reason for report
              </label>
              <textarea
                rows={3}
                required
                maxLength={500}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Please describe why this content violates guidelines (e.g., spam, harassment, counterfeit or misleading details)…"
                className="w-full px-3.5 py-2.5 text-base rounded-xl border border-border bg-bg text-ink focus:outline-none focus:border-brass/70 resize-none"
              />
              <span className="block text-right text-xs font-mono text-muted mt-1">
                {500 - reportReason.length} characters remaining
              </span>
            </div>

            {reportError && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
                {reportError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={submittingReport || !reportReason.trim()}
              >
                {submittingReport ? 'Submitting…' : 'Submit report'}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
};

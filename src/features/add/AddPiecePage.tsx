import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  Check,
  Crop,
  FolderPlus,
  Info,
  Lock,
  Plus,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_LIST, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { identifyCollectibleByPhoto } from '../../lib/aiClient';
import { getFriendlyFirebaseErrorMessage } from '../../lib/firebase';
import { canUse, formatGbpRange } from '../../lib/entitlements';
import {
  addCollectibleItemRecord,
  createCollectionRecord,
  listOwnerCollections,
  makeSafeId,
} from '../../lib/firestoreRepo';
import {
  processCollectiblePhoto,
  uploadProcessedItemPhoto,
  type CropRect,
  type ProcessedCollectiblePhoto,
} from '../../lib/imageUtils';
import type {
  AIConfidence,
  CollectionRecord,
  ConfidenceLevel,
} from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { ConfidenceChip } from '../../components/ui/ConfidenceChip';
import { EmptyState } from '../../components/ui/EmptyState';

type CropPreset = 'full' | 'card' | 'square';

interface StagedPhotoSlot {
  id: string;
  file: File;
  label: string;
  rotationDeg: 0 | 90 | 180 | 270;
  cropPreset: CropPreset;
  processed: ProcessedCollectiblePhoto;
}

function computeCenteredCrop(
  naturalRatio: number,
  preset: CropPreset,
): CropRect | undefined {
  if (preset === 'full') return undefined;
  const targetRatio = preset === 'square' ? 1 : 0.75; // 3:4 portrait card/stamp
  if (Math.abs(naturalRatio - targetRatio) < 0.03) return undefined;

  if (naturalRatio > targetRatio) {
    // Wider than target: crop left/right
    const width = targetRatio / naturalRatio;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  // Taller than target: crop top/bottom
  const height = naturalRatio / targetRatio;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

async function readNaturalRatio(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
      URL.revokeObjectURL(url);
      resolve(r);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(1);
    };
    img.src = url;
  });
}

export const AddPiecePage: React.FC = () => {
  const { firebaseUser, profile, openAuthModal, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedColId = searchParams.get('collectionId') || '';

  useDocumentMeta({
    title: 'Add a Piece by Photo',
    description: 'Snap front and back to identify your piece, check its UK £ value, and add it to your showcase.',
  });

  const [step, setStep] = useState<'capture' | 'scanning' | 'review'>('capture');
  const [category, setCategory] = useState<CategorySlug>(
    profile?.specialties?.[0] || 'football_cards',
  );
  const [slots, setSlots] = useState<StagedPhotoSlot[]>([]);
  const [userNotes, setUserNotes] = useState('');
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [aiFallbackBanner, setAiFallbackBanner] = useState<string | null>(null);

  // Collections for destination picker
  const [myCollections, setMyCollections] = useState<CollectionRecord[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(preselectedColId);
  const [creatingInlineCol, setCreatingInlineCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');

  // Step 3 Review / Edit state
  const [editingDetails, setEditingDetails] = useState(false);
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [valueMinGbp, setValueMinGbp] = useState('0');
  const [valueMaxGbp, setValueMaxGbp] = useState('0');
  const [valuationReason, setValuationReason] = useState('');
  const [overallConfidence, setOverallConfidence] = useState<AIConfidence>('manual');
  const [attributes, setAttributes] = useState<Record<string, string | boolean>>({});
  const [fieldConfidences, setFieldConfidences] = useState<Record<string, ConfidenceLevel>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [grail, setGrail] = useState(false);
  const [acquiredPriceGbp, setAcquiredPriceGbp] = useState('');
  const [acquiredDate, setAcquiredDate] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser?.emailVerified) return;
    let active = true;
    listOwnerCollections(firebaseUser.uid, firebaseUser.uid, 50).then((cols) => {
      if (!active) return;
      setMyCollections(cols);
      if (preselectedColId && cols.some((c) => c.id === preselectedColId)) {
        setSelectedCollectionId(preselectedColId);
        const match = cols.find((c) => c.id === preselectedColId);
        if (match) setCategory(match.category);
      } else if (cols.length > 0) {
        setSelectedCollectionId(cols[0].id);
      } else {
        setCreatingInlineCol(true);
        setNewColTitle(`My ${CATEGORIES[category]?.shortLabel || 'Collector'} Set`);
      }
    });
    return () => {
      active = false;
    };
  }, [firebaseUser?.uid, firebaseUser?.emailVerified, preselectedColId]);

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    defaultLabel: string,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProcessingPhoto(true);
    setSaveError(null);
    try {
      const processed = await processCollectiblePhoto(file, {
        rotationDeg: 0,
        label: defaultLabel,
      });
      setSlots((prev) => [
        ...prev.slice(0, 3),
        {
          id: makeSafeId('slot'),
          file,
          label: defaultLabel,
          rotationDeg: 0,
          cropPreset: 'full',
          processed,
        },
      ]);
    } catch (err) {
      console.error('Photo read error:', err);
      setSaveError('Could not read that photo. Please try a different image.');
    } finally {
      setProcessingPhoto(false);
    }
  };

  const updateSlotTransform = async (
    slotId: string,
    nextRot: 0 | 90 | 180 | 270,
    nextPreset: CropPreset,
  ) => {
    const target = slots.find((s) => s.id === slotId);
    if (!target) return;
    setProcessingPhoto(true);
    try {
      const ratio = await readNaturalRatio(target.file);
      const crop = computeCenteredCrop(ratio, nextPreset);
      const processed = await processCollectiblePhoto(target.file, {
        rotationDeg: nextRot,
        crop,
        label: target.label,
      });
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? { ...s, rotationDeg: nextRot, cropPreset: nextPreset, processed }
            : s,
        ),
      );
    } finally {
      setProcessingPhoto(false);
    }
  };

  const removeSlot = (slotId: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  };

  const handleIdentify = async () => {
    if (slots.length === 0) return;
    setStep('scanning');
    setAiFallbackBanner(null);

    try {
      const res = await identifyCollectibleByPhoto({
        photos: slots.map((s) => ({
          base64: s.processed.identifyBase64,
          mimeType: s.processed.mimeType,
          label: s.label,
        })),
        categoryHint: category,
        userNotes: userNotes.trim() || undefined,
        userId: firebaseUser?.uid,
      });

      setCategory(res.category);
      setTitle(res.title);
      setStory(res.whatYouveGot);
      setValueMinGbp(String(res.valueMinGbp));
      setValueMaxGbp(String(res.valueMaxGbp));
      setValuationReason(res.valuationReason);
      setOverallConfidence(res.overallConfidence);
      setTags(res.suggestedTags || []);

      const nextAttrs: Record<string, string | boolean> = {};
      const nextConf: Record<string, ConfidenceLevel> = {};
      Object.entries(res.fields || {}).forEach(([k, entry]) => {
        nextAttrs[k] = entry.value;
        nextConf[k] = entry.confidence;
      });
      setAttributes(nextAttrs);
      setFieldConfidences(nextConf);
      setEditingDetails(res.overallConfidence === 'low');
      setStep('review');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'AI photo check is busy right now—fill in the details below and save straight to your showcase.';
      setAiFallbackBanner(msg);
      setOverallConfidence('manual');
      setEditingDetails(true);
      setStep('review');
    }
  };

  const handleSkipToManual = () => {
    setAiFallbackBanner(null);
    setOverallConfidence('manual');
    setEditingDetails(true);
    setStep('review');
  };

  const handleSaveToCabinet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser?.emailVerified || !profile) return;
    setSavingItem(true);
    setSaveError(null);

    try {
      let targetCollection = myCollections.find((c) => c.id === selectedCollectionId);
      if (creatingInlineCol || !targetCollection) {
        setSaveStatus('Creating collection…');
        targetCollection = await createCollectionRecord({
          profile,
          title: newColTitle.trim() || `My ${CATEGORIES[category]?.shortLabel || 'Collector'} Set`,
          story: '',
          category,
          visibility: 'public',
        });
        setMyCollections((prev) => [targetCollection!, ...prev]);
        setSelectedCollectionId(targetCollection.id);
      }

      const itemId = makeSafeId('itm');
      const uploadedPhotos = [];
      for (let i = 0; i < slots.length; i++) {
        setSaveStatus(`Uploading photo ${i + 1} of ${slots.length}…`);
        const uploaded = await uploadProcessedItemPhoto(
          firebaseUser.uid,
          itemId,
          i,
          slots[i].processed,
        );
        uploadedPhotos.push(uploaded);
      }

      setSaveStatus('Saving piece to your showcase…');
      const created = await addCollectibleItemRecord({
        customItemId: itemId,
        collectionRecord: targetCollection,
        profile,
        title: title.trim() || `Untitled ${CATEGORIES[category]?.shortLabel || 'Piece'}`,
        story,
        category,
        photos: uploadedPhotos,
        attributes,
        fieldConfidences,
        valueMinGbp: Number(valueMinGbp) || 0,
        valueMaxGbp: Number(valueMaxGbp) || 0,
        valuationReason,
        aiConfidence: overallConfidence,
        grail,
        tags,
        acquiredDate,
        acquiredPriceGbp: Number(acquiredPriceGbp) || 0,
        privateNotes,
      });

      await refreshProfile();
      navigate(`/i/${created.id}`);
    } catch (err) {
      console.error('Save piece error:', err);
      setSaveError(getFriendlyFirebaseErrorMessage(err));
      setSavingItem(false);
      setSaveStatus('');
    }
  };

  const isVerified = Boolean(firebaseUser?.emailVerified && profile);
  const identifyAllowed = !profile || canUse('identify', profile).allowed;
  const catConfig = CATEGORIES[category];
  const frontLabel = category === 'coins' ? 'Obverse (Front)' : 'Front';
  const backLabel = category === 'coins' ? 'Reverse (Back)' : 'Back';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-8">
      <div className="space-y-1.5">
        <p className="text-xs font-mono text-brass">
          {step === 'capture'
            ? 'Step 1 of 2 · Photos & hobby'
            : step === 'scanning'
              ? 'Checking catalogue details…'
              : 'Step 2 of 2 · Review & add to showcase'}
        </p>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink">
          {step === 'review' ? 'Our best guess' : 'Add a piece'}
        </h1>
      </div>

      {/* STEP 1: CAPTURE, CROP, ROTATE & HOBBY */}
      {step === 'capture' && (
        <div className="space-y-8">
          {/* Hobby Selector */}
          <div className="space-y-2.5">
            <label className="block text-sm font-medium text-ink">What hobby is this piece?</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CATEGORY_LIST.map((cat) => {
                const active = category === cat.slug;
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => setCategory(cat.slug)}
                    className={`min-h-[48px] px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-brass text-brass-fg border-brass'
                        : 'bg-surface text-ink border-border hover:border-brass/50'
                    }`}
                  >
                    <CategoryIcon category={cat.slug} className="w-4 h-4 shrink-0" />
                    <span className="truncate">{cat.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Uploaders & Crop/Rotate Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">
                Photos ({slots.length}/4) — location data stripped on device
              </span>
              {processingPhoto && (
                <span className="text-xs font-mono text-brass">Optimising WebP…</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {slots.map((slot) => (
                <Card key={slot.id} raised className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-brass">{slot.label}</span>
                    <button
                      type="button"
                      onClick={() => removeSlot(slot.id)}
                      aria-label={`Remove ${slot.label} photo`}
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-muted hover:text-danger cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>

                  <div className="aspect-[4/5] rounded-xl bg-bg border border-border overflow-hidden flex items-center justify-center p-2">
                    <img
                      src={slot.processed.previewUrl}
                      alt={slot.label}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Rotate & Aspect Crop Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      disabled={processingPhoto}
                      onClick={() => {
                        const nextRot = ((slot.rotationDeg + 90) % 360) as 0 | 90 | 180 | 270;
                        void updateSlotTransform(slot.id, nextRot, slot.cropPreset);
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-ink hover:border-brass/50 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />
                      <span>Rotate 90°</span>
                    </button>

                    <div className="inline-flex items-center gap-1 rounded-lg bg-surface border border-border p-0.5 text-xs">
                      <Crop className="w-3.5 h-3.5 text-muted ml-1.5" strokeWidth={1.5} />
                      {(['full', 'card', 'square'] as CropPreset[]).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          disabled={processingPhoto}
                          onClick={() =>
                            void updateSlotTransform(slot.id, slot.rotationDeg, preset)
                          }
                          className={`min-h-[32px] px-2 rounded-md font-mono cursor-pointer ${
                            slot.cropPreset === preset
                              ? 'bg-brass text-brass-fg'
                              : 'text-muted hover:text-ink'
                          }`}
                        >
                          {preset === 'full' ? 'Full' : preset === 'card' ? '3:4' : '1:1'}
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}

              {/* Upload Trigger Tiles */}
              {slots.length === 0 && (
                <label className="aspect-[4/5] rounded-2xl border-2 border-dashed border-brass/50 bg-surface hover:bg-surface-raised p-6 flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer">
                  <div className="w-12 h-12 rounded-2xl bg-brass text-brass-fg flex items-center justify-center">
                    <Camera className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-base font-display font-semibold text-ink">
                      Add {frontLabel}
                    </div>
                    <div className="text-sm text-muted mt-1">
                      Take a photo or choose from your camera roll
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleFileSelect(e, frontLabel)}
                    className="sr-only"
                  />
                </label>
              )}

              {slots.length === 1 && (
                <label className="aspect-[4/5] rounded-2xl border-2 border-dashed border-border hover:border-brass/50 bg-surface p-6 flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer">
                  <div className="w-11 h-11 rounded-2xl bg-surface-raised border border-border text-brass flex items-center justify-center">
                    <Plus className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-base font-display font-semibold text-ink">
                      Add {backLabel} (recommended)
                    </div>
                    <div className="text-sm text-muted mt-1">
                      Helps spot card numbers, mintmarks, watermarks, or matrix runouts
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleFileSelect(e, backLabel)}
                    className="sr-only"
                  />
                </label>
              )}

              {slots.length >= 2 && slots.length < 4 && (
                <label className="rounded-2xl border border-dashed border-border hover:border-brass/50 bg-surface p-6 flex flex-col items-center justify-center text-center gap-2 transition-colors cursor-pointer min-h-[180px]">
                  <Plus className="w-5 h-5 text-brass" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-ink">Add close-up detail</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleFileSelect(e, `Detail ${slots.length + 1}`)}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Optional Collector Clue */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Optional clue (if hard to read in the photo)
            </label>
            <input
              type="text"
              maxLength={400}
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="e.g. UK 8p cover, Plate 4, Porky Prime Cut in runout, or unhinged gum…"
              className="w-full min-h-[46px] px-4 py-2.5 text-base rounded-xl border border-border bg-surface text-ink placeholder:text-muted/60"
            />
          </div>

          {saveError && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
              {saveError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <Button variant="ghost" onClick={handleSkipToManual}>
              Skip AI &amp; enter details myself
            </Button>

            <Button
              size="lg"
              disabled={slots.length === 0 || processingPhoto || !identifyAllowed}
              onClick={handleIdentify}
            >
              <Camera className="w-4 h-4" strokeWidth={1.5} />
              <span>Identify piece</span>
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: SCANNING ANIMATION */}
      {step === 'scanning' && (
        <Card raised className="p-8 sm:p-12 text-center space-y-6">
          <div className="relative max-w-xs mx-auto aspect-[4/5] rounded-2xl overflow-hidden bg-bg border border-brass/50">
            {slots[0] && (
              <img
                src={slots[0].processed.previewUrl}
                alt="Piece being identified"
                className="w-full h-full object-contain p-3"
              />
            )}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-brass/0 via-brass/35 to-brass/0 animate-scan-sweep pointer-events-none"
            />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-display font-semibold text-ink">Identifying…</h2>
            <p className="text-base text-muted">
              Checking {catConfig?.shortLabel.toLowerCase()} references, condition cues, and UK £
              sold ranges.
            </p>
          </div>
        </Card>
      )}

      {/* STEP 3: REVIEW OUR BEST GUESS & SAVE */}
      {step === 'review' && (
        <form onSubmit={handleSaveToCabinet} className="space-y-8">
          {aiFallbackBanner && (
            <Card className="p-4 border-warn/50 bg-warn/10 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warn shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="text-sm text-ink">
                <p className="font-medium">Manual entry ready</p>
                <p className="text-muted mt-0.5">{aiFallbackBanner}</p>
              </div>
            </Card>
          )}

          {/* Top Summary Card */}
          <Card raised className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {slots[0] && (
                <div className="md:col-span-4 aspect-[4/5] rounded-xl bg-bg border border-border p-3 flex items-center justify-center">
                  <img
                    src={slots[0].processed.previewUrl}
                    alt={title || 'Uploaded piece'}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className={`${slots[0] ? 'md:col-span-8' : 'md:col-span-12'} space-y-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ConfidenceChip confidence={overallConfidence} />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingDetails((v) => !v)}
                  >
                    {editingDetails ? 'Done editing' : 'Edit details'}
                  </Button>
                </div>

                {editingDetails ? (
                  <div>
                    <label className="block text-xs text-muted mb-1">Piece title</label>
                    <input
                      type="text"
                      required
                      maxLength={140}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. 1840 1d Penny Black (Plate 4, 4 Margins)"
                      className="w-full min-h-[44px] px-3.5 py-2 text-lg font-display font-semibold rounded-xl border border-border bg-bg text-ink"
                    />
                  </div>
                ) : (
                  <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
                    {title || 'Untitled piece'}
                  </h2>
                )}

                <div className="space-y-1">
                  <div className="text-xs font-mono text-muted">What you&apos;ve got</div>
                  {editingDetails ? (
                    <textarea
                      rows={3}
                      maxLength={1500}
                      value={story}
                      onChange={(e) => setStory(e.target.value)}
                      placeholder="Add your story or notes on this piece…"
                      className="w-full px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
                    />
                  ) : (
                    <p className="text-base text-ink/90 leading-relaxed">
                      {story || 'No collector note yet.'}
                    </p>
                  )}
                </div>

                {/* £ Valuation Box */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                  {editingDetails ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted mb-1">Low guide (£)</label>
                        <input
                          type="number"
                          min={0}
                          value={valueMinGbp}
                          onChange={(e) => setValueMinGbp(e.target.value)}
                          className="w-full min-h-[42px] px-3 py-1.5 text-base font-mono rounded-xl border border-border bg-bg text-ink"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">High guide (£)</label>
                        <input
                          type="number"
                          min={0}
                          value={valueMaxGbp}
                          onChange={(e) => setValueMaxGbp(e.target.value)}
                          className="w-full min-h-[42px] px-3 py-1.5 text-base font-mono rounded-xl border border-border bg-bg text-ink"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xl font-mono font-semibold tabular-nums text-brass">
                      Worth around {formatGbpRange(Number(valueMinGbp) || 0, Number(valueMaxGbp) || 0)}
                    </div>
                  )}

                  {valuationReason && (
                    <p className="text-sm text-muted">{valuationReason}</p>
                  )}
                  <p className="text-xs text-muted flex items-center gap-1.5 pt-0.5">
                    <Info className="w-3.5 h-3.5 text-brass shrink-0" strokeWidth={1.5} />
                    <span>AI estimate, not a professional valuation.</span>
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Category-Specific Fields (Amber highlight on low-confidence fields) */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-display font-semibold text-ink">
                  {catConfig?.label} details
                </h3>
                <p className="text-sm text-muted">
                  Fields highlighted in amber had lower photo certainty—worth a quick check.
                </p>
              </div>
              {editingDetails && (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CategorySlug)}
                  className="min-h-[40px] px-3 py-1.5 text-sm rounded-xl border border-border bg-bg text-ink"
                >
                  {CATEGORY_LIST.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.shortLabel}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {catConfig?.fields.map((field) => {
                const conf = fieldConfidences[field.key];
                const isLow = conf === 'low';
                const val = attributes[field.key];

                return (
                  <div
                    key={field.key}
                    className={`p-3.5 rounded-xl border ${
                      isLow ? 'border-warn/60 bg-warn/5' : 'border-border bg-bg/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-medium text-muted">{field.label}</label>
                      {conf && <ConfidenceChip confidence={conf} compact />}
                    </div>

                    {field.type === 'boolean' ? (
                      <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) =>
                            setAttributes((prev) => ({ ...prev, [field.key]: e.target.checked }))
                          }
                          className="w-4 h-4 accent-brass"
                        />
                        <span>{val ? 'Yes' : 'No'}</span>
                      </label>
                    ) : field.type === 'select' && field.options ? (
                      <select
                        value={String(val || '')}
                        onChange={(e) =>
                          setAttributes((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="w-full min-h-[40px] px-3 py-1.5 text-sm rounded-lg border border-border bg-surface text-ink"
                      >
                        <option value="">Select…</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={String(val || '')}
                        placeholder={field.placeholder}
                        onChange={(e) =>
                          setAttributes((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className={`w-full min-h-[40px] px-3 py-1.5 text-sm rounded-lg border border-border bg-surface text-ink ${
                          field.mono ? 'font-mono' : ''
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Destination Collection & Private Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-display font-semibold text-ink">
                  Which collection?
                </h3>
                {myCollections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCreatingInlineCol((v) => !v)}
                    className="text-xs font-medium text-brass hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>{creatingInlineCol ? 'Choose existing' : 'New collection'}</span>
                  </button>
                )}
              </div>

              {creatingInlineCol || myCollections.length === 0 ? (
                <div>
                  <label className="block text-xs text-muted mb-1">New collection title</label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={newColTitle}
                    onChange={(e) => setNewColTitle(e.target.value)}
                    placeholder={`e.g. My ${catConfig?.shortLabel} Set`}
                    className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
                  />
                </div>
              ) : (
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
                >
                  {myCollections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.itemCount} pieces)
                    </option>
                  ))}
                </select>
              )}

              <label className="flex items-center gap-2.5 text-sm text-ink pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={grail}
                  onChange={(e) => setGrail(e.target.checked)}
                  className="w-4 h-4 accent-brass"
                />
                <span>Mark as a Grail piece</span>
              </label>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="inline-flex items-center gap-2">
                <Lock className="w-4 h-4 text-brass" strokeWidth={1.5} />
                <h3 className="text-lg font-display font-semibold text-ink">
                  Private record (optional)
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Price paid (£)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={acquiredPriceGbp}
                    onChange={(e) => setAcquiredPriceGbp(e.target.value)}
                    placeholder="0.00"
                    className="w-full min-h-[42px] px-3 py-1.5 text-sm font-mono rounded-xl border border-border bg-bg text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Date acquired</label>
                  <input
                    type="text"
                    value={acquiredDate}
                    onChange={(e) => setAcquiredDate(e.target.value)}
                    placeholder="e.g. Oct 2024"
                    className="w-full min-h-[42px] px-3 py-1.5 text-sm rounded-xl border border-border bg-bg text-ink"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Private notes</label>
                <input
                  type="text"
                  maxLength={1000}
                  value={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.value)}
                  placeholder="Dealer, fair, cert lookup, or condition note…"
                  className="w-full min-h-[42px] px-3 py-1.5 text-sm rounded-xl border border-border bg-bg text-ink"
                />
              </div>
            </Card>
          </div>

          {saveError && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
              {saveError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={savingItem}
              onClick={() => setStep('capture')}
            >
              ← Back to photos
            </Button>

            {!firebaseUser ? (
              <Button type="button" size="lg" onClick={openAuthModal}>
                <Camera className="w-4 h-4" strokeWidth={1.5} />
                <span>Sign in to save piece</span>
              </Button>
            ) : !isVerified ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-warn">
                  Verify your email to save pieces
                </span>
                <Button type="button" size="lg" disabled>
                  <span>Verify your email to save pieces</span>
                </Button>
              </div>
            ) : (
              <Button type="submit" size="lg" disabled={savingItem}>
                <Check className="w-4 h-4" strokeWidth={1.5} />
                <span>{savingItem ? saveStatus || 'Adding…' : 'Looks right, add it'}</span>
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};

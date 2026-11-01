import React, { useRef, useState } from 'react';
import { Camera, Check, Loader2, Upload, X } from 'lucide-react';
import {
  AIConfidence,
  CATEGORY_METADATA,
  CategorySlug,
  CollectionRecord,
} from '../types/domain';
import { compressPhotoForArchive, ProcessedPhoto, uploadCollectiblePhoto } from '../lib/imageUtils';
import { identifyCollectibleByPhoto } from '../lib/aiClient';
import { addCollectibleItemRecord } from '../lib/firestoreRepo';

interface PhotoIdentifyModalProps {
  open: boolean;
  collectionRecord: CollectionRecord;
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}

interface DraftCandidate {
  localId: string;
  processed: ProcessedPhoto;
  status: 'identifying' | 'ready' | 'saving' | 'saved' | 'error';
  errorMsg?: string;
  name: string;
  category: CategorySlug;
  year: string;
  maker: string;
  series: string;
  setNumber: string;
  condition: string;
  valueMinGbp: number;
  valueMaxGbp: number;
  aiConfidence: AIConfidence;
  curatorialNote: string;
}

export const PhotoIdentifyModal: React.FC<PhotoIdentifyModalProps> = ({
  open,
  collectionRecord,
  ownerId,
  onClose,
  onSaved,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [candidates, setCandidates] = useState<DraftCandidate[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [userNotes, setUserNotes] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);

  if (!open) return null;

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setGlobalError(null);

    const selected = Array.from(files).slice(0, 6);
    const initialDrafts: DraftCandidate[] = [];

    for (const file of selected) {
      try {
        const processed = await compressPhotoForArchive(file);
        initialDrafts.push({
          localId: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          processed,
          status: 'identifying',
          name: '',
          category: collectionRecord.category,
          year: '',
          maker: '',
          series: '',
          setNumber: '',
          condition: 'Good',
          valueMinGbp: 10,
          valueMaxGbp: 25,
          aiConfidence: 'medium',
          curatorialNote: '',
        });
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Could not process photograph.');
      }
    }

    if (initialDrafts.length === 0) return;

    setCandidates((prev) => [...prev, ...initialDrafts]);

    // Identify each photo with Gemini 3.8 Flash
    for (const draft of initialDrafts) {
      try {
        const aiResult = await identifyCollectibleByPhoto({
          imageBase64: draft.processed.base64Data,
          mimeType: draft.processed.mimeType,
          categoryHint: collectionRecord.category,
          userNotes: userNotes.trim() || undefined,
        });

        setCandidates((prev) =>
          prev.map((c) =>
            c.localId === draft.localId
              ? {
                  ...c,
                  status: 'ready',
                  name: aiResult.name,
                  category: aiResult.category,
                  year: aiResult.year,
                  maker: aiResult.maker,
                  series: aiResult.series,
                  setNumber: aiResult.setNumber,
                  condition: aiResult.conditionGuess,
                  valueMinGbp: aiResult.valueMinGbp,
                  valueMaxGbp: aiResult.valueMaxGbp,
                  aiConfidence: aiResult.confidence,
                  curatorialNote: aiResult.curatorialNote,
                }
              : c,
          ),
        );
      } catch (err) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.localId === draft.localId
              ? {
                  ...c,
                  status: 'ready',
                  aiConfidence: 'manual',
                  name: 'Unidentified Artefact (Manual Entry)',
                  errorMsg:
                    err instanceof Error
                      ? `${err.message} — You can confirm details manually below.`
                      : 'AI unavailable — enter details manually below.',
                }
              : c,
          ),
        );
      }
    }
  };

  const updateCurrentDraft = (patch: Partial<DraftCandidate>) => {
    setCandidates((prev) =>
      prev.map((c, idx) => (idx === activeIndex ? { ...c, ...patch } : c)),
    );
  };

  const handleConfirmSingle = async (idx: number) => {
    const target = candidates[idx];
    if (!target || target.status === 'saving' || target.status === 'saved') return;

    setCandidates((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, status: 'saving', errorMsg: undefined } : c)),
    );

    try {
      const itemId = `itm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const uploadedUrl = await uploadCollectiblePhoto(ownerId, itemId, target.processed);

      await addCollectibleItemRecord({
        collectionRecord,
        ownerId,
        customItemId: itemId,
        name: target.name,
        category: target.category,
        year: target.year,
        maker: target.maker,
        series: target.series,
        setNumber: target.setNumber,
        condition: target.condition,
        valueMinGbp: Number(target.valueMinGbp) || 0,
        valueMaxGbp: Math.max(Number(target.valueMinGbp) || 0, Number(target.valueMaxGbp) || 0),
        aiConfidence: target.aiConfidence,
        curatorialNote: target.curatorialNote,
        imageUrl: uploadedUrl,
      });

      setCandidates((prev) =>
        prev.map((c, i) => (i === idx ? { ...c, status: 'saved' } : c)),
      );
      onSaved();

      const nextUnsaved = candidates.findIndex((c, i) => i !== idx && c.status === 'ready');
      if (nextUnsaved !== -1) {
        setActiveIndex(nextUnsaved);
      }
    } catch (err) {
      setCandidates((prev) =>
        prev.map((c, i) =>
          i === idx
            ? {
                ...c,
                status: 'ready',
                errorMsg: err instanceof Error ? err.message : 'Could not save item.',
              }
            : c,
        ),
      );
    }
  };

  const current = candidates[activeIndex];
  const allSaved = candidates.length > 0 && candidates.every((c) => c.status === 'saved');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="identify-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-xl bg-[#FBF9F5] dark:bg-[#171614] border border-stone-200 dark:border-stone-800 p-6 sm:p-8 shadow-2xl my-8">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
              AI Curatorial Cataloguing · {collectionRecord.title}
            </p>
            <h2
              id="identify-modal-title"
              className="mt-1 text-2xl sm:text-3xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]"
            >
              Add Items by Photograph
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo identification modal"
            className="p-2 rounded-lg text-stone-500 hover:text-[#1C1917] dark:hover:text-[#F5F2EB] hover:bg-stone-200/60 dark:hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="hidden"
        />

        {candidates.length === 0 ? (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Optional Context Note for AI Appraiser (e.g. watermark, postmark, card back number)
              </label>
              <input
                type="text"
                maxLength={200}
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="e.g. Unrubbed orange quiz back, found in grandfather’s album"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB] focus:outline-none focus:border-[#9A3412]"
              />
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-stone-300 dark:border-stone-700 rounded-xl p-10 sm:p-14 text-center bg-[#F4EFE6]/50 dark:bg-[#0F0E0D]/60 hover:border-[#9A3412] transition-colors cursor-pointer"
            >
              <Camera className="w-9 h-9 mx-auto text-[#9A3412] dark:text-[#D97757] stroke-[1.5]" />
              <p className="mt-4 text-lg font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
                Select or Capture Collectible Photographs
              </p>
              <p className="mt-1.5 text-xs text-stone-600 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
                Upload a single piece or up to 6 photographs at once for bulk cataloguing. Fanzeum AI identifies maker, year, set number, condition grade, and £ GBP value range for you to confirm.
              </p>
              <button
                type="button"
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] text-xs font-medium cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Choose Photos
              </button>
            </div>

            {globalError && (
              <p className="text-xs text-red-700 dark:text-red-400">{globalError}</p>
            )}
          </div>
        ) : (
          <div className="mt-6">
            {/* Bulk Queue Selector Strip */}
            <div className="flex items-center justify-between gap-4 mb-5 overflow-x-auto pb-2">
              <div className="flex items-center gap-2">
                {candidates.map((cand, idx) => (
                  <button
                    key={cand.localId}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`relative w-14 h-14 rounded-lg overflow-hidden border transition-all shrink-0 cursor-pointer ${
                      idx === activeIndex
                        ? 'border-[#9A3412] dark:border-[#D97757] scale-105'
                        : 'border-stone-300 dark:border-stone-700 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={cand.processed.dataUrl}
                      alt={`Upload ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {cand.status === 'identifying' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                    {cand.status === 'saved' && (
                      <div className="absolute inset-0 bg-emerald-900/70 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
                {candidates.length < 6 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 h-14 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-400 hover:border-[#9A3412] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    + Add Photo
                  </button>
                )}
              </div>

              {allSaved && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Done · View Exhibition
                </button>
              )}
            </div>

            {current && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 bg-[#EFECE6] dark:bg-[#0F0E0D] rounded-xl p-4 border border-stone-200 dark:border-stone-800">
                  <div className="aspect-square rounded-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={current.processed.dataUrl}
                      alt={current.name || 'Uploaded collectible'}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="mt-3 text-xs text-stone-600 dark:text-stone-400 flex items-center justify-between">
                    <span>
                      Item {activeIndex + 1} of {candidates.length}
                    </span>
                    <span>
                      {current.status === 'identifying'
                        ? 'Inspecting plate & condition…'
                        : `AI Confidence: ${current.aiConfidence}`}
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  {current.status === 'identifying' ? (
                    <div className="py-16 text-center border border-stone-200 dark:border-stone-800 rounded-xl">
                      <Loader2 className="w-7 h-7 mx-auto animate-spin text-[#9A3412] dark:text-[#D97757]" />
                      <p className="mt-3 font-serif text-lg text-[#1C1917] dark:text-[#F5F2EB]">
                        Examining inscriptions, edges, and UK catalogue references…
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        You will review and confirm every field before saving.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {current.errorMsg && (
                        <p className="text-xs p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
                          {current.errorMsg}
                        </p>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                          Catalogue Title / Name
                        </label>
                        <input
                          type="text"
                          maxLength={140}
                          value={current.name}
                          onChange={(e) => updateCurrentDraft({ name: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                            Category
                          </label>
                          <select
                            value={current.category}
                            onChange={(e) =>
                              updateCurrentDraft({ category: e.target.value as CategorySlug })
                            }
                            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                          >
                            {Object.entries(CATEGORY_METADATA).map(([slug, meta]) => (
                              <option key={slug} value={slug}>
                                {meta.shortLabel}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                            Year / Era
                          </label>
                          <input
                            type="text"
                            maxLength={32}
                            value={current.year}
                            onChange={(e) => updateCurrentDraft({ year: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                            Set / Cat. Number
                          </label>
                          <input
                            type="text"
                            maxLength={60}
                            value={current.setNumber}
                            onChange={(e) => updateCurrentDraft({ setNumber: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                            Maker / Mint / Publisher
                          </label>
                          <input
                            type="text"
                            maxLength={100}
                            value={current.maker}
                            onChange={(e) => updateCurrentDraft({ maker: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                            Series / Reign / Album
                          </label>
                          <input
                            type="text"
                            maxLength={100}
                            value={current.series}
                            onChange={(e) => updateCurrentDraft({ series: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                            Condition Estimate
                          </label>
                          <input
                            type="text"
                            maxLength={80}
                            value={current.condition}
                            onChange={(e) => updateCurrentDraft({ condition: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                            Low Est. (£ GBP)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={current.valueMinGbp}
                            onChange={(e) =>
                              updateCurrentDraft({ valueMinGbp: Number(e.target.value) || 0 })
                            }
                            className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                            High Est. (£ GBP)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={current.valueMaxGbp}
                            onChange={(e) =>
                              updateCurrentDraft({ valueMaxGbp: Number(e.target.value) || 0 })
                            }
                            className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                          Curatorial &amp; Provenance Note
                        </label>
                        <textarea
                          rows={2}
                          maxLength={1200}
                          value={current.curatorialNote}
                          onChange={(e) => updateCurrentDraft({ curatorialNote: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                        />
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-3">
                        {current.status === 'saved' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <Check className="w-4 h-4" />
                            Accession Saved to Exhibition
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={current.status === 'saving'}
                            onClick={() => handleConfirmSingle(activeIndex)}
                            className="px-5 py-2.5 rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {current.status === 'saving'
                              ? 'Cataloguing…'
                              : 'Confirm & Add to Collection'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

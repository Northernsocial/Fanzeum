import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { CATEGORY_METADATA, CollectibleItemRecord } from '../types/domain';
import { formatGbpRange } from '../lib/entitlements';
import { ArchivalImage } from './ArchivalImage';

interface AccessionModalProps {
  item: CollectibleItemRecord | null;
  isOwner: boolean;
  onClose: () => void;
  onDelete?: (item: CollectibleItemRecord) => Promise<void>;
}

export const AccessionModal: React.FC<AccessionModalProps> = ({
  item,
  isOwner,
  onClose,
  onDelete,
}) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!item) return null;

  const dept = CATEGORY_METADATA[item.category]?.curatorDepartment || 'General Archive';
  const accessionCode = `ACC.${item.id.slice(-8).toUpperCase()}`;

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(item);
      onClose();
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="accession-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-xl bg-[#FBF9F5] dark:bg-[#171614] border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Museum Artwork Plate Viewer */}
          <div className="lg:col-span-6 bg-[#EFECE6] dark:bg-[#0F0E0D] flex items-center justify-center p-6 sm:p-10 min-h-[300px] lg:min-h-[480px]">
            <div className="w-full max-h-[420px] aspect-square flex items-center justify-center overflow-hidden rounded-lg">
              <ArchivalImage
                src={item.imageUrl}
                alt={item.name}
                fallbackTitle={item.name}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Museum Accession Detail Record */}
          <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs font-mono uppercase tracking-widest text-stone-500 dark:text-stone-400">
                  {accessionCode} · {dept}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close accession record"
                  className="p-1.5 rounded-lg text-stone-500 hover:text-[#1C1917] dark:hover:text-[#F5F2EB] hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h2
                id="accession-title"
                className="mt-2 text-2xl sm:text-3xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]"
              >
                {item.name}
              </h2>

              {item.curatorialNote && (
                <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300 font-serif italic">
                  “{item.curatorialNote}”
                </p>
              )}

              {/* Definition List with Hairline Dividers (Museum Pattern B) */}
              <dl className="mt-6 divide-y divide-stone-200 dark:divide-stone-800 border-y border-stone-200 dark:border-stone-800 text-sm">
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-stone-500 dark:text-stone-400">Date / Era</dt>
                  <dd className="font-medium text-right tabular-nums text-[#1C1917] dark:text-[#F5F2EB]">
                    {item.year || 'Unrecorded'}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-stone-500 dark:text-stone-400">Maker / Authority</dt>
                  <dd className="font-medium text-right text-[#1C1917] dark:text-[#F5F2EB]">
                    {item.maker || 'Unrecorded'}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-stone-500 dark:text-stone-400">Series / Issue</dt>
                  <dd className="font-medium text-right text-[#1C1917] dark:text-[#F5F2EB]">
                    {item.series || 'General Issue'}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-stone-500 dark:text-stone-400">Catalogue / Set No.</dt>
                  <dd className="font-mono text-xs font-medium text-right tabular-nums text-[#1C1917] dark:text-[#F5F2EB]">
                    {item.setNumber || 'Unlisted'}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-stone-500 dark:text-stone-400">Condition Grade</dt>
                  <dd className="font-medium text-right text-[#1C1917] dark:text-[#F5F2EB]">
                    {item.condition}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-stone-500 dark:text-stone-400">Est. UK Valuation</dt>
                  <dd className="font-mono font-medium text-right tabular-nums text-[#9A3412] dark:text-[#D97757]">
                    {formatGbpRange(item.valueMinGbp, item.valueMaxGbp)}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-stone-500 dark:text-stone-400">Identification Basis</dt>
                  <dd className="text-xs text-right text-stone-600 dark:text-stone-300">
                    {item.aiConfidence === 'manual'
                      ? 'Curator Entered'
                      : `AI Assisted (${item.aiConfidence} confidence) · Curator Confirmed`}
                  </dd>
                </div>
              </dl>
            </div>

            {isOwner && !item.isDemo && onDelete && (
              <div className="mt-6 pt-4 flex items-center justify-end gap-3">
                {!confirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove from Collection
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-600 dark:text-stone-400">
                      Permanently remove item?
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="px-3 py-1.5 text-xs rounded-md border border-stone-300 dark:border-stone-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleConfirmDelete}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-700 text-white hover:bg-red-800 disabled:opacity-50 cursor-pointer"
                    >
                      {deleting ? 'Removing…' : 'Confirm Delete'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

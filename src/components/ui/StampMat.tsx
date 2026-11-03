import React from 'react';
import { CollectorImage } from './CollectorImage';

interface StampMatProps {
  src: string;
  alt: string;
  sgNumber?: string;
  stateLabel?: string;
  blurDataUrl?: string;
  priority?: boolean;
}

export const StampMat: React.FC<StampMatProps> = ({
  src,
  alt,
  sgNumber,
  stateLabel,
  blurDataUrl,
  priority = false,
}) => {
  return (
    <div className="relative aspect-[4/5] rounded-2xl bg-surface-raised border border-border p-4 sm:p-6 flex flex-col items-center justify-center after-hours-spotlight overflow-hidden select-none">
      {/* Philatelic Mount */}
      <div className="w-full flex-1 min-h-0 rounded-xl bg-bg/50 border border-border/80 p-3 sm:p-4 flex items-center justify-center">
        <CollectorImage
          src={src}
          alt={alt}
          category="stamps"
          width={680}
          height={820}
          blurDataUrl={blurDataUrl}
          priority={priority}
          className="w-full h-full flex items-center justify-center"
          imgClassName="w-full h-full object-contain drop-shadow-sm"
        />
      </div>
      {(sgNumber || stateLabel) && (
        <div className="mt-2.5 text-xs font-mono text-muted flex items-center gap-2 max-w-full px-1">
          {sgNumber && <span className="text-brass truncate shrink-0">{sgNumber}</span>}
          {sgNumber && stateLabel && <span aria-hidden="true">·</span>}
          {stateLabel && <span className="truncate">{stateLabel}</span>}
        </div>
      )}
    </div>
  );
};

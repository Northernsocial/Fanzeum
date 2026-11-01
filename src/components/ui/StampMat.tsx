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
    <div className="relative aspect-[4/5] rounded-2xl bg-surface-raised border border-border p-5 sm:p-7 flex flex-col items-center justify-center after-hours-spotlight">
      {/* Perforated Philatelic Mount */}
      <div className="w-full h-full rounded-md bg-ink/95 dark:bg-surface p-2 stamp-perforated-mat border border-border flex items-center justify-center">
        <div className="w-full h-full bg-bg p-3 flex items-center justify-center">
          <CollectorImage
            src={src}
            alt={alt}
            category="stamps"
            width={680}
            height={820}
            blurDataUrl={blurDataUrl}
            priority={priority}
            className="w-full h-full"
            imgClassName="w-full h-full object-contain"
          />
        </div>
      </div>
      {(sgNumber || stateLabel) && (
        <div className="mt-2.5 text-xs font-mono text-muted flex items-center gap-2">
          {sgNumber && <span className="text-brass">{sgNumber}</span>}
          {sgNumber && stateLabel && <span aria-hidden="true">·</span>}
          {stateLabel && <span className="truncate max-w-[160px]">{stateLabel}</span>}
        </div>
      )}
    </div>
  );
};

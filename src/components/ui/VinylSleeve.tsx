import React from 'react';
import { CollectorImage } from './CollectorImage';

interface VinylSleeveProps {
  src: string;
  alt: string;
  catalogueNumber?: string;
  mediaGrade?: string;
  blurDataUrl?: string;
  priority?: boolean;
}

export const VinylSleeve: React.FC<VinylSleeveProps> = ({
  src,
  alt,
  catalogueNumber,
  mediaGrade,
  blurDataUrl,
  priority = false,
}) => {
  return (
    <div className="group relative aspect-square rounded-2xl bg-surface-raised border border-border p-3 sm:p-5 flex items-center justify-start overflow-hidden after-hours-spotlight select-none">
      {/* Peeking Grooved Record Disc */}
      <div
        aria-hidden="true"
        className="absolute right-2 sm:right-4 w-[74%] aspect-square rounded-full bg-bg border border-border/80 flex items-center justify-center transition-transform duration-200 ease-out group-hover:translate-x-3 pointer-events-none"
      >
        <div className="w-[78%] aspect-square rounded-full border border-border/60 flex items-center justify-center">
          <div className="w-[42%] aspect-square rounded-full bg-brass flex flex-col items-center justify-center text-brass-fg p-1 text-center">
            <div className="w-2.5 h-2.5 rounded-full bg-bg mb-0.5" />
            {catalogueNumber && (
              <span className="text-[9px] font-mono font-semibold leading-none truncate max-w-full">
                {catalogueNumber}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Front Picture / Company Sleeve */}
      <div className="relative z-10 w-[82%] aspect-square rounded-xl overflow-hidden bg-surface border border-border shadow-md">
        <CollectorImage
          src={src}
          alt={alt}
          category="vinyl"
          width={700}
          height={700}
          blurDataUrl={blurDataUrl}
          priority={priority}
          className="w-full h-full"
          imgClassName="w-full h-full object-cover"
        />
        {mediaGrade && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-bg/90 backdrop-blur-sm text-[11px] font-mono text-brass border border-border/60">
            {mediaGrade}
          </div>
        )}
      </div>
    </div>
  );
};

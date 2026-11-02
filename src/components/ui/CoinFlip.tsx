import React, { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { CollectorImage } from './CollectorImage';

interface CoinFlipProps {
  obverseUrl: string;
  reverseUrl?: string;
  alt: string;
  year?: string;
  reference?: string;
  metal?: string;
  grade?: string;
  blurDataUrl?: string;
  interactive?: boolean;
  priority?: boolean;
}

export const CoinFlip: React.FC<CoinFlipProps> = ({
  obverseUrl,
  reverseUrl,
  alt,
  year,
  reference,
  metal,
  grade,
  blurDataUrl,
  interactive = true,
  priority = false,
}) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="relative aspect-square rounded-2xl bg-surface-raised border border-border p-4 sm:p-6 flex flex-col items-center justify-center after-hours-spotlight overflow-hidden">
      <div className="relative w-full h-full max-w-[280px] max-h-[280px] flex items-center justify-center">
        {!flipped ? (
          <div className="w-full h-full rounded-full overflow-hidden border-2 border-brass/35 bg-bg flex items-center justify-center p-2 transition-transform duration-200">
            <CollectorImage
              src={obverseUrl}
              alt={`${alt} — Obverse`}
              category="coins"
              width={600}
              height={600}
              blurDataUrl={blurDataUrl}
              priority={priority}
              className="w-full h-full rounded-full"
              imgClassName="w-full h-full object-contain rounded-full"
            />
          </div>
        ) : reverseUrl ? (
          <div className="w-full h-full rounded-full overflow-hidden border-2 border-brass/50 bg-bg flex items-center justify-center p-2 transition-transform duration-200">
            <CollectorImage
              src={reverseUrl}
              alt={`${alt} — Reverse`}
              category="coins"
              width={600}
              height={600}
              className="w-full h-full rounded-full"
              imgClassName="w-full h-full object-contain rounded-full"
            />
          </div>
        ) : (
          <div className="w-full h-full rounded-full border-2 border-brass/50 bg-surface flex flex-col items-center justify-center text-center p-4">
            <span className="text-xs font-mono text-brass">{year || 'Cabinet Ticket'}</span>
            <span className="text-xs font-mono text-ink mt-1.5 line-clamp-2 break-words">
              {reference || 'Reverse Unrecorded'}
            </span>
            {metal && <span className="text-[11px] text-muted mt-1">{metal}</span>}
            {grade && <span className="text-xs font-mono text-brass mt-1.5">{grade}</span>}
          </div>
        )}
      </div>

      {interactive && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFlipped((prev) => !prev);
          }}
          aria-label={flipped ? 'Show obverse' : 'Flip coin to reverse'}
          className="mt-3 min-h-[36px] px-3 py-1 rounded-lg bg-surface/90 border border-border text-xs font-mono text-muted hover:text-ink hover:border-brass/50 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />
          <span>{flipped ? 'Reverse · Tap for obverse' : 'Obverse · Tap to flip'}</span>
        </button>
      )}
    </div>
  );
};

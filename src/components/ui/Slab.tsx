import React, { useRef, useState } from 'react';
import type { CategorySlug } from '../../config/categories';
import { CollectorImage } from './CollectorImage';

interface SlabProps {
  src: string;
  alt: string;
  category: CategorySlug;
  graderLabel?: string;
  gradeValue?: string;
  subLabel?: string;
  blurDataUrl?: string;
  interactiveTilt?: boolean;
  priority?: boolean;
}

export const Slab: React.FC<SlabProps> = ({
  src,
  alt,
  category,
  graderLabel = 'RAW',
  gradeValue = 'NM',
  subLabel = '',
  blurDataUrl,
  interactiveTilt = true,
  priority = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactiveTilt || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const ry = (px - 0.5) * 9;
    const rx = (0.5 - py) * 9;
    ref.current.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    if (sheenRef.current) {
      const sx = Math.round(px * 100);
      const sy = Math.round(py * 100);
      sheenRef.current.style.background = `radial-gradient(circle at ${sx}% ${sy}%, color-mix(in srgb, var(--text) 18%, transparent), transparent 55%)`;
    }
    if (!active) setActive(true);
  };

  const resetTilt = () => {
    if (ref.current) {
      ref.current.style.transform = '';
    }
    if (active) setActive(false);
  };

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      className="relative rounded-2xl overflow-hidden bg-surface-raised border border-border transition-transform duration-150 ease-out select-none shadow-sm hover:shadow-md"
    >
      {/* Graded Slab Label Strip */}
      <div className="flex items-center justify-between gap-2 bg-surface/90 border-b border-border/80 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-mono font-semibold text-brass tracking-wider truncate uppercase">
            {graderLabel}
          </div>
          {subLabel && (
            <div className="text-[10px] sm:text-[11px] text-muted truncate">{subLabel}</div>
          )}
        </div>
        {gradeValue && (
          <div className="text-sm sm:text-base font-mono font-semibold tabular-nums text-ink shrink-0 pl-2.5 border-l border-border/60">
            {gradeValue}
          </div>
        )}
      </div>

      {/* Recessed Display Window */}
      <div className="relative aspect-[3/4] bg-bg/40 flex items-center justify-center p-2.5">
        <CollectorImage
          src={src}
          alt={alt}
          category={category}
          blurDataUrl={blurDataUrl}
          priority={priority}
          className="w-full h-full flex items-center justify-center"
          imgClassName="w-full h-full object-contain drop-shadow-sm"
        />
        <div
          ref={sheenRef}
          aria-hidden="true"
          className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${
            active ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </div>
  );
};

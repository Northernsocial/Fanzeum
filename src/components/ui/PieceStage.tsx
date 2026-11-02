import React from 'react';
import { CATEGORIES, getItemPlacardParts } from '../../config/categories';
import type { CollectibleItemRecord } from '../../types/domain';
import { CoinFlip } from './CoinFlip';
import { CollectorImage } from './CollectorImage';
import { Slab } from './Slab';
import { StampMat } from './StampMat';
import { VinylSleeve } from './VinylSleeve';

interface PieceStageProps {
  item: CollectibleItemRecord;
  interactive?: boolean;
  priority?: boolean;
}

export const PieceStage: React.FC<PieceStageProps> = ({
  item,
  interactive = true,
  priority = false,
}) => {
  const style = CATEGORIES[item.category]?.presentationStyle || 'plinth';
  const placard = getItemPlacardParts(item.category, item.attributes);
  const primaryPhoto = item.photos?.[0];
  const secondaryPhoto = item.photos?.[1];
  const src = primaryPhoto?.url || item.imageUrl;
  const blur = primaryPhoto?.blurDataUrl;

  if (style === 'card-slab') {
    const graded = Boolean(item.attributes.graded);
    const grader = String(item.attributes.grader || '');
    return (
      <Slab
        src={src}
        alt={item.title}
        category={item.category}
        graderLabel={graded && grader && grader !== 'None (Raw)' ? grader : 'UNSLABBED'}
        gradeValue={
          graded && item.attributes.grade
            ? String(item.attributes.grade)
            : String(item.attributes.rawCondition || item.condition)
        }
        subLabel={[placard.year, placard.catNumber].filter(Boolean).join(' · ')}
        blurDataUrl={blur}
        interactiveTilt={interactive}
        priority={priority}
      />
    );
  }

  if (style === 'comic-slab') {
    const cgc = String(item.attributes.cgcGrade || '').trim();
    return (
      <Slab
        src={src}
        alt={item.title}
        category={item.category}
        graderLabel={cgc ? 'CGC UNIVERSAL' : 'MYLAR SLEEVE'}
        gradeValue={cgc || String(item.attributes.rawCondition || item.condition)}
        subLabel={[String(item.attributes.publisher || ''), placard.catNumber]
          .filter(Boolean)
          .join(' ')}
        blurDataUrl={blur}
        interactiveTilt={interactive}
        priority={priority}
      />
    );
  }

  if (style === 'coin-flip') {
    return (
      <CoinFlip
        obverseUrl={src}
        reverseUrl={secondaryPhoto?.url}
        alt={item.title}
        year={placard.year}
        reference={placard.catNumber}
        metal={String(item.attributes.metal || '')}
        grade={placard.condition}
        blurDataUrl={blur}
        interactive={interactive}
        priority={priority}
      />
    );
  }

  if (style === 'vinyl-sleeve') {
    return (
      <VinylSleeve
        src={src}
        alt={item.title}
        catalogueNumber={placard.catNumber}
        mediaGrade={placard.condition}
        blurDataUrl={blur}
        priority={priority}
      />
    );
  }

  if (style === 'stamp-perf') {
    return (
      <StampMat
        src={src}
        alt={item.title}
        sgNumber={placard.catNumber}
        stateLabel={placard.condition}
        blurDataUrl={blur}
        priority={priority}
      />
    );
  }

  // Default Plinth (Vintage Toys & Memorabilia)
  return (
    <div className="relative aspect-[4/5] rounded-2xl bg-surface-raised border border-border p-4 sm:p-6 flex flex-col items-center justify-center after-hours-spotlight overflow-hidden select-none">
      <div className="w-full flex-1 min-h-0 flex items-center justify-center">
        <CollectorImage
          src={src}
          alt={item.title}
          category={item.category}
          width={primaryPhoto?.width || 800}
          height={primaryPhoto?.height || 920}
          blurDataUrl={blur}
          priority={priority}
          className="w-full h-full flex items-center justify-center"
          imgClassName="w-full h-full object-contain drop-shadow-md"
        />
      </div>
      <div className="w-2/3 h-1 rounded-full bg-brass/30 mt-3 shrink-0" />
    </div>
  );
};

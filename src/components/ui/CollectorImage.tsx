import React, { useState } from 'react';
import type { CategorySlug } from '../../config/categories';
import { buildCollectorArtDataUrl } from '../../lib/placeholderArt';

interface CollectorImageProps {
  src: string;
  alt: string;
  category?: CategorySlug;
  width?: number;
  height?: number;
  blurDataUrl?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
}

export const CollectorImage: React.FC<CollectorImageProps> = ({
  src,
  alt,
  category = 'memorabilia',
  width = 800,
  height = 1000,
  blurDataUrl,
  className = '',
  imgClassName = 'w-full h-full object-contain',
  priority = false,
}) => {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fallbackSrc = buildCollectorArtDataUrl({
    category,
    title: alt || 'Collector Piece',
  });

  const resolvedSrc = !src || errored ? fallbackSrc : src;

  return (
    <div className={`relative overflow-hidden select-none ${className}`}>
      {blurDataUrl && !loaded && (
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-60 pointer-events-none"
        />
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!errored) setErrored(true);
          setLoaded(true);
        }}
        className={`${imgClassName} transition-opacity duration-200 ${loaded || resolvedSrc.startsWith('data:') ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};

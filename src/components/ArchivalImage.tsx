import React, { useState } from 'react';
import { Frame } from 'lucide-react';

interface ArchivalImageProps {
  src?: string;
  alt: string;
  fallbackTitle?: string;
  className?: string;
}

export const ArchivalImage: React.FC<ArchivalImageProps> = ({
  src,
  alt,
  fallbackTitle,
  className = 'w-full h-full object-cover',
}) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#EFECE6] dark:bg-[#1C1A17] text-stone-600 dark:text-stone-400">
        <Frame className="w-8 h-8 mb-3 stroke-[1.25] opacity-70" />
        <span className="font-serif text-base italic line-clamp-2 max-w-[22ch]">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};

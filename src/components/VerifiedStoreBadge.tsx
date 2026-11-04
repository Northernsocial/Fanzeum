import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface VerifiedStoreBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export const VerifiedStoreBadge: React.FC<VerifiedStoreBadgeProps> = ({
  className = '',
  size = 'md',
}) => {
  return (
    <span
      title="Verified Store: UK business seller with approved identity verification"
      className={`inline-flex items-center gap-1 font-mono font-medium rounded-full border border-brass/60 bg-brass/10 text-brass shadow-sm select-none ${
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      } ${className}`}
    >
      <ShieldCheck className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5 text-brass'} strokeWidth={2} />
      <span>Verified Store</span>
    </span>
  );
};

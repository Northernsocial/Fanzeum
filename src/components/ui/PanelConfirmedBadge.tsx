import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

interface PanelConfirmedBadgeProps {
  date?: string;
  size?: 'sm' | 'md';
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
}

export const PanelConfirmedBadge: React.FC<PanelConfirmedBadgeProps> = ({
  date,
  size = 'md',
  compact = false,
  iconOnly = false,
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const formattedDate = date
    ? date.includes('T')
      ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : date
    : null;

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        // Toggle on tap for touch devices
        e.stopPropagation();
        setShowTooltip((prev) => !prev);
      }}
    >
      {iconOnly ? (
        <div
          className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-brass bg-surface text-brass cursor-pointer"
          role="status"
          aria-label={`Panel confirmed${formattedDate ? ` on ${formattedDate}` : ''}. AI estimate, not authentication.`}
          title="Panel confirmed"
        >
          <ShieldCheck className="w-4 h-4" strokeWidth={2} />
        </div>
      ) : (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-brass/60 bg-surface text-brass font-medium transition-colors cursor-pointer hover:bg-brass/20 ${
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        }`}
        role="status"
        aria-label={`Panel confirmed${formattedDate ? ` on ${formattedDate}` : ''}. AI estimate, not authentication.`}
      >
        <ShieldCheck className={size === 'sm' ? 'w-3.5 h-3.5 text-brass' : 'w-4 h-4 text-brass'} strokeWidth={1.75} />
        <span>Panel confirmed</span>
        {!compact && formattedDate && (
          <>
            <span aria-hidden="true" className="opacity-60">·</span>
            <span className="text-ink/80">{formattedDate}</span>
          </>
        )}
      </div>
      )}

      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs z-30 px-2.5 py-1.5 rounded-lg bg-surface-raised border border-border text-[11px] text-ink shadow-lg pointer-events-none transition-opacity"
        >
          <div className="flex items-center gap-1 text-brass font-mono font-medium">
            <CheckCircle2 className="w-3 h-3 text-brass shrink-0" />
            <span>AI estimate, not authentication</span>
          </div>
          {formattedDate && (
            <div className="text-[10px] text-muted mt-0.5">
              Specialist consensus reached {formattedDate}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
